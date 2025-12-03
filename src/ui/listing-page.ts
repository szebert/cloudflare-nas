import type { BucketInfo, FileEntry, ListingOptions, Theme } from "../types";
import {
  buildSortUrl,
  formatDate,
  formatSize,
  formatSizeShort,
  getFilePath,
  getParentPath,
  getSortIndicator,
} from "../utils/format";
import {
  renderBucketSwitcher,
  renderNewMenu,
  renderThemeSwitcher,
} from "./components";
import { getThemeStyles } from "./styles";

export function renderListing(options: ListingOptions): string {
  const {
    path,
    entries,
    theme,
    sortField,
    sortOrder,
    buckets,
    currentBucket,
    totalSize,
  } = options;
  const parentPath = getParentPath(path);
  const displayPath = "/" + (path || "");
  const currentUrl = path
    ? `/b/${currentBucket.binding}/${path}`
    : `/b/${currentBucket.binding}/`;

  const fileCount = entries.filter((e) => !e.isDirectory).length;
  const dirCount = entries.filter((e) => e.isDirectory).length;

  const bucketSwitcher = renderBucketSwitcher(buckets, currentBucket, theme);
  const themeSwitcher = renderThemeSwitcher(currentBucket, path, theme);
  const newMenu = renderNewMenu();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${currentBucket.binding} - ${displayPath}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  ${getThemeStyles(theme)}
</head>
<body>
  <div class="header">
    <h1>Index of ${displayPath}</h1>
    <div class="header-controls">
      ${newMenu}
      ${bucketSwitcher}
      ${themeSwitcher}
    </div>
  </div>
  <hr>
  <div class="table-wrapper">
  <table>
    <thead>
      <tr>
        <th class="name"><a href="${buildSortUrl(
          currentBucket,
          path,
          theme,
          "name",
          sortField,
          sortOrder
        )}">Name${getSortIndicator("name", sortField, sortOrder)}</a></th>
        <th class="modified"><a href="${buildSortUrl(
          currentBucket,
          path,
          theme,
          "modified",
          sortField,
          sortOrder
        )}">Modified${getSortIndicator(
    "modified",
    sortField,
    sortOrder
  )}</a></th>
        <th class="size"><a href="${buildSortUrl(
          currentBucket,
          path,
          theme,
          "size",
          sortField,
          sortOrder
        )}">Size${getSortIndicator("size", sortField, sortOrder)}</a></th>
        <th class="actions"></th>
      </tr>
    </thead>
    <tbody>
${
  parentPath !== null
    ? `<tr>
        <td class="name"><a href="/b/${currentBucket.binding}/${parentPath}?theme=${theme}">📁 ..</a></td>
        <td class="modified">-</td>
        <td class="size">-</td>
        <td class="actions"></td>
      </tr>`
    : ""
}
${entries
  .map((entry) => renderRow(entry, currentBucket, path, theme))
  .join("\n")}
    </tbody>
  </table>
  </div>
  <hr>
  <div class="footer">
    <div class="footer-stats">
      ${
        dirCount > 0
          ? `<span class="stat"><span class="stat-label">Folders:</span> ${dirCount}</span>`
          : ""
      }
      ${
        fileCount > 0
          ? `<span class="stat"><span class="stat-label">Files:</span> ${fileCount}</span>`
          : ""
      }
      ${
        totalSize > 0
          ? `<span class="stat"><span class="stat-label">Total:</span> ${formatSize(
              totalSize
            )}</span>`
          : ""
      }
    </div>
    <div class="footer-info">
      ${currentBucket.binding}
    </div>
  </div>

  <!-- New Folder Modal -->
  <div id="new-folder" class="modal-overlay">
    <div class="modal">
      <h2>📁 New Folder</h2>
      <form class="modal-form" method="POST" action="/b/${
        currentBucket.binding
      }/folder">
        <input type="hidden" name="path" value="${path}">
        <input type="hidden" name="theme" value="${theme}">
        <input type="text" name="name" placeholder="Folder name" required autofocus>
        <div class="modal-buttons">
          <a href="${currentUrl}?theme=${theme}" class="btn-cancel">Cancel</a>
          <button type="submit" class="btn-primary">Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- New File Modal -->
  <div id="new-file" class="modal-overlay">
    <div class="modal modal-wide">
      <h2>📄 New File</h2>
      <form class="modal-form" method="POST" action="/b/${
        currentBucket.binding
      }/file">
        <input type="hidden" name="path" value="${path}">
        <input type="hidden" name="theme" value="${theme}">
        <input type="text" name="name" placeholder="filename.txt" required autofocus>
        <textarea name="content" placeholder="File content (optional)" rows="8"></textarea>
        <div class="modal-buttons">
          <a href="${currentUrl}?theme=${theme}" class="btn-cancel">Cancel</a>
          <button type="submit" class="btn-primary">Create</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}

function renderRow(
  entry: FileEntry,
  bucket: BucketInfo,
  basePath: string,
  theme: Theme
): string {
  const filePath = getFilePath(basePath, entry.name);
  const icon = entry.isDirectory ? "📁" : "📄";
  const href = entry.isDirectory
    ? `/b/${bucket.binding}/${filePath}/?theme=${theme}`
    : `/b/${bucket.binding}/download/${filePath}`;
  const displayName = entry.isDirectory ? `${entry.name}/` : entry.name;

  const actionsMenu = `
  <div class="actions-menu">
    <button class="actions-btn" type="button">⋮</button>
    <div class="actions-popup">
      <button type="button">Rename</button>
      <button type="button">Update Metadata</button>
      <button type="button">Get Sharable Link</button>
      <button type="button" class="danger">Delete</button>
    </div>
  </div>`;

  return `
  <tr>
    <td class="name"><a href="${href}">${icon} ${displayName}</a></td>
    <td class="modified">${formatDate(entry.modified)}</td>
    <td class="size">${
      entry.isDirectory ? "-" : formatSizeShort(entry.size)
    }</td>
    <td class="actions">${actionsMenu}</td>
  </tr>`;
}
