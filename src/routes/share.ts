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
import type { BucketInfo, SortField, SortOrder } from "../types";
import { renderShareListing } from "../ui/share-listing-page";
import { renderSharePage, renderSharePasswordPage } from "../ui/share-page";
import { getBucketByBinding, setCurrentBucket } from "../utils/buckets";
import { formatContentDisposition } from "../utils/format";
import {
  buildSharePath,
  isPathWithinShare
} from "../utils/share";
import { getTheme } from "../utils/theme";
import { getOrigin } from "../utils/url";
import { listDirectory, sortEntries } from "./browse";

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
    // For directories, redirect to browse route
    return c.redirect(`/s/${token}/`);
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
    const requestedRelativePath = url.searchParams.get("path");
    if (requestedRelativePath) {
      // Validate that the requested path is within the share scope
      const fullRequestedPath = buildSharePath(
        shareLink.r2_path,
        requestedRelativePath
      );

      if (!isPathWithinShare(shareLink.r2_path, fullRequestedPath)) {
        return c.html(
          renderSharePage({
            error: "Access denied: Path is outside the shared directory scope.",
            theme,
          }),
          403
        );
      }

      filePath = fullRequestedPath;
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

/**
 * GET /s/:token/* - Browse shared directory (public)
 */
export async function browseShareRoute(
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

  // Only allow browsing directories
  if (!shareLink.is_directory) {
    return c.redirect(`/s/${token}/download`);
  }

  // Get the bucket
  const bucketInfo = getBucketByBinding(buckets, shareLink.r2_bucket);
  if (!bucketInfo) {
    return c.html(renderSharePage({ error: "Storage not available", theme }), 500);
  }

  // Extract relative path from URL by parsing the pathname directly
  // This is more reliable than using Hono's wildcard param
  const url = new URL(c.req.url);
  const pathPrefix = `/s/${token}/`;
  let relativePath = "";

  if (url.pathname.startsWith(pathPrefix)) {
    relativePath = decodeURIComponent(url.pathname.slice(pathPrefix.length));
  }

  // Normalize relative path - ensure it ends with / for directories
  if (relativePath && !relativePath.endsWith("/")) {
    relativePath += "/";
  }

  // Build the full R2 path
  // When at root (relativePath is ""), fullPath will be the sharePath itself
  // When in a subfolder, fullPath will be sharePath + "/" + relativePath
  const fullPath = buildSharePath(shareLink.r2_path, relativePath);

  // Validate that the requested path is within the share scope
  if (!isPathWithinShare(shareLink.r2_path, fullPath)) {
    return c.html(
      renderSharePage({
        error: "Access denied: Path is outside the shared directory scope.",
        theme,
      }),
      403
    );
  }

  // Ensure the path ends with / for directory listing
  // This is critical: listDirectory needs the prefix to end with / to list contents
  // When sharePath is "a" and relativePath is "", fullPath is "a", so listPrefix becomes "a/"
  // This ensures we list the CONTENTS of "a", not "a" itself or its siblings
  // The trailing slash tells R2 to list the directory contents, not the directory itself
  let listPrefix = fullPath.endsWith("/") ? fullPath : `${fullPath}/`;

  // Double-check: if listPrefix doesn't start with sharePath + "/", something is wrong
  // This shouldn't happen, but it's a safety check
  const normalizedSharePath = shareLink.r2_path.replace(/\/$/, "");
  if (!listPrefix.startsWith(normalizedSharePath + "/") && listPrefix !== normalizedSharePath + "/") {
    // This should never happen due to validation above, but just in case
    listPrefix = `${normalizedSharePath}/${relativePath || ""}`.replace(/\/+$/, "") + "/";
  }

  // Get sorting parameters (reuse url from above)
  const sortField = (url.searchParams.get("sort") as SortField) || "name";
  const sortOrder = (url.searchParams.get("order") as SortOrder) || "asc";

  try {
    // List directory contents
    // Note: listDirectory expects a prefix that ends with / to list directory contents
    // When sharePath is "a" and we're at root, listPrefix is "a/", which should
    // only return contents of "a/", not "a" itself or siblings
    const entries = await listDirectory(bucketInfo.bucket, listPrefix);

    // The listDirectory function should already filter correctly based on the prefix,
    // but we need to ensure we're not getting the share folder itself or siblings.
    // When at root (relativePath is empty), we should only see contents of the share folder.
    // The prefix "a/" should prevent "a" and "asdf" from appearing, but let's be extra safe.
    const filteredEntries = entries;

    const sortedEntries = sortEntries(filteredEntries, sortField, sortOrder);
    const totalSize = filteredEntries.reduce(
      (sum, e) => sum + (e.isDirectory ? 0 : e.size),
      0
    );

    // Render share listing
    const htmlContent = renderShareListing({
      token: shareLink.token,
      sharePath: shareLink.r2_path,
      relativePath,
      entries: sortedEntries,
      theme,
      sortField,
      sortOrder,
      totalSize,
      expiresAt: shareLink.expires_at,
      maxDownloads: shareLink.max_downloads,
      downloadCount: shareLink.download_count,
    });

    return c.html(htmlContent);
  } catch (error) {
    return c.html(
      renderSharePage({
        error: `Failed to list directory: ${String(error)}`,
        theme,
      }),
      500
    );
  }
}

