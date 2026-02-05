/**
 * Share listing page - read-only directory browsing for shared folders
 */

import type { FileEntry, SortField, SortOrder, Theme } from "../types";
import {
  escapeHtml,
  formatDateString,
  formatISOString,
  formatSize,
  getSortIndicator,
} from "../utils/format";
import { renderHead } from "./components";

export interface ShareListingOptions {
  token: string;
  sharePath: string;
  relativePath: string;
  entries: FileEntry[];
  theme: Theme;
  sortField: SortField;
  sortOrder: SortOrder;
  totalSize: number;
  expiresAt: number | null;
  maxDownloads: number | null;
  downloadCount: number;
}

function buildShareSortUrl(
  token: string,
  relativePath: string,
  field: SortField,
  currentField: SortField,
  currentOrder: SortOrder
): string {
  const newOrder =
    field === currentField && currentOrder === "asc" ? "desc" : "asc";
  const basePath = relativePath
    ? `/s/${token}/${relativePath}`
    : `/s/${token}/`;
  return `${basePath}?sort=${field}&order=${newOrder}`;
}

function getShareParentPath(relativePath: string): string | null {
  if (!relativePath || relativePath === "/") return null;
  const parts = relativePath.replace(/\/$/, "").split("/").filter(Boolean);
  parts.pop();
  // Return empty string for root (one level deep), or the joined path with trailing slash
  return parts.length > 0 ? parts.join("/") + "/" : "";
}

export function renderShareListing(options: ShareListingOptions): string {
  const {
    token,
    sharePath,
    relativePath,
    entries,
    theme,
    sortField,
    sortOrder,
    totalSize,
    expiresAt,
    maxDownloads,
    downloadCount,
  } = options;

  const parentRelativePath = getShareParentPath(relativePath);

  // Extract the shared folder name from sharePath for display
  const shareFolderName = sharePath.split("/").filter(Boolean).pop() || sharePath || "Shared Folder";

  // Build display path: show the shared folder name at root, then relative path
  const displayPath = relativePath
    ? `/${shareFolderName}/${relativePath}`
    : `/${shareFolderName}`;

  const currentUrl = relativePath ? `/s/${token}/${relativePath}` : `/s/${token}/`;

  const fileCount = entries.filter((e) => !e.isDirectory).length;
  const dirCount = entries.filter((e) => e.isDirectory).length;

  // Build breadcrumbs - start with the shared folder name
  const breadcrumbs: Array<{ name: string; path: string }> = [
    { name: shareFolderName, path: `/s/${token}/` },
  ];
  if (relativePath) {
    const parts = relativePath.replace(/\/$/, "").split("/").filter(Boolean);
    let currentPath = "";
    for (const part of parts) {
      currentPath += `${part}/`;
      breadcrumbs.push({
        name: part,
        path: `/s/${token}/${currentPath}`,
      });
    }
  }

  const breadcrumbHtml = breadcrumbs
    .map((crumb, index) => {
      if (index === breadcrumbs.length - 1) {
        return `<span class="breadcrumb-current">${escapeHtml(crumb.name)}</span>`;
      }
      return `<a href="${crumb.path}" class="breadcrumb-link">${escapeHtml(crumb.name)}</a> <span class="breadcrumb-separator">/</span>`;
    })
    .join(" ");

  // Share info banner
  const expiresInfo = expiresAt
    ? `Expires: ${formatISOString(new Date(expiresAt))}`
    : "No expiration";
  const downloadsInfo = maxDownloads
    ? `Downloads: ${downloadCount} / ${maxDownloads}`
    : `Downloads: ${downloadCount}`;

  const disabledShareButton = `<button disabled class="btn btn-action">🔗 Shared Folder</button>`;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({
    title: `Shared Folder${displayPath !== "/" ? ` - ${displayPath}` : ""}`,
    theme,
  })}
<body>
  <div class="header">
    <h1>Index of ${displayPath}</h1>
    <div class="header-controls">
      ${disabledShareButton}
    </div>
  </div>
  <hr>
  <div class="table-wrapper">
  <table>
    <thead>
      <tr>
        <th><a href="${buildShareSortUrl(
    token,
    relativePath,
    "name",
    sortField,
    sortOrder
  )}">Name${getSortIndicator("name", sortField, sortOrder)}</a></th>
        <th class="col-type"><a href="${buildShareSortUrl(
    token,
    relativePath,
    "type",
    sortField,
    sortOrder
  )}">Type${getSortIndicator("type", sortField, sortOrder)}</a></th>
        <th class="col-time"><a href="${buildShareSortUrl(
    token,
    relativePath,
    "modified",
    sortField,
    sortOrder
  )}">Modified${getSortIndicator(
    "modified",
    sortField,
    sortOrder
  )}</a></th>
        <th class="col-size"><a href="${buildShareSortUrl(
    token,
    relativePath,
    "size",
    sortField,
    sortOrder
  )}">Size${getSortIndicator("size", sortField, sortOrder)}</a></th>
      </tr>
    </thead>
    <tbody>
${parentRelativePath !== null
      ? `<tr>
        <td><a href="/s/${token}/${parentRelativePath}">📁 ..</a></td>
        <td class="col-type">-</td>
        <td class="col-time">-</td>
        <td class="col-size">-</td>
      </tr>`
      : ""
    }
${entries.length === 0 && parentRelativePath === null
      ? `<tr>
        <td class="empty" colspan="4">This folder is empty</td>
      </tr>`
      : entries
        .map((entry) => renderShareRow(entry, token, sharePath, relativePath))
        .join("\n")
    }
    </tbody>
  </table>
  </div>
  <hr>
  <div class="footer">
    <div class="footer-stats">
      <span class="stat"><span class="stat-label">Folders:</span> ${dirCount}</span>
      <span class="stat"><span class="stat-label">Files:</span> ${fileCount}</span>
      <span class="stat"><span class="stat-label">Total:</span> ${formatSize(
      totalSize
    )}</span>
    </div>
    <div class="footer-info">
      Read-only shared folder
    </div>
  </div>
</body>
</html>`;
}

function renderShareRow(
  entry: FileEntry,
  token: string,
  sharePath: string,
  relativePath: string
): string {
  // Build the relative path for this entry
  const entryRelativePath = relativePath
    ? `${relativePath}${entry.name}`
    : entry.name;

  const icon = entry.isDirectory ? "📁" : "📄";

  // For directories, link to browse; for files, link to download
  const href = entry.isDirectory
    ? `/s/${token}/${entryRelativePath}${entry.isDirectory ? "/" : ""}`
    : `/s/${token}/download?path=${encodeURIComponent(entryRelativePath)}`;

  const displayName = entry.isDirectory ? `${entry.name}/` : entry.name;

  const typeDisplay = entry.isDirectory
    ? "Folder"
    : entry.contentType
      ? entry.contentType
      : "-";

  const isoString = formatISOString(entry.modified);
  let modifiedCell = "-";
  if (entry.modified && isoString !== "-") {
    modifiedCell = `
      <span class="date-display">
        <span class="mobile-hidden">${isoString}</span>
        <span class="mobile-visible">${formatDateString(entry.modified)}</span>
      </span>`;
  }

  return `
  <tr>
    <td><a href="${href}">${icon} ${escapeHtml(displayName)}</a></td>
    <td class="col-type">${escapeHtml(typeDisplay)}</td>
    <td class="col-time">${modifiedCell}</td>
    <td class="col-size">${entry.isDirectory ? "-" : formatSize(entry.size)}</td>
  </tr>`;
}

