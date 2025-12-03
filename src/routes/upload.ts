import type { Context } from "hono";
import type { BucketInfo } from "../types";
import { getBucketByBinding } from "../utils/buckets";

export async function uploadFilesRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");

  // Get the bucket info
  const bucketInfo = getBucketByBinding(buckets, bucketBinding);
  if (!bucketInfo) {
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  // Parse multipart form data
  const formData = await c.req.formData();
  const path = formData.get("path") as string;
  const theme = (formData.get("theme") as string) || "system";
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return c.text("No files selected", 400);
  }

  const errors: string[] = [];
  let successCount = 0;

  for (const file of files) {
    // Skip empty entries (can happen with empty file inputs)
    if (!file.name || file.size === 0) continue;

    // Sanitize filename (remove path separators that might be in the name)
    const sanitizedName = file.name.replace(/[\/\\]/g, "_").trim();
    if (!sanitizedName) continue;

    // Build the file key
    const fileKey = path ? `${path}${sanitizedName}` : sanitizedName;

    try {
      // Get file content as ArrayBuffer and upload
      const arrayBuffer = await file.arrayBuffer();
      await bucketInfo.bucket.put(fileKey, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
        },
      });
      successCount++;
    } catch (error) {
      errors.push(`Failed to upload ${file.name}: ${String(error)}`);
    }
  }

  if (errors.length > 0 && successCount === 0) {
    return c.text(`Upload failed:\n${errors.join("\n")}`, 500);
  }

  // Redirect back to the parent directory
  const redirectPath = path
    ? `/b/${bucketBinding}/${path}`
    : `/b/${bucketBinding}/`;
  return c.redirect(`${redirectPath}?theme=${theme}`, 303);
}
