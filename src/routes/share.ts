/**
 * Public share access routes
 */

import type { Context } from "hono";
import type { AuthenticatedUser } from "../auth/middleware";
import {
  createShareLink,
  deleteShareLink,
  getShareLinkById,
  getShareLinkByToken,
  incrementDownloadCount,
  isShareLinkValid,
  verifyShareLinkPassword,
} from "../db/share-links";
import type { BucketInfo } from "../types";
import { renderSharePage, renderSharePasswordPage } from "../ui/share-page";
import { getBucketByBinding, setCurrentBucket } from "../utils/buckets";
import { formatContentDisposition } from "../utils/format";
import { getTheme } from "../utils/theme";
import { getOrigin } from "../utils/url";

/**
 * POST /b/:bucket/share - Create a new share link
 */
export async function createShareLinkRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  if (!user) {
    return c.text("Unauthorized", 401);
  }

  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");

  const bucketInfo = getBucketByBinding(buckets, bucketBinding);
  if (!bucketInfo) {
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  // Set the bucket cookie
  setCurrentBucket(c, bucketBinding);

  const db = (c.env as any).DB as D1Database;
  const formData = await c.req.formData();

  const r2Path = formData.get("path") as string;
  const isDirectory = formData.get("isDirectory") === "true";
  const password = formData.get("password") as string | null;
  const expiresAtStr = formData.get("expiresAt") as string | null;
  const maxDownloadsStr = formData.get("maxDownloads") as string | null;

  if (!r2Path) {
    return c.text("Path is required", 400);
  }

  // Parse optional fields
  let expiresAt: number | undefined;
  if (expiresAtStr) {
    const date = new Date(expiresAtStr);
    if (!isNaN(date.getTime())) {
      expiresAt = date.getTime();
    }
  }

  let maxDownloads: number | undefined;
  if (maxDownloadsStr) {
    const parsed = parseInt(maxDownloadsStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      maxDownloads = parsed;
    }
  }

  const shareLink = await createShareLink(db, {
    createdBy: user.id,
    r2Bucket: bucketBinding,
    r2Path,
    isDirectory,
    password: password || undefined,
    expiresAt,
    maxDownloads,
  });

  // Build the share URL using the correct origin for the current environment
  const origin = getOrigin(c.req);
  const shareUrl = `${origin}/s/${shareLink.token}`;

  // Redirect back to details page with success message
  const redirectUrl = formData.get("redirect") as string;
  if (redirectUrl) {
    return c.redirect(`${redirectUrl}?shareUrl=${encodeURIComponent(shareUrl)}`);
  }

  // Return JSON for API calls
  return c.json({ token: shareLink.token, url: shareUrl });
}

/**
 * DELETE /b/:bucket/share/:id - Delete a share link
 */
export async function deleteShareLinkRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  if (!user) {
    return c.text("Unauthorized", 401);
  }

  const db = (c.env as any).DB as D1Database;
  const linkId = c.req.param("id");

  // Get the share link to check ownership
  const shareLink = await getShareLinkById(db, linkId);
  if (!shareLink) {
    return c.text("Share link not found", 404);
  }

  // Only allow deletion by the creator or an admin
  if (shareLink.created_by !== user.id && !user.is_admin) {
    return c.text("Forbidden", 403);
  }

  await deleteShareLink(db, linkId);

  // Redirect back to settings
  const referer = c.req.header("Referer");
  if (referer) {
    return c.redirect(referer);
  }

  return c.text("Share link deleted");
}

/**
 * GET /s/:token - Access shared content (public)
 */
export async function accessShareRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const token = c.req.param("token");
  const db = (c.env as any).DB as D1Database;
  const buckets = c.get("buckets");
  const theme = getTheme(c);

  const shareLink = await getShareLinkByToken(db, token);
  if (!shareLink) {
    return c.html(renderSharePage({ error: "Share link not found", theme }), 404);
  }

  // Check validity
  const validity = isShareLinkValid(shareLink);
  if (!validity.valid) {
    return c.html(renderSharePage({ error: validity.reason || "Link is invalid", theme }), 410);
  }

  // Check for password
  if (shareLink.password_hash) {
    // Check if password was provided via session/cookie
    const passwordCookie = c.req.header("Cookie")?.includes(`share_${token}=verified`);
    if (!passwordCookie) {
      // Show password form
      return c.html(renderSharePasswordPage({ token, theme }));
    }
  }

  // Get the bucket
  const bucketInfo = getBucketByBinding(buckets, shareLink.r2_bucket);
  if (!bucketInfo) {
    return c.html(renderSharePage({ error: "Storage not available", theme }), 500);
  }

  // Handle directory vs file
  if (shareLink.is_directory) {
    // For directories, show a listing
    return c.html(
      renderSharePage({
        shareLink: {
          token: shareLink.token,
          r2_path: shareLink.r2_path,
          is_directory: true,
          expires_at: shareLink.expires_at,
          max_downloads: shareLink.max_downloads,
          download_count: shareLink.download_count,
        },
        theme,
      })
    );
  }

  // For files, redirect to download
  return c.redirect(`/s/${token}/download`);
}

/**
 * POST /s/:token - Verify password for protected share
 */
export async function verifySharePasswordRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const token = c.req.param("token");
  const db = (c.env as any).DB as D1Database;
  const theme = getTheme(c);

  const shareLink = await getShareLinkByToken(db, token);
  if (!shareLink) {
    return c.html(renderSharePage({ error: "Share link not found", theme }), 404);
  }

  const formData = await c.req.formData();
  const password = formData.get("password") as string;

  if (!password) {
    return c.html(
      renderSharePasswordPage({ token, error: "Password is required", theme })
    );
  }

  const isValid = await verifyShareLinkPassword(shareLink, password);
  if (!isValid) {
    return c.html(
      renderSharePasswordPage({ token, error: "Incorrect password", theme })
    );
  }

  // Set a cookie to remember password verification
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `share_${token}=verified; Path=/s/${token}; HttpOnly; SameSite=Strict; Max-Age=3600`
  );
  headers.set("Location", `/s/${token}`);

  return new Response(null, { status: 303, headers });
}

/**
 * GET /s/:token/download - Download shared file
 */
export async function downloadShareRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const token = c.req.param("token");
  const db = (c.env as any).DB as D1Database;
  const buckets = c.get("buckets");
  const theme = getTheme(c);

  const shareLink = await getShareLinkByToken(db, token);
  if (!shareLink) {
    return c.html(renderSharePage({ error: "Share link not found", theme }), 404);
  }

  // Check validity
  const validity = isShareLinkValid(shareLink);
  if (!validity.valid) {
    return c.html(renderSharePage({ error: validity.reason || "Link is invalid", theme }), 410);
  }

  // Check for password
  if (shareLink.password_hash) {
    const passwordCookie = c.req.header("Cookie")?.includes(`share_${token}=verified`);
    if (!passwordCookie) {
      return c.redirect(`/s/${token}`);
    }
  }

  // Get the bucket
  const bucketInfo = getBucketByBinding(buckets, shareLink.r2_bucket);
  if (!bucketInfo) {
    return c.html(renderSharePage({ error: "Storage not available", theme }), 500);
  }

  // Get optional file path for directory shares
  const url = new URL(c.req.url);
  let filePath = shareLink.r2_path;

  // For directory shares, allow downloading files within the directory
  if (shareLink.is_directory) {
    const requestedPath = url.searchParams.get("path");
    if (requestedPath) {
      // Ensure the requested path is within the share directory
      const normalizedBase = shareLink.r2_path.replace(/\/$/, "");
      const normalizedRequest = requestedPath.replace(/^\//, "");
      filePath = `${normalizedBase}/${normalizedRequest}`;
    } else {
      // Can't download a directory directly
      return c.html(
        renderSharePage({
          error: "Cannot download a directory. Please select a file.",
          theme,
        }),
        400
      );
    }
  }

  const object = await bucketInfo.bucket.get(filePath);
  if (!object) {
    return c.html(renderSharePage({ error: "File not found", theme }), 404);
  }

  // Increment download count
  await incrementDownloadCount(db, shareLink.id);

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Content-Length", object.size.toString());
  headers.set("ETag", object.httpEtag);

  const filename = filePath.split("/").pop() || "download";
  headers.set("Content-Disposition", formatContentDisposition(filename));

  if (object.uploaded) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  return new Response(object.body, { headers });
}

