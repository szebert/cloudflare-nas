import type { BucketInfo, SortField, SortOrder, Theme } from "../types";

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDateUTC(date: Date | null): string {
  if (!date) return "-";
  return date.toISOString();
}

export function formatDateUTCDateOnly(date: Date | null): string {
  if (!date) return "-";
  // Format as YYYY-MM-DD (date only)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getFileType(contentType: string | null): string {
  if (!contentType) return "-";
  return contentType;
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

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
