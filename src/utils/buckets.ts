import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createR2StorageBucket } from "../storage/r2-adapter";
import type { BucketInfo } from "../types";

/**
 * Dynamically discover R2 buckets from the environment and wrap them in storage adapters
 */
export function discoverBuckets(env: Env): BucketInfo[] {
  const buckets: BucketInfo[] = [];

  for (const [key, value] of Object.entries(env)) {
    if (isR2Bucket(value)) {
      buckets.push({
        binding: key,
        bucket: createR2StorageBucket(value),
      });
    }
  }

  // Sort alphabetically by binding name
  return buckets.sort((a, b) => a.binding.localeCompare(b.binding));
}

/**
 * Type guard to check if a value is an R2Bucket
 */
function isR2Bucket(value: unknown): value is R2Bucket {
  if (!value || typeof value !== "object") return false;

  return value.constructor.name === "R2Bucket";
}

/**
 * Get a specific bucket by binding name
 */
export function getBucketByBinding(
  buckets: BucketInfo[],
  binding: string
): BucketInfo | null {
  return buckets.find((b) => b.binding === binding) || null;
}

const BUCKET_COOKIE_NAME = "current_bucket";
const BUCKET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Get the current bucket from the cookie, or fallback to first bucket if not set
 */
export function getCurrentBucket(
  c: Context,
  buckets: BucketInfo[]
): BucketInfo | null {
  if (buckets.length === 0) {
    return null;
  }

  const bucketBinding = getCookie(c, BUCKET_COOKIE_NAME);
  if (bucketBinding) {
    const bucket = getBucketByBinding(buckets, bucketBinding);
    if (bucket) {
      return bucket;
    }
  }

  // Fallback to first bucket if cookie not set or invalid
  return buckets[0];
}

/**
 * Set the current bucket cookie
 */
export function setCurrentBucket(c: Context, binding: string): void {
  setCookie(c, BUCKET_COOKIE_NAME, binding, {
    path: "/",
    httpOnly: false, // Allow JS access if needed
    secure: true,
    sameSite: "Lax",
    maxAge: BUCKET_COOKIE_MAX_AGE,
  });
}
