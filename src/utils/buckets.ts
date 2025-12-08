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
