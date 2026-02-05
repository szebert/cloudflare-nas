import type { AuthenticatedUser } from "../auth/middleware";
import type { ShareLink } from "../db/share-links";
import type { FileDetails } from "../routes/details";
import type { BucketInfo, Theme } from "../types";
import { escapeHtml, formatDateString, formatISOString, formatSize } from "../utils/format";
import {
  renderAlert,
  renderHead,
} from "./components";

export interface DetailsPageOptions {
  bucketInfo: BucketInfo;
  fileDetails: FileDetails;
  theme: Theme;
  buckets: BucketInfo[];
  user?: AuthenticatedUser;
  shareLinks?: ShareLink[];
  shareUrl?: string; // Newly created share URL to display
}

function buildBreadcrumbs(
  bucketBinding: string,
  fullPath: string
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
      return `<a href="${b.path}">${b.name}</a>`;
    })
    .join(" / ");
}

export function renderDetailsPage(options: DetailsPageOptions): string {
  const { bucketInfo, fileDetails, theme, buckets, user, shareLinks = [], shareUrl } = options;
  const {
    name,
    fullPath,
    parentPath,
    isDirectory,
    size,
    modified,
    contentType,
    customMetadata,
    httpMetadata,
    storageClass,
    textContent,
    isTooLargeForTextPreview,
    isImage: isImageFile,
    isVideo: isVideoFile,
    canEditFile,
  } = fileDetails;

  const breadcrumbs = buildBreadcrumbs(bucketInfo.binding, fullPath);
  const currentDetailsUrl = `/b/${bucketInfo.binding}/details/${fullPath}${isDirectory ? "/" : ""}`;

  const downloadUrl = `/b/${bucketInfo.binding}/download/${fullPath}`;
  const videoUrl = isVideoFile
    ? `/b/${bucketInfo.binding}/download/${fullPath}`
    : null;
  const imageUrl = isImageFile
    ? `/b/${bucketInfo.binding}/download/${fullPath}`
    : null;
  const deleteModalId = `delete-${fullPath.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const displayPath = "/" + (fullPath || "");
  const settingsLink = `<a href="/settings" class="btn btn-action">⚙️ Settings</a>`;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: `${name} - Details`, theme })}
<body>
  <div class="header">
    <h1>Details of ${displayPath}</h1>
    <div class="header-controls">
      ${settingsLink}
    </div>
  </div>
  <hr>
  <div class="details-page">
    <div class="breadcrumbs">
      ${breadcrumbs}
    </div>

    <div class="action-buttons">
      ${!isDirectory
      ? `<a href="${downloadUrl}" class="btn btn-primary">⬇️ Download</a>`
      : ""
    }
      <a href="#share-modal" class="btn btn-success">🔗 Share</a>
      ${canEditFile
      ? `<a href="#edit-file-modal" class="btn btn-secondary">✏️ Edit</a>`
      : ""
    }
      <a href="#move-rename-modal" class="btn btn-secondary">📦 Move/Rename</a>
      <a href="#${deleteModalId}" class="btn btn-delete">🗑️ Delete</a>
    </div>

    ${shareUrl ? renderAlert(
      "success",
      `<strong>Share link created!</strong> 
      <div class="share-notice">
        <code class="code-block-small">${escapeHtml(shareUrl)}</code>
        <a href="${escapeHtml(shareUrl)}" target="_blank" class="btn btn-small btn-secondary btn-spacing-left">🔗 Open</a>
      </div>`,
      currentDetailsUrl,
    ) : ''}

    ${user && shareLinks.length > 0 ? `
    <div class="details-section">
      <div class="metadata-section-header">
        <h2>🔗 Share Links</h2>
      </div>
        <table class="share-links-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Expires</th>
              <th>
                <span class="mobile-hidden">Downloads</span>
                <span class="mobile-visible">DLs</span>
              </th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${shareLinks.map((link) => {
      const expiresText = formatISOString(link.expires_at, 'Never');
      const expiresDateOnly = formatDateString(link.expires_at, 'Never');

      const downloadsText = link.max_downloads !== null
        ? `${link.download_count} / ${link.max_downloads}`
        : `${link.download_count}`;

      const detailsLink = `<a href="/settings/links/${link.id}" class="details-link" title="Share link details">⋮</a>`;

      return `
                <tr>
                  <td><code>${escapeHtml(link.token)}</code></td>
                  <td>
                    <span class="mobile-hidden">${expiresText}</span>
                    <span class="mobile-visible">${expiresDateOnly}</span>
                  </td>
                  <td>${downloadsText}</td>
                  <td>
                    <span class="mobile-hidden">${formatISOString(link.created_at)}</span>
                    <span class="mobile-visible">${formatDateString(link.created_at)}</span>
                  </td>
                  <td>${detailsLink}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
    </div>
    ` : ''}

    <div class="details-section">
      <h2>Object Details</h2>
      <div class="details-grid">
        <div class="detail-label">Date Created:</div>
        <div class="detail-value">${formatISOString(modified)}</div>
        <div class="detail-label">Type:</div>
        <div class="detail-value">${contentType || "-"}</div>
        <div class="detail-label">Storage Class:</div>
        <div class="detail-value">${storageClass || "-"}</div>
        <div class="detail-label">Size:</div>
        <div class="detail-value">${formatSize(size)}</div>
      </div>
    </div>

    <div class="metadata-section">
      <div class="metadata-section-header">
        <h2>HTTP Metadata</h2>
        <div class="metadata-buttons">
          ${!isDirectory
      ? `<a href="#http-metadata-add-modal" class="btn btn-success">➕ Add</a>`
      : ""
    }
          ${Object.keys(httpMetadata).length > 0
      ? `<a href="#http-metadata-edit-modal" class="btn btn-secondary">✏️ Edit</a>`
      : ""
    }
        </div>
      </div>
      ${Object.keys(httpMetadata).length === 0
      ? `<div class="metadata-empty">No HTTP metadata set</div>`
      : `<div class="metadata-list">
            ${Object.entries(httpMetadata)
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

    <div class="metadata-section">
      <div class="metadata-section-header">
        <h2>Custom Metadata</h2>
        <div class="metadata-buttons">
          ${!isDirectory
      ? `<a href="#metadata-add-modal" class="btn btn-success">➕ Add</a>`
      : ""
    }
          ${Object.keys(customMetadata).length > 0
      ? `<a href="#metadata-edit-modal" class="btn btn-secondary">✏️ Edit</a>`
      : ""
    }
        </div>
      </div>
      ${Object.keys(customMetadata).length === 0
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

    ${!isDirectory
      ? `
    <div class="preview-section">
      <h2>Object Preview</h2>
      ${size === 0
        ? `
      <div class="preview-container">
        <div class="preview-unsupported">File is empty (0 bytes). No preview available.</div>
      </div>
      `
        : videoUrl
          ? `
      <div class="preview-container">
        <video src="${videoUrl}" controls class="preview-video">Your browser does not support the video tag.</video>
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

    ${canEditFile
      ? `
    <!-- Edit File Modal -->
    <div id="edit-file-modal" class="modal-overlay">
      <div class="modal modal-wide">
        <h2>✏️ Edit File</h2>
        <form class="modal-form" method="POST" action="/b/${bucketInfo.binding}/details/${fullPath}">
          <input type="hidden" name="action" value="edit">
          <input type="hidden" name="fullPath" value="${fullPath}">
          <textarea name="content" placeholder="File content" rows="12" required autofocus>${escapeHtml(
        textContent || ""
      )}</textarea>
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-success">Save</button>
          </div>
        </form>
      </div>
    </div>
    `
      : ""
    }

    <!-- Move/Rename Modal -->
    <div id="move-rename-modal" class="modal-overlay">
      <div class="modal modal-wide">
        <h2>📦 Move and/or Rename</h2>
        <form class="modal-form" method="POST" action="/b/${bucketInfo.binding}/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="rename">
          <input type="hidden" name="oldFullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          <input type="text" name="newFullPath" value="${fullPath}" placeholder="Enter new path" required autofocus>
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-secondary">Move/Rename</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="${deleteModalId}" class="modal-overlay">
      <div class="modal">
        <h2>🗑️ Delete ${isDirectory ? "Folder" : "File"}</h2>
        <p>Are you sure you want to delete <strong>${name}</strong>?${isDirectory ? " This will delete the folder and all its contents." : ""
    } This action cannot be undone.</p>
        <form method="POST" class="modal-form" action="/b/${bucketInfo.binding}/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="parentPath" value="${parentPath}">
          <input type="hidden" name="name" value="${name}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-delete">Delete</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Metadata Modal -->
    <div id="metadata-add-modal" class="modal-overlay">
      <div class="modal">
        <h2>➕ Add Custom Metadata</h2>
        <form method="POST" class="modal-form" action="/b/${bucketInfo.binding}/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="addMetadata">
          <input type="hidden" name="fullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          
          <div class="metadata-add-form">
            <label>
              <div class="metadata-label-text">Key</div>
              <input type="text" name="metadataKey" value="" placeholder="Enter metadata key" class="metadata-input" autofocus>
            </label>
            <label>
              <div class="metadata-label-text">Value</div>
              <input type="text" name="metadataValue" value="" placeholder="Enter metadata value" class="metadata-input">
            </label>
          </div>
          
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-success">Add Metadata</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Metadata Modal -->
    <div id="metadata-edit-modal" class="modal-overlay">
      <div class="modal modal-wide">
        <h2>✏️ Edit Custom Metadata</h2>
        <form method="POST" class="modal-form" action="/b/${bucketInfo.binding}/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="updateMetadata">
          <input type="hidden" name="fullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          
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
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-secondary">Save Metadata</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add HTTP Metadata Modal -->
    <div id="http-metadata-add-modal" class="modal-overlay">
      <div class="modal">
        <h2>➕ Add HTTP Metadata</h2>
        <form method="POST" class="modal-form" action="/b/${bucketInfo.binding}/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="addHttpMetadata">
          <input type="hidden" name="fullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          
          <div class="metadata-add-form">
            <label>
              <div class="metadata-label-text">Key</div>
              <select name="httpMetadataKey" class="metadata-input" autofocus required>
                <option value="">Select a field</option>
                <option value="contentType">Content-Type</option>
                <option value="contentLanguage">Content-Language</option>
                <option value="contentDisposition">Content-Disposition</option>
                <option value="contentEncoding">Content-Encoding</option>
                <option value="cacheControl">Cache-Control</option>
                <option value="cacheExpiry">Cache-Expiry</option>
              </select>
            </label>
            <label>
              <div class="metadata-label-text">Value</div>
              <input type="text" name="httpMetadataValue" value="" placeholder="Enter metadata value (for cacheExpiry, use ISO date format)" class="metadata-input">
            </label>
          </div>
          
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-success">Add Metadata</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit HTTP Metadata Modal -->
    <div id="http-metadata-edit-modal" class="modal-overlay">
      <div class="modal modal-wide">
        <h2>✏️ Edit HTTP Metadata</h2>
        <form method="POST" class="modal-form" action="/b/${bucketInfo.binding}/details/${fullPath}${isDirectory ? "/" : ""}">
          <input type="hidden" name="action" value="updateHttpMetadata">
          <input type="hidden" name="fullPath" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          
          <div class="metadata-editor">
            <div class="metadata-editor-header">
              <div class="metadata-editor-label">Key</div>
              <div class="metadata-editor-label">Value</div>
              <div class="metadata-editor-label">Delete</div>
            </div>
            <div class="metadata-editor-scrollable">
              ${Object.entries(httpMetadata)
      .map(
        ([key, value], index) => `
                <div class="metadata-editor-row">
                  <div class="metadata-row-label">Key</div>
                  <select name="httpMetadataKey_${index}" class="metadata-input">
                    <option value="contentType" ${key === "contentType" ? "selected" : ""
          }>Content-Type</option>
                    <option value="contentLanguage" ${key === "contentLanguage" ? "selected" : ""
          }>Content-Language</option>
                    <option value="contentDisposition" ${key === "contentDisposition" ? "selected" : ""
          }>Content-Disposition</option>
                    <option value="contentEncoding" ${key === "contentEncoding" ? "selected" : ""
          }>Content-Encoding</option>
                    <option value="cacheControl" ${key === "cacheControl" ? "selected" : ""
          }>Cache-Control</option>
                    <option value="cacheExpiry" ${key === "cacheExpiry" ? "selected" : ""
          }>Cache-Expiry</option>
                  </select>
                  <div class="metadata-row-label">Value</div>
                  <input type="text" name="httpMetadataValue_${index}" value="${escapeHtml(
            value
          )}" placeholder="Value (for cacheExpiry, use ISO date format)" class="metadata-input">
                  <label class="metadata-delete-label">
                    <input type="checkbox" name="httpMetadataDelete_${index}" value="true" class="metadata-delete-checkbox">
                    <span class="metadata-delete-text">Delete</span>
                  </label>
                </div>
              `
      )
      .join("")}
            </div>
          </div>
          
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-secondary">Save Metadata</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Share Modal -->
    <div id="share-modal" class="modal-overlay">
      <div class="modal">
        <h2>🔗 Create Share Link</h2>
        <form method="POST" class="modal-form" action="/b/${bucketInfo.binding}/share">
          <input type="hidden" name="path" value="${fullPath}">
          <input type="hidden" name="isDirectory" value="${isDirectory}">
          <input type="hidden" name="redirect" value="${currentDetailsUrl}">
          
          <div class="form-group">
            <label for="share-password">Password (optional)</label>
            <input type="password" id="share-password" name="password" placeholder="Leave empty for no password">
          </div>
          
          <div class="form-group">
            <label for="share-expires">Expiration (optional)</label>
            <input type="datetime-local" id="share-expires" name="expiresAt">
          </div>
          
          <div class="form-group">
            <label for="share-max-downloads">Max Downloads (optional)</label>
            <input type="number" id="share-max-downloads" name="maxDownloads" min="1" placeholder="Unlimited">
          </div>
          
          <div class="modal-buttons">
            <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
            <button type="submit" class="btn btn-primary">Create Share Link</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</body>
</html>`;
}
