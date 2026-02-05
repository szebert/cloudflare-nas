/**
 * Share Links settings page UI
 */

import type { AuthenticatedUser } from "../auth/middleware";
import type { ShareLink } from "../db/share-links";
import type { BucketInfo, Theme } from "../types";
import { escapeHtml, formatDateString, formatISOString } from "../utils/format";
import { renderAlert, renderHead } from "./components";

export interface ShareLinksPageOptions {
  currentBucket: BucketInfo;
  theme: Theme;
  user: AuthenticatedUser;
  shareLinks: ShareLink[];
  successMessage?: string;
  errorMessage?: string;
}

export function renderShareLinksPage(options: ShareLinksPageOptions): string {
  const { currentBucket, theme, user, shareLinks, successMessage, errorMessage } = options;

  const alertHtml = successMessage
    ? renderAlert("success", escapeHtml(successMessage), "/settings/links")
    : errorMessage
      ? renderAlert("error", escapeHtml(errorMessage), "/settings/links")
      : '';

  const linkRows = shareLinks
    .map((link) => {
      const downloadsText = link.max_downloads !== null
        ? `${link.download_count} / ${link.max_downloads}`
        : `${link.download_count}`;

      const hasPassword = link.password_hash ? ' 🔒' : '';
      const fileName = link.r2_path.split('/').filter(Boolean).pop() || link.r2_path;
      const detailsLink = `<a href="/settings/links/${link.id}" class="details-link" title="Share link details">⋮</a>`;

      return `
        <tr>
          <td title="${escapeHtml(link.r2_path)}">
            ${link.is_directory ? '📁' : '📄'} ${escapeHtml(fileName)}${hasPassword}
          </td>
          <td><code>${escapeHtml(link.token)}</code></td>
          <td class="col-time">
            <span class="mobile-hidden">${formatISOString(link.expires_at, 'Never')}</span>
            <span class="mobile-visible">${formatDateString(link.expires_at, 'Never')}</span>
          </td>
          <td class="col-size">${downloadsText}</td>
          <td class="col-time">
            <span class="mobile-hidden">${formatISOString(link.created_at)}</span>
            <span class="mobile-visible">${formatDateString(link.created_at)}</span>
          </td>
          <td class="col-details">${detailsLink}</td>
        </tr>
      `;
    })
    .join("");

  const linkCount = shareLinks.length;
  const footerMessage = user.is_admin
    ? "Showing all share links (admin view)"
    : `Showing all share links made by ${escapeHtml(user.username)}`;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Share Links", theme })}
<body>
  <div class="header">
    <h1>Share Links</h1>
    <div class="header-controls">
      <a href="/settings" class="btn btn-action">
        ⚙️ Settings
      </a>
    </div>
  </div>
  <hr>
  
  ${alertHtml}
  
  ${shareLinks.length > 0 ? `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>File/Folder</th>
            <th>Code</th>
            <th class="col-time">Expires</th>
            <th class="col-size">
              <span class="mobile-hidden">Downloads</span>
              <span class="mobile-visible">DLs</span>
            </th>
            <th class="col-time">Created</th>
            <th class="col-details"></th>
          </tr>
        </thead>
        <tbody>
          ${linkRows}
        </tbody>
      </table>
    </div>
  ` : `
    <p class="empty-state">No active share links.</p>
    <p class="help-text">You can create share links from the file or folder details page.</p>
  `}
  <hr>
  <div class="footer">
    <div class="footer-stats">
      <span class="stat"><span class="stat-label">Share Links:</span> ${linkCount}</span>
    </div>
    <div class="footer-info">
      ${footerMessage}
    </div>
  </div>
</body>
</html>`;
}

