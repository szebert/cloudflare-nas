import type { StorageBucket } from "./storage/interface";

export type Theme = "light" | "dark" | "system";
export type SortField = "name" | "type" | "modified" | "size";
export type SortOrder = "asc" | "desc";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: Date | null;
  contentType: string | null;
}

export interface BucketInfo {
  binding: string;
  bucket: StorageBucket;
}

export interface ListingOptions {
  path: string;
  entries: FileEntry[];
  theme: Theme;
  sortField: SortField;
  sortOrder: SortOrder;
  buckets: BucketInfo[];
  currentBucket: BucketInfo;
  totalSize: number;
}
