import type { FileDetails } from "../routes/details";
import type { BucketInfo, Theme } from "../types";
import { escapeHtml, formatDateUTC, formatSize } from "../utils/format";
import { renderThemeSwitcher } from "./components";

export interface DetailsPageOptions {
  bucketInfo: BucketInfo;
  fileDetails: FileDetails;
  theme: Theme;
  buckets: BucketInfo[];
}

function buildBreadcrumbs(
  bucketBinding: string,
  fullPath: string,
  theme: Theme
): string {
  const parts = fullPath ? fullPath.split("/").filter((p) => p) : [];
  const breadcrumbs: Array<{ name: string; path: string }> = [
    { name: bucketBinding, path: `/b/${bucketBinding}/` },
  ];

  let currentPath = "";
  for (const part of parts) {
    currentPath += `${part}/`;
    breadcrumbs.push({
      name: part,
      path: `/b/${bucketBinding}/${currentPath}`,
    });
  }

  return breadcrumbs
    .map((b, i) => {
      if (i === breadcrumbs.length - 1) {
        return `<span>${b.name}</span>`;
      }
      return `<a href="${b.path}?theme=${theme}">${b.name}</a>`;
    })
    .join(" / ");
}

export function renderDetailsPage(options: DetailsPageOptions): string {
  const { bucketInfo, fileDetails, theme, buckets } = options;
  const {
    name,
    fullPath,
    parentPath,
    isDirectory,
    size,
    modified,
    contentType,
    customMetadata,
    storageClass,
    textContent,
    isTooLargeForTextPreview,
    isImage: isImageFile,
  } = fileDetails;

  const breadcrumbs = buildBreadcrumbs(bucketInfo.binding, fullPath, theme);
  const currentDetailsUrl = `/b/${bucketInfo.binding}/details/${fullPath}${
    isDirectory ? "/" : ""
  }?theme=${theme}`;

  const downloadUrl = `/b/${bucketInfo.binding}/download/${fullPath}`;
  const imageUrl = isImageFile
    ? `/b/${bucketInfo.binding}/download/${fullPath}`
    : null;
  const deleteModalId = `delete-${fullPath.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const displayPath = "/" + (fullPath || "");
  const themeSwitcher = renderThemeSwitcher(bucketInfo, fullPath, theme, {
    isDetailsPage: true,
    isDirectory,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - Details</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/style.css?theme=${theme}">
</head>
<body>
  <div class="header">
    <h1>Details of ${displayPath}</h1>
    <div class="header-controls">
      ${themeSwitcher}
    </div>
  </div>
  <hr>
  <div class="file-details-page">
    <div class="breadcrumbs">
      ${breadcrumbs}
    </div>

    <div class="action-buttons">
      ${
        !isDirectory
          ? `<a href="${downloadUrl}?theme=${theme}" class="btn-download">⬇️ Download</a>`
          : ""
      }
      <a href="#move-rename-modal" class="btn-rename">📦 Move/Rename</a>
      <a href="#${deleteModalId}" class="btn-delete">🗑️ Delete</a>
    </div>

    <div class="details-section">
      <h2>Object Details</h2>
      <div class="details-grid">
        <div class="detail-label">Date Created:</div>
        <div class="detail-value">${formatDateUTC(modified)}</div>
        <div class="detail-label">Type:</div>
        <div class="detail-value">${contentType || "-"}</div>
        <div class="detail-label">Storage Class:</div>
        <div class="detail-value">${storageClass || "-"}</div>
        <div class="detail-label">Size:</div>
        <div class="detail-value">${formatSize(size)}</div>
      </div>
    </div>

    <div class="metadata-section">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
        <h2 style="margin: 0;">Custom Metadata</h2>
        <div style="display: flex; gap: 8px;">
          <a href="#metadata-add-modal" class="btn-rename" style="font-size: 12px; padding: 6px 12px;">➕ Add</a>
          ${
            Object.keys(customMetadata).length > 0
              ? `<a href="#metadata-edit-modal" class="btn-rename" style="font-size: 12px; padding: 6px 12px;">✏️ Edit</a>`
              : ""
          }
        </div>
      </div>
      ${
        Object.keys(customMetadata).length === 0
          ? `<div class="metadata-empty">No custom metadata set</div>`
          : `<div class="metadata-list">
            ${Object.entries(customMetadata)
              .map(
                ([key, value]) =>
                  `<div class="metadata-item">
                    <div class="detail-label">${escapeHtml(
                      key
                    )}:</div><div class="detail-value">${escapeHtml(
                    value
                  )}</div>
                  </div>`
              )
              .join("")}
          </div>`
      }
    </div>

    ${
      !isDirectory
        ? `
    <div class="preview-section">
      <h2>Object Preview</h2>
      ${
        size === 0
          ? `
      <div class="preview-container">
        <div class="preview-unsupported">File is empty (0 bytes). No preview available.</div>
      </div>
      `
          : imageUrl
          ? `
      <div class="preview-container">
        <img src="${imageUrl}" alt="${name}" class="preview-image" />
      </div>
      `
          : textContent !== null && textContent !== undefined
          ? `
      <pre class="preview-text">${escapeHtml(textContent)}</pre>
      `
          : isTooLargeForTextPreview
          ? `
      <div class="preview-container">
        <div class="preview-unsupported">File is too large to preview (over 1MB). Please download to view.</div>
      </div>
      `
          : `
      <div class="preview-container">
        <div class="preview-unsupported">Preview not available for this file type</div>
      </div>
      `
      }
    </div>
    `
        : ""
    }

    <!-- Move/Rename Modal -->
    <div id="move-rename-modal" class="modal-overlay">
      <div class="modal modal-wide">
        <h2>📦 Move and/or Rename</h2>
        <form class="modal-form" method="POST" action="/b/${
          bucketInfo.binding
        }/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="rename">
          <input type="hidden" name="oldFullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          <input type="hidden" name="theme" value="${theme}">
          <input type="text" name="newFullPath" value="${fullPath}" placeholder="Enter new path" required autofocus>
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn-cancel">Cancel</a>
            <button type="submit" class="btn-primary">Move/Rename</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="${deleteModalId}" class="modal-overlay">
      <div class="modal">
        <h2>🗑️ Delete ${isDirectory ? "Folder" : "File"}</h2>
        <p>Are you sure you want to delete <strong>${name}</strong>?${
    isDirectory ? " This will delete the folder and all its contents." : ""
  } This action cannot be undone.</p>
        <form method="POST" class="modal-form" action="/b/${
          bucketInfo.binding
        }/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="parentPath" value="${parentPath}">
          <input type="hidden" name="name" value="${name}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          <input type="hidden" name="theme" value="${theme}">
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn-cancel">Cancel</a>
            <button type="submit" class="btn-delete">Delete</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Metadata Modal -->
    <div id="metadata-add-modal" class="modal-overlay">
      <div class="modal">
        <h2>➕ Add Custom Metadata</h2>
        <form method="POST" class="modal-form" action="/b/${
          bucketInfo.binding
        }/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="addMetadata">
          <input type="hidden" name="fullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          <input type="hidden" name="theme" value="${theme}">
          
          <div class="metadata-add-form">
            <label>
              <div style="margin-bottom: 4px; font-weight: 500; font-size: 13px;">Key</div>
              <input type="text" name="metadataKey" value="" placeholder="Enter metadata key" class="metadata-input" autofocus>
            </label>
            <label>
              <div style="margin-bottom: 4px; font-weight: 500; font-size: 13px;">Value</div>
              <input type="text" name="metadataValue" value="" placeholder="Enter metadata value" class="metadata-input">
            </label>
          </div>
          
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn-cancel">Cancel</a>
            <button type="submit" class="btn-primary">Add Metadata</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Metadata Modal -->
    <div id="metadata-edit-modal" class="modal-overlay">
      <div class="modal modal-wide">
        <h2>✏️ Edit Custom Metadata</h2>
        <form method="POST" class="modal-form" action="/b/${
          bucketInfo.binding
        }/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="updateMetadata">
          <input type="hidden" name="fullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          <input type="hidden" name="theme" value="${theme}">
          
          <div class="metadata-editor">
            <div class="metadata-editor-header">
              <div class="metadata-editor-label">Key</div>
              <div class="metadata-editor-label">Value</div>
              <div class="metadata-editor-label">Delete</div>
            </div>
            <div class="metadata-editor-scrollable">
              ${Object.entries(customMetadata)
                .map(
                  ([key, value], index) => `
                <div class="metadata-editor-row">
                  <div class="metadata-row-label">Key</div>
                  <input type="text" name="metadataKey_${index}" value="${escapeHtml(
                    key
                  )}" placeholder="Key" class="metadata-input">
                  <div class="metadata-row-label">Value</div>
                  <input type="text" name="metadataValue_${index}" value="${escapeHtml(
                    value
                  )}" placeholder="Value" class="metadata-input">
                  <label class="metadata-delete-label">
                    <input type="checkbox" name="metadataDelete_${index}" value="true" class="metadata-delete-checkbox">
                    <span class="metadata-delete-text">Delete</span>
                  </label>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
          
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn-cancel">Cancel</a>
            <button type="submit" class="btn-primary">Save Metadata</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</body>
</html>`;
}
