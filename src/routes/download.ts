import type { Context } from "hono";
import type { BucketInfo } from "../types";
import { getBucketByBinding } from "../utils/buckets";
import { formatContentDisposition } from "../utils/format";

export async function downloadRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");

  // Get the bucket info
  const bucketInfo = getBucketByBinding(buckets, bucketBinding);
  if (!bucketInfo) {
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  const url = new URL(c.req.url);
  // Remove /b/:bucket/download prefix from path
  const key = decodeURIComponent(url.pathname).replace(
    `/b/${bucketBinding}/download/`,
    ""
  );

  if (!key) {
    return c.text("File not specified", 400);
  }

  const object = await bucketInfo.bucket.get(key);

  if (!object) {
    return c.text("File not found", 404);
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Content-Length", object.size.toString());
  headers.set("ETag", object.httpEtag);

  // Set Content-Disposition for download with proper encoding for non-ASCII filenames
  const filename = key.split("/").pop() || "download";
  headers.set("Content-Disposition", formatContentDisposition(filename));

  if (object.uploaded) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  return new Response(object.body, { headers });
}
