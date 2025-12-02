import type { BucketInfo, SortField, SortOrder, Theme } from "../types";

export function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSizeShort(bytes: number): string {
  if (bytes === 0) return "-";
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

export function formatDate(date: Date | null): string {
  if (!date) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function buildSortUrl(
  bucket: BucketInfo,
  path: string,
  theme: Theme,
  field: SortField,
  currentField: SortField,
  currentOrder: SortOrder
): string {
  const newOrder =
    field === currentField && currentOrder === "asc" ? "desc" : "asc";
  const basePath = path
    ? `/b/${bucket.binding}/${path}`
    : `/b/${bucket.binding}/`;
  return `${basePath}?theme=${theme}&sort=${field}&order=${newOrder}`;
}

export function getSortIndicator(
  field: SortField,
  currentField: SortField,
  currentOrder: SortOrder
): string {
  if (field !== currentField) return "";
  return currentOrder === "asc" ? " ▲" : " ▼";
}

export function getParentPath(path: string): string | null {
  if (!path || path === "/") return null;
  const parts = path.replace(/\/$/, "").split("/");
  parts.pop();
  return parts.length > 0 ? parts.join("/") + "/" : "";
}

export function getFilePath(basePath: string, filename: string): string {
  return basePath ? `${basePath}${filename}` : filename;
}
