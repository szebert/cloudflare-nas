import type { Context } from "hono";
import type { BucketInfo, Theme } from "../types";
import { renderDetailsPage } from "../ui/details-page";
import { getBucketByBinding } from "../utils/buckets";
import { isImage } from "../utils/image-detection";

export interface FileDetails {
  name: string;
  fullPath: string;
  parentPath: string;
  isDirectory: boolean;
  size: number;
  modified: Date | null;
  contentType: string | null;
  customMetadata: Record<string, string>;
  storageClass: string | null;
  textContent?: string | null;
  isTooLargeForTextPreview?: boolean;
  isImage?: boolean;
}

async function getFileDetails(
  bucket: R2Bucket,
  filePath: string
): Promise<FileDetails | null> {
  const isDirectory = filePath.endsWith("/");
  const cleanPath = isDirectory ? filePath.slice(0, -1) : filePath;

  if (isDirectory) {
    // For directories, list contents to calculate size
    const prefix = cleanPath ? `${cleanPath}/` : "";
    const listed = await bucket.list({
      prefix,
      delimiter: "/",
      include: ["httpMetadata", "customMetadata"],
    });

    // Calculate total size of all files in directory
    let totalSize = 0;
    for (const obj of listed.objects) {
      totalSize += obj.size;
    }

    // Extract name and parent path
    const lastSlash = cleanPath.lastIndexOf("/");
    const name = lastSlash >= 0 ? cleanPath.slice(lastSlash + 1) : cleanPath;
    const parentPath = lastSlash >= 0 ? cleanPath.slice(0, lastSlash + 1) : "";

    return {
      name,
      fullPath: cleanPath,
      parentPath,
      isDirectory: true,
      size: totalSize,
      modified: null, // Directories don't have a modified date in R2
      contentType: null,
      customMetadata: {},
      storageClass: null,
    };
  } else {
    // For files, use head() to get metadata without downloading the body
    const head = await bucket.head(cleanPath);

    if (!head) {
      return null;
    }

    // Extract name and parent path
    const lastSlash = cleanPath.lastIndexOf("/");
    const name = lastSlash >= 0 ? cleanPath.slice(lastSlash + 1) : cleanPath;
    const parentPath = lastSlash >= 0 ? cleanPath.slice(0, lastSlash + 1) : "";

    const contentType = head.httpMetadata?.contentType || null;
    let textContent: string | null = null;
    let isTooLargeForTextPreview = false;

    // Skip preview for 0-byte files
    const isEmpty = head.size === 0;

    // Check if it's an image (does easy checks first, falls back to magic bytes if needed)
    let isImageFile = false;
    if (!isEmpty) {
      isImageFile = await isImage(
        contentType,
        name,
        bucket,
        cleanPath,
        head.size
      );
    }

    // Try to fetch text content for non-image files (images take priority)
    // Only try for files up to 1MB to avoid memory issues
    const MAX_TEXT_PREVIEW_SIZE = 1024 * 1024; // 1MB
    if (!isImageFile && !isEmpty) {
      if (head.size > MAX_TEXT_PREVIEW_SIZE) {
        isTooLargeForTextPreview = true;
      } else {
        try {
          const object = await bucket.get(cleanPath);
          if (object && object.body) {
            // Try to decode as text - if it fails, textContent stays null
            const arrayBuffer = await object.arrayBuffer();
            const decoder = new TextDecoder("utf-8", {
              fatal: false,
              ignoreBOM: false,
            });
            textContent = decoder.decode(arrayBuffer);
          }
        } catch (error) {
          // If we can't read the file as text, just leave textContent as null
          textContent = null;
        }
      }
    }

    return {
      name,
      fullPath: cleanPath,
      parentPath,
      isDirectory: false,
      size: head.size,
      modified: head.uploaded,
      contentType,
      customMetadata: head.customMetadata || {},
      storageClass: head.storageClass || null,
      textContent,
      isTooLargeForTextPreview,
      isImage: isImageFile,
    };
  }
}

export async function detailsPageRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");

  // Get the bucket info
  const bucketInfo = getBucketByBinding(buckets, bucketBinding);
  if (!bucketInfo) {
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  // Extract path from URL
  const url = new URL(c.req.url);
  const filePath = decodeURIComponent(url.pathname).replace(
    `/b/${bucketBinding}/details/`,
    ""
  );
  const theme = (url.searchParams.get("theme") as Theme) || "system";

  if (!filePath) {
    return c.text("File path is required", 400);
  }

  // Get file details
  const fileDetails = await getFileDetails(bucketInfo.bucket, filePath);

  if (!fileDetails) {
    return c.text("File or folder not found", 404);
  }

  const html = renderDetailsPage({
    bucketInfo,
    fileDetails,
    theme,
    buckets,
  });

  return c.html(html);
}

export async function detailsHandlerRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");

  // Get the bucket info
  const bucketInfo = getBucketByBinding(buckets, bucketBinding);
  if (!bucketInfo) {
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  // Parse form data
  const formData = await c.req.formData();
  const action = formData.get("action") as string;
  const theme = (formData.get("theme") as string) || "system";

  switch (action) {
    case "rename":
      return handleRename(c, bucketInfo, formData, theme);
    case "delete":
      return handleDelete(c, bucketInfo, formData, theme);
    default:
      return c.text(`Unknown action: ${action}`, 400);
  }
}

async function handleRename(
  c: Context,
  bucketInfo: BucketInfo,
  formData: FormData,
  theme: string
) {
  const oldFullPath = formData.get("oldFullPath") as string;
  const newFullPath = formData.get("newFullPath") as string;
  const isDirectory = formData.get("isDirectory") === "true";

  if (!oldFullPath || !newFullPath) {
    return c.text("Both old and new paths are required", 400);
  }

  // Normalize paths: remove leading/trailing slashes and normalize
  const normalizePath = (path: string): string => {
    return path.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
  };

  const normalizedOldPath = normalizePath(oldFullPath);
  const normalizedNewPath = normalizePath(newFullPath);

  // If paths are the same, redirect to the new details page
  if (normalizedOldPath === normalizedNewPath) {
    const redirectPath = `/b/${
      bucketInfo.binding
    }/details/${normalizedNewPath}${isDirectory ? "/" : ""}?theme=${theme}`;
    return c.redirect(redirectPath, 303);
  }

  // Validate new path doesn't contain invalid characters
  if (normalizedNewPath.includes("..") || normalizedNewPath.includes("//")) {
    return c.text("Invalid path", 400);
  }

  try {
    if (isDirectory) {
      // For directories, we need to move all objects with the prefix
      const oldPrefix = `${normalizedOldPath}/`;
      const newPrefix = `${normalizedNewPath}/`;

      // Check if destination already exists
      const checkDest = await bucketInfo.bucket.list({
        prefix: newPrefix,
        limit: 1,
      });
      if (
        checkDest.objects.length > 0 ||
        checkDest.delimitedPrefixes.length > 0
      ) {
        return c.text("Destination already exists", 409);
      }

      // List all objects with the old prefix
      const listed = await bucketInfo.bucket.list({ prefix: oldPrefix });
      const objects = listed.objects;

      if (objects.length === 0) {
        return c.text("Source directory not found or is empty", 404);
      }

      // Copy each object to the new location and delete the old one
      for (const obj of objects) {
        const newKey = obj.key.replace(oldPrefix, newPrefix);
        const source = await bucketInfo.bucket.get(obj.key);
        if (source) {
          await bucketInfo.bucket.put(newKey, source.body, {
            httpMetadata: source.httpMetadata,
            customMetadata: source.customMetadata,
          });
          await bucketInfo.bucket.delete(obj.key);
        }
      }
    } else {
      // For files, copy to new key and delete old
      const oldKey = normalizedOldPath;
      const newKey = normalizedNewPath;

      // Check if destination already exists
      const checkDest = await bucketInfo.bucket.head(newKey);
      if (checkDest) {
        return c.text("Destination already exists", 409);
      }

      const source = await bucketInfo.bucket.get(oldKey);
      if (!source) {
        return c.text(`File "${oldKey}" not found`, 404);
      }

      await bucketInfo.bucket.put(newKey, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
      });
      await bucketInfo.bucket.delete(oldKey);
    }

    // Redirect to the new details page
    const redirectPath = `/b/${
      bucketInfo.binding
    }/details/${normalizedNewPath}${isDirectory ? "/" : ""}?theme=${theme}`;
    return c.redirect(redirectPath, 303);
  } catch (error) {
    return c.text(`Failed to move/rename: ${String(error)}`, 500);
  }
}

async function handleDelete(
  c: Context,
  bucketInfo: BucketInfo,
  formData: FormData,
  theme: string
) {
  const parentPath = formData.get("parentPath") as string;
  const name = formData.get("name") as string;
  const isDirectory = formData.get("isDirectory") === "true";

  if (!name) {
    return c.text("Name is required", 400);
  }

  try {
    if (isDirectory) {
      // For directories, delete all objects with the prefix
      const prefix = parentPath ? `${parentPath}${name}/` : `${name}/`;

      // List all objects with the prefix
      const listed = await bucketInfo.bucket.list({ prefix });
      const objects = listed.objects;

      // Delete each object
      for (const obj of objects) {
        await bucketInfo.bucket.delete(obj.key);
      }
    } else {
      // For files, just delete the single object
      const key = parentPath ? `${parentPath}${name}` : name;
      await bucketInfo.bucket.delete(key);
    }

    // Redirect back to the parent directory
    const redirectPath = parentPath
      ? `/b/${bucketInfo.binding}/${parentPath}`
      : `/b/${bucketInfo.binding}/`;
    return c.redirect(`${redirectPath}?theme=${theme}`, 303);
  } catch (error) {
    return c.text(`Failed to delete: ${String(error)}`, 500);
  }
}
