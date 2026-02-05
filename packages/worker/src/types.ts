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

export interface User {
  id: string;
  username: string;
  is_admin: boolean;
  must_change_password: boolean;
}

export interface ShareLink {
  id: string;
  token: string;
  created_by: string;
  r2_bucket: string;
  r2_path: string;
  is_directory: boolean;
  has_password: boolean;
  expires_at: number | null;
  max_downloads: number | null;
  download_count: number;
  created_at: number;
}

export interface Share {
  id: string;
  slug: string;
  r2_bucket: string;
  r2_prefix: string;
  owner_user_id: string;
  quota_bytes: number | null;
  created_at: number;
}
