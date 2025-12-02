import type { Context } from "hono";
import type { BucketInfo } from "../types";
import { getBucketByBinding } from "../utils/buckets";

export async function createFolderRoute(
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
  const path = formData.get("path") as string;
  const theme = (formData.get("theme") as string) || "system";

  if (!name) {
    return c.text("Folder name is required", 400);
  }

  // Sanitize folder name (remove slashes, etc.)
  const sanitizedName = name.replace(/[\/\\]/g, "").trim();
  if (!sanitizedName) {
    return c.text("Invalid folder name", 400);
  }

  // Build the folder key (folders in R2 are just keys ending with /)
  const folderKey = path ? `${path}${sanitizedName}/` : `${sanitizedName}/`;

  try {
    // Create folder by putting an empty object with key ending in /
    await bucketInfo.bucket.put(folderKey, "");

    // Redirect back to the parent directory
    const redirectPath = path
      ? `/b/${bucketBinding}/${path}`
      : `/b/${bucketBinding}/`;
    return c.redirect(`${redirectPath}?theme=${theme}`, 303);
  } catch (error) {
    return c.text(`Failed to create folder: ${String(error)}`, 500);
  }
}
