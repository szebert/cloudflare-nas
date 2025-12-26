import type { BucketInfo, FileEntry, ListingOptions } from "../types";
import {
  buildSortUrl,
  formatDateUTC,
  formatDateUTCDateOnly,
  formatSize,
  getFilePath,
  getFileType,
  getParentPath,
  getSortIndicator,
} from "../utils/format";
import {
  renderBucketSwitcher,
  renderHead,
  renderNewMenu,
} from "./components";

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

  const bucketSwitcher = renderBucketSwitcher(buckets, currentBucket);
  const newMenu = renderNewMenu();
  const settingsLink = `<a href="/b/${currentBucket.binding}/settings" class="btn action-btn">⚙️ Settings</a>`;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({
    title: `${currentBucket.binding} - ${displayPath}`,
    theme,
  })}
<body>
  <div class="header">
    <h1>Index of ${displayPath}</h1>
    <div class="header-controls">
      ${newMenu}
      ${bucketSwitcher}
      ${settingsLink}
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
    "name",
    sortField,
    sortOrder
  )}">Name${getSortIndicator("name", sortField, sortOrder)}</a></th>
        <th class="type"><a href="${buildSortUrl(
    currentBucket,
    path,
    "type",
    sortField,
    sortOrder
  )}">Type${getSortIndicator("type", sortField, sortOrder)}</a></th>
        <th class="modified"><a href="${buildSortUrl(
    currentBucket,
    path,
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
    "size",
    sortField,
    sortOrder
  )}">Size${getSortIndicator("size", sortField, sortOrder)}</a></th>
        <th class="details"></th>
      </tr>
    </thead>
    <tbody>
${parentPath !== null
      ? `<tr>
        <td class="name"><a href="/b/${currentBucket.binding}/${parentPath}">📁 ..</a></td>
        <td class="type">-</td>
        <td class="modified">-</td>
        <td class="size">-</td>
        <td class="details"></td>
      </tr>`
      : ""
    }
${entries.length === 0 && parentPath === null
      ? `<tr>
        <td class="name empty-message" colspan="5">This folder is empty</td>
      </tr>`
      : entries
        .map((entry) => renderRow(entry, currentBucket, path))
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
      ${currentBucket.binding}
    </div>
  </div>

  <!-- New Folder Modal -->
  <div id="new-folder" class="modal-overlay">
    <div class="modal">
      <h2>📁 New Folder</h2>
      <form class="modal-form" method="POST" action="/b/${currentBucket.binding}/folder">
        <input type="hidden" name="path" value="${path}">
        <input type="text" name="name" placeholder="Folder name" required autofocus>
        <div class="modal-buttons">
          <a href="${currentUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-success">Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- New File Modal -->
  <div id="new-file" class="modal-overlay">
    <div class="modal modal-wide">
      <h2>📄 New File</h2>
      <form class="modal-form" method="POST" action="/b/${currentBucket.binding}/file">
        <input type="hidden" name="path" value="${path}">
        <input type="text" name="name" placeholder="filename.txt" required autofocus>
        <textarea name="content" placeholder="File content (optional)" rows="8"></textarea>
        <div class="modal-buttons">
          <a href="${currentUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-success">Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Upload Files Modal -->
  <div id="upload-files" class="modal-overlay">
    <div class="modal">
      <h2>📤 Upload Files</h2>
      <form class="modal-form" method="POST" action="/b/${currentBucket.binding}/upload" enctype="multipart/form-data">
        <input type="hidden" name="path" value="${path}">
        <div class="file-input-wrapper">
          <input type="file" name="files" multiple required>
          <p class="file-hint">Select one or more files to upload</p>
        </div>
        <div class="modal-buttons">
          <a href="${currentUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-success">Upload</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Upload Folder Modal -->
  <div id="upload-folder" class="modal-overlay">
    <div class="modal">
      <h2>📂 Upload Folder</h2>
      <form class="modal-form" method="POST" action="/b/${currentBucket.binding}/upload-folder" enctype="multipart/form-data">
        <input type="hidden" name="path" value="${path}">
        <div class="file-input-wrapper">
          <input type="file" name="files" webkitdirectory multiple required>
          <p class="file-hint">Select a folder to upload (preserves folder structure)</p>
        </div>
        <div class="modal-buttons">
          <a href="${currentUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-success">Upload</button>
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
  basePath: string
): string {
  const filePath = getFilePath(basePath, entry.name);
  const icon = entry.isDirectory ? "📁" : "📄";
  const href = entry.isDirectory
    ? `/b/${bucket.binding}/${filePath}/`
    : `/b/${bucket.binding}/download/${filePath}`;
  const displayName = entry.isDirectory ? `${entry.name}/` : entry.name;
  const detailsUrl = `/b/${bucket.binding}/details/${filePath}${entry.isDirectory ? "/" : ""}`;

  const detailsLink = `<a href="${detailsUrl}" class="details-link" title="Details">⋮</a>`;
  const typeDisplay = entry.isDirectory
    ? "Folder"
    : getFileType(entry.contentType);
  const isoString = formatDateUTC(entry.modified);
  const dateOnly = formatDateUTCDateOnly(entry.modified);
  let modifiedCell = "-";
  if (entry.modified && isoString !== "-") {
    modifiedCell = `<span class="date-display"><span class="date-iso">${isoString}</span><span class="date-only">${dateOnly}</span></span>`;
  }

  return `
  <tr>
    <td class="name"><a href="${href}">${icon} ${displayName}</a></td>
    <td class="type">${typeDisplay}</td>
    <td class="modified">${modifiedCell}</td>
    <td class="size">${entry.isDirectory ? "-" : formatSize(entry.size)}</td>
    <td class="details">${detailsLink}</td>
  </tr>`;
}
