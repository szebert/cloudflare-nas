import type { Context } from "hono";
import { html } from "hono/html";
import type {
  BucketInfo,
  FileEntry,
  SortField,
  SortOrder,
  Theme,
} from "../types";
import { renderListing } from "../ui/listing-page";
import { getBucketByBinding } from "../utils/buckets";

export async function browseRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");

  // Get the bucket info
  const currentBucket = getBucketByBinding(buckets, bucketBinding);
  if (!currentBucket) {
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  const url = new URL(c.req.url);
  // Remove /b/:bucket prefix from path
  let path = decodeURIComponent(url.pathname)
    .replace(`/b/${bucketBinding}`, "")
    .replace(/^\/+/, "");

  // Ensure directory paths end with /
  if (path && !path.endsWith("/")) {
    path += "/";
  }

  // Get query params
  const themeParam = url.searchParams.get("theme");
  const theme: Theme =
    themeParam === "light" || themeParam === "dark" ? themeParam : "system";
  const sortField = (url.searchParams.get("sort") as SortField) || "name";
  const sortOrder = (url.searchParams.get("order") as SortOrder) || "asc";

  try {
    const entries = await listDirectory(currentBucket.bucket, path);
    const sortedEntries = sortEntries(entries, sortField, sortOrder);
    const totalSize = entries.reduce(
      (sum, e) => sum + (e.isDirectory ? 0 : e.size),
      0
    );

    const htmlContent = renderListing({
      path,
      entries: sortedEntries,
      theme,
      sortField,
      sortOrder,
      buckets,
      currentBucket,
      totalSize,
    });

    return c.html(htmlContent);
  } catch (error) {
    return c.html(
      html`<!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
          </head>
          <body>
            <h1>Error</h1>
            <p>Failed to list directory: ${String(error)}</p>
          </body>
        </html>`,
      500
    );
  }
}

async function listDirectory(
  bucket: R2Bucket,
  prefix: string
): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  const seenDirs = new Set<string>();

  const listed = await bucket.list({
    prefix: prefix || undefined,
    delimiter: "/",
    include: ["httpMetadata"],
  });

  // Add directories (common prefixes)
  for (const prefix of listed.delimitedPrefixes) {
    const name = prefix.replace(/\/$/, "").split("/").pop() || prefix;
    if (!seenDirs.has(name)) {
      seenDirs.add(name);
      entries.push({
        name,
        isDirectory: true,
        size: 0,
        modified: null,
        contentType: null,
      });
    }
  }

  // Add files
  for (const object of listed.objects) {
    // Skip the directory placeholder itself
    if (object.key === prefix || object.key.endsWith("/")) continue;

    const name = object.key.split("/").pop() || object.key;
    entries.push({
      name,
      isDirectory: false,
      size: object.size,
      modified: object.uploaded,
      contentType: object.httpMetadata?.contentType || null,
    });
  }

  return entries;
}

function sortEntries(
  entries: FileEntry[],
  field: SortField,
  order: SortOrder
): FileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Directories always first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let comparison = 0;
    switch (field) {
      case "name":
        comparison = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
        break;
      case "type":
        const aType = a.contentType || "";
        const bType = b.contentType || "";
        comparison = aType.localeCompare(bType, undefined, {
          sensitivity: "base",
        });
        break;
      case "modified":
        const aTime = a.modified?.getTime() || 0;
        const bTime = b.modified?.getTime() || 0;
        comparison = aTime - bTime;
        break;
      case "size":
        comparison = a.size - b.size;
        break;
    }

    return order === "desc" ? -comparison : comparison;
  });

  return sorted;
}
