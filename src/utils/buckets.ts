import type { BucketInfo } from "../types";

/**
 * Dynamically discover R2 buckets from the environment
 * Uses duck-typing to identify R2Bucket bindings
 */
export function discoverBuckets(env: Env): BucketInfo[] {
  const buckets: BucketInfo[] = [];

  for (const [key, value] of Object.entries(env)) {
    if (isR2Bucket(value)) {
      buckets.push({
        binding: key,
        bucket: value,
      });
    }
  }

  // Sort alphabetically by binding name
  return buckets.sort((a, b) => a.binding.localeCompare(b.binding));
}

/**
 * Duck-type check if a value is an R2Bucket
 * R2Bucket has get, put, delete, list, head methods
 */
function isR2Bucket(value: unknown): value is R2Bucket {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  // Check for R2Bucket-specific methods
  return (
    typeof obj.get === "function" &&
    typeof obj.put === "function" &&
    typeof obj.delete === "function" &&
    typeof obj.list === "function" &&
    typeof obj.head === "function"
  );
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
