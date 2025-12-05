import type { FileDetails } from "../routes/details";
import type { BucketInfo, Theme } from "../types";
import { formatDateUTC, formatSize } from "../utils/format";
import { renderThemeSwitcher } from "./components";
import { getThemeStyles } from "./styles";

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

function canPreviewImage(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith("image/");
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
  } = fileDetails;

  const breadcrumbs = buildBreadcrumbs(bucketInfo.binding, fullPath, theme);
  const currentDetailsUrl = `/b/${bucketInfo.binding}/details/${fullPath}${
    isDirectory ? "/" : ""
  }?theme=${theme}`;

  const downloadUrl = `/b/${bucketInfo.binding}/download/${fullPath}`;
  const previewUrl = canPreviewImage(contentType)
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
  ${getThemeStyles(theme)}
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
      <h2>Custom Metadata</h2>
      ${
        Object.keys(customMetadata).length === 0
          ? `<div class="metadata-empty">No custom metadata set</div>`
          : `<div class="metadata-list">
            ${Object.entries(customMetadata)
              .map(
                ([key, value]) =>
                  `<div class="detail-label">${key}:</div><div class="detail-value">${value}</div>`
              )
              .join("")}
          </div>`
      }
    </div>

    ${
      !isDirectory && previewUrl
        ? `
    <div class="preview-section">
      <h2>Object Preview</h2>
      <div class="preview-container">
        <img src="${previewUrl}" alt="${name}" class="preview-image" />
      </div>
    </div>
    `
        : !isDirectory
        ? `
    <div class="preview-section">
      <h2>Object Preview</h2>
      <div class="preview-container">
        <div class="preview-unsupported">Preview not available for this file type</div>
      </div>
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
  </div>
</body>
</html>`;
}
