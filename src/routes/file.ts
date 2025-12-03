import type { Context } from "hono";
import type { BucketInfo } from "../types";
import { getBucketByBinding } from "../utils/buckets";

export async function createFileRoute(
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
  const name = formData.get("name") as string;
  const content = formData.get("content") as string;
  const path = formData.get("path") as string;
  const theme = (formData.get("theme") as string) || "system";

  if (!name) {
    return c.text("File name is required", 400);
  }

  // Sanitize file name (remove path separators)
  const sanitizedName = name.replace(/[\/\\]/g, "").trim();
  if (!sanitizedName) {
    return c.text("Invalid file name", 400);
  }

  // Build the file key
  const fileKey = path ? `${path}${sanitizedName}` : sanitizedName;

  try {
    // Create file with provided content (or empty string)
    await bucketInfo.bucket.put(fileKey, content || "");

    // Redirect back to the parent directory
    const redirectPath = path
      ? `/b/${bucketBinding}/${path}`
      : `/b/${bucketBinding}/`;
    return c.redirect(`${redirectPath}?theme=${theme}`, 303);
  } catch (error) {
    return c.text(`Failed to create file: ${String(error)}`, 500);
  }
}
