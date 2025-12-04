import type { Context } from "hono";
import type { BucketInfo, Theme } from "../types";
import { renderActionsPage } from "../ui/actions-page";
import { getBucketByBinding } from "../utils/buckets";

export async function actionsPageRoute(
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
    `/b/${bucketBinding}/actions/`,
    ""
  );
  const theme = (url.searchParams.get("theme") as Theme) || "system";

  // Determine if it's a directory (path ends with /)
  const isDirectory = filePath.endsWith("/");
  const cleanPath = isDirectory ? filePath.slice(0, -1) : filePath;

  // Extract name and parent path
  const lastSlash = cleanPath.lastIndexOf("/");
  const name = lastSlash >= 0 ? cleanPath.slice(lastSlash + 1) : cleanPath;
  const parentPath = lastSlash >= 0 ? cleanPath.slice(0, lastSlash + 1) : "";

  const html = renderActionsPage({
    bucketBinding,
    name,
    parentPath,
    fullPath: cleanPath,
    isDirectory,
    theme,
  });

  return c.html(html);
}

export async function actionsHandlerRoute(
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
  const parentPath = formData.get("parentPath") as string;
  const oldName = formData.get("oldName") as string;
  const newName = formData.get("newName") as string;
  const isDirectory = formData.get("isDirectory") === "true";

  if (!oldName || !newName) {
    return c.text("Both old and new names are required", 400);
  }

  // Sanitize new name (remove slashes)
  const sanitizedNewName = newName.replace(/[\/\\]/g, "").trim();
  if (!sanitizedNewName) {
    return c.text("Invalid new name", 400);
  }

  // If names are the same, just redirect back
  if (oldName === sanitizedNewName) {
    const redirectPath = parentPath
      ? `/b/${bucketInfo.binding}/${parentPath}`
      : `/b/${bucketInfo.binding}/`;
    return c.redirect(`${redirectPath}?theme=${theme}`, 303);
  }

  try {
    if (isDirectory) {
      // For directories, we need to rename all objects with the prefix
      const oldPrefix = parentPath ? `${parentPath}${oldName}/` : `${oldName}/`;
      const newPrefix = parentPath
        ? `${parentPath}${sanitizedNewName}/`
        : `${sanitizedNewName}/`;

      // List all objects with the old prefix
      const listed = await bucketInfo.bucket.list({ prefix: oldPrefix });
      const objects = listed.objects;

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
      const oldKey = parentPath ? `${parentPath}${oldName}` : oldName;
      const newKey = parentPath
        ? `${parentPath}${sanitizedNewName}`
        : sanitizedNewName;

      const source = await bucketInfo.bucket.get(oldKey);
      if (!source) {
        return c.text(`File "${oldName}" not found`, 404);
      }

      await bucketInfo.bucket.put(newKey, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
      });
      await bucketInfo.bucket.delete(oldKey);
    }

    // Redirect back to the parent directory
    const redirectPath = parentPath
      ? `/b/${bucketInfo.binding}/${parentPath}`
      : `/b/${bucketInfo.binding}/`;
    return c.redirect(`${redirectPath}?theme=${theme}`, 303);
  } catch (error) {
    return c.text(`Failed to rename: ${String(error)}`, 500);
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
