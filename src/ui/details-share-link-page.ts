/**
 * Share Link Details page UI
 */

import type { AuthenticatedUser } from "../auth/middleware";
import type { ShareLink } from "../db/share-links";
import type { BucketInfo, Theme } from "../types";
import { escapeHtml, formatISOString } from "../utils/format";
import { renderHead } from "./components";

function buildBreadcrumbs(
  bucketBinding: string,
  fullPath: string,
  isDirectory: boolean
): string {
  const parts = fullPath ? fullPath.split("/").filter((p) => p) : [];
  const breadcrumbs: Array<{ name: string; path: string | null }> = [
    { name: bucketBinding, path: `/b/${bucketBinding}/` },
  ];

  // Build breadcrumbs for parent path (all parts except the last one)
  let currentPath = "";
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    currentPath += `${part}/`;
    breadcrumbs.push({
      name: part,
      path: `/b/${bucketBinding}/${currentPath}`,
    });
  }

  // Add file/folder name as clickable (links to details page)
  if (parts.length > 0) {
    const fileName = parts[parts.length - 1];
    const fileDetailsUrl = `/b/${bucketBinding}/details/${fullPath}${isDirectory ? "/" : ""}`;
    breadcrumbs.push({
      name: fileName,
      path: fileDetailsUrl,
    });
  }

  // Add "Share Link Details" as the final non-clickable item
  breadcrumbs.push({
    name: "Share Link Details",
    path: null,
  });

  return breadcrumbs
    .map((b, i) => {
      if (b.path === null || i === breadcrumbs.length - 1) {
        return `<span>${b.name}</span>`;
      }
      return `<a href="${b.path}">${b.name}</a>`;
    })
    .join(" / ");
}

export interface ShareLinkDetailsPageOptions {
  currentBucket: BucketInfo;
  theme: Theme;
  user: AuthenticatedUser;
  shareLink: ShareLink;
  shareUrl: string; // Full URL: origin + /s/{token}
  successMessage?: string;
  errorMessage?: string;
}

export function renderShareLinkDetailsPage(
  options: ShareLinkDetailsPageOptions
): string {
  const { currentBucket, theme, user, shareLink, shareUrl, successMessage, errorMessage } = options;

  const alertHtml = successMessage
    ? `<div class="alert alert-success">${escapeHtml(successMessage)}</div>`
    : errorMessage
      ? `<div class="alert alert-error">${escapeHtml(errorMessage)}</div>`
      : '';

  const isExpired = shareLink.expires_at && shareLink.expires_at < Date.now();
  const isMaxedOut = shareLink.max_downloads !== null && shareLink.download_count >= shareLink.max_downloads;
  const statusBadge = isExpired
    ? '<span class="badge badge-error">Expired</span>'
    : isMaxedOut
      ? '<span class="badge badge-warning">Limit Reached</span>'
      : '<span class="badge badge-success">Active</span>';

  const expiresText = shareLink.expires_at
    ? formatISOString(shareLink.expires_at)
    : 'Never';

  const downloadsText = shareLink.max_downloads !== null
    ? `${shareLink.download_count} / ${shareLink.max_downloads}`
    : `${shareLink.download_count}`;

  const fileName = shareLink.r2_path.split('/').filter(Boolean).pop() || shareLink.r2_path;
  const breadcrumbs = buildBreadcrumbs(currentBucket.binding, shareLink.r2_path, shareLink.is_directory === 1);
  const currentDetailsUrl = `/settings/links/${shareLink.id}`;
  const displayPath = "/" + (shareLink.r2_path || "");

  // Format expiration date for datetime-local input (YYYY-MM-DDTHH:mm)
  const expiresAtValue = shareLink.expires_at
    ? new Date(shareLink.expires_at).toISOString().slice(0, 16)
    : '';

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: `Share Link: ${shareLink.token}`, theme })}
<body>
  <div class="header">
    <h1>Share Link Details of ${displayPath}</h1>
    <div class="header-controls">
      <a href="/settings" class="btn btn-action">
        ⚙️ Settings
      </a>
    </div>
  </div>
  <hr>
  
  <div class="details-page">
    <div class="breadcrumbs">
      ${breadcrumbs}
    </div>

    <div class="action-buttons">
      <a href="${escapeHtml(shareUrl)}" target="_blank" class="btn btn-primary">🔗 Open Link</a>
      <a href="#edit-share-link-modal" class="btn btn-secondary">✏️ Edit</a>
      <a href="#modify-password-modal" class="btn btn-secondary">🔒 Modify Password</a>
      <a href="#revoke-modal" class="btn btn-delete">🗑️ Revoke Link</a>
    </div>

    ${alertHtml}

    <div class="details-section">
      <h2>Share Link Details</h2>
      <div class="details-grid">
        <div class="detail-label">Share URL:</div>
        <div class="detail-value">
          <code class="code-block">${escapeHtml(shareUrl)}</code>
        </div>
        <div class="detail-label">File/Folder:</div>
        <div class="detail-value">
          ${shareLink.is_directory ? '📁' : '📄'} ${escapeHtml(fileName)}
          <br><span class="text-secondary-small">${escapeHtml(shareLink.r2_path)}</span>
        </div>
        <div class="detail-label">Status:</div>
        <div class="detail-value">${statusBadge}</div>
        <div class="detail-label">Password Protected:</div>
        <div class="detail-value">${shareLink.password_hash ? 'Yes 🔒' : 'No'}</div>
        <div class="detail-label">Expires:</div>
        <div class="detail-value">${expiresText}</div>
        <div class="detail-label">Downloads:</div>
        <div class="detail-value">${downloadsText}</div>
        <div class="detail-label">Created:</div>
        <div class="detail-value">${formatISOString(shareLink.created_at)}</div>
      </div>
    </div>
  </div>

  <!-- Edit Share Link Modal -->
  <div id="edit-share-link-modal" class="modal-overlay">
    <div class="modal">
      <h2>✏️ Edit Share Link</h2>
      <form method="POST" class="modal-form" action="/settings/links/${shareLink.id}/update">
        <div class="form-group">
          <label for="edit-share-code">Share Code</label>
          <input 
            type="text" 
            id="edit-share-code" 
            name="token" 
            value="${escapeHtml(shareLink.token)}" 
            required 
            pattern="[a-zA-Z0-9_-]+" 
            minlength="3" 
            maxlength="20" 
            class="input-monospace"
            autofocus
          />
          <p class="help-text">Code must be 3-20 characters, alphanumeric, hyphens, or underscores</p>
        </div>
        
        <div class="form-group">
          <label for="edit-share-expires">Expiration (optional)</label>
          <input 
            type="datetime-local" 
            id="edit-share-expires" 
            name="expiresAt" 
            value="${expiresAtValue}"
          />
          <p class="help-text">Leave empty to remove expiration</p>
        </div>
        
        <div class="form-group">
          <label for="edit-share-max-downloads">Max Downloads (optional)</label>
          <input 
            type="number" 
            id="edit-share-max-downloads" 
            name="maxDownloads" 
            min="1" 
            value="${shareLink.max_downloads || ''}"
            placeholder="Unlimited"
          />
          <p class="help-text">Leave empty to remove download limit</p>
        </div>
        
        <div class="modal-buttons">
          <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modify Password Modal -->
  <div id="modify-password-modal" class="modal-overlay">
    <div class="modal">
      <h2>🔒 Modify Password</h2>
      <form method="POST" class="modal-form" action="/settings/links/${shareLink.id}/update">
        <div class="form-group">
          <label for="modify-password">Password</label>
          <input 
            type="password" 
            id="modify-password" 
            name="password" 
            placeholder="${shareLink.password_hash ? 'Enter new password' : 'Enter password to protect this link'}"
            autofocus
          />
          <p class="help-text">${shareLink.password_hash ? 'Enter a new password to change it, or leave empty to remove password protection' : 'Leave empty to keep this link unprotected'}</p>
        </div>
        
        <div class="modal-buttons">
          <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-primary">${shareLink.password_hash ? 'Update Password' : 'Set Password'}</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Revoke Link Modal -->
  <div id="revoke-modal" class="modal-overlay">
    <div class="modal">
      <h2>🗑️ Revoke Share Link</h2>
      <p>Are you sure you want to revoke this share link? This action cannot be undone.</p>
      <form method="POST" action="/settings/links/${shareLink.id}/delete" class="modal-form">
        <div class="modal-buttons">
          <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-delete">Revoke Link</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}

