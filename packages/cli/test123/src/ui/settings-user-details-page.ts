/**
 * User Details page UI
 */

import type { AuthenticatedUser } from "../auth/middleware";
import type { User } from "../db/users";
import type { BucketInfo, Theme } from "../types";
import { escapeHtml, formatISOString } from "../utils/format";
import { renderAlert, renderHead } from "./components";

export interface UserDetailsPageOptions {
  currentBucket: BucketInfo;
  theme: Theme;
  currentUser: AuthenticatedUser;
  targetUser: User;
  successMessage?: string;
  errorMessage?: string;
}

function buildBreadcrumbs(
  bucketBinding: string,
  username: string
): string {
  const breadcrumbs: Array<{ name: string; path: string | null }> = [
    { name: bucketBinding, path: `/b/${bucketBinding}/` },
    { name: "Settings", path: `/settings` },
    { name: "Users", path: `/settings/users` },
    { name: username, path: null },
  ];

  return breadcrumbs
    .map((b, i) => {
      if (b.path === null || i === breadcrumbs.length - 1) {
        return `<span>${b.name}</span>`;
      }
      return `<a href="${b.path}">${b.name}</a>`;
    })
    .join(" / ");
}

export function renderUserDetailsPage(options: UserDetailsPageOptions): string {
  const { currentBucket, theme, currentUser, targetUser, successMessage, errorMessage } = options;

  const currentDetailsUrl = `/settings/users/${targetUser.id}`;
  const alertHtml = successMessage
    ? renderAlert("success", escapeHtml(successMessage), currentDetailsUrl)
    : errorMessage
      ? renderAlert("error", escapeHtml(errorMessage), currentDetailsUrl)
      : '';

  const isAdmin = targetUser.is_admin === 1;
  const hasTempPw = targetUser.must_change_password === 1;
  const canResetPassword = !isAdmin; // Admin can only reset password for non-admin users
  const breadcrumbs = buildBreadcrumbs(currentBucket.binding, targetUser.username);
  const settingsLink = `<a href="/settings" class="btn btn-action">⚙️ Settings</a>`;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: `User: ${targetUser.username}`, theme })}
<body>
  <div class="header">
    <h1>User: ${escapeHtml(targetUser.username)}</h1>
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
      <form method="POST" action="/settings/users/${targetUser.id}/toggle-admin" style="display: inline;">
        <button type="submit" class="btn btn-secondary">
          ${isAdmin ? '⬇️ Remove Admin' : '⬆️ Make Admin'}
        </button>
      </form>
      
      ${canResetPassword ? `
      <a href="#reset-password-modal" class="btn btn-secondary">🔑 Reset Password</a>
      ` : ''}
      
      <a href="#delete-user-modal" class="btn btn-delete">🗑️ Delete User</a>
    </div>

    ${alertHtml}

    <div class="details-section">
      <h2>User Details</h2>
      <div class="details-grid">
        <div class="detail-label">Username:</div>
        <div class="detail-value">${escapeHtml(targetUser.username)}</div>
        <div class="detail-label">Role:</div>
        <div class="detail-value">${isAdmin ? '<span class="badge badge-admin">Admin</span>' : 'User'}</div>
        <div class="detail-label">Password Status:</div>
        <div class="detail-value">${hasTempPw ? '<span class="badge badge-warning">Temp PW</span> Must change on next login' : 'Set by user'}</div>
        <div class="detail-label">Created:</div>
        <div class="detail-value">${formatISOString(targetUser.created_at)}</div>
      </div>
    </div>
  </div>

  ${canResetPassword ? `
  <!-- Reset Password Modal -->
  <div id="reset-password-modal" class="modal-overlay">
    <div class="modal">
      <h2>🔑 Reset Password</h2>
      <p>Set a new temporary password for <strong>${escapeHtml(targetUser.username)}</strong>. They will be required to change it on their next login.</p>
      <form method="POST" action="/settings/users/${targetUser.id}/reset-password" class="modal-form">
        <div class="form-group">
          <label for="newPassword">New Temporary Password</label>
          <input type="password" id="newPassword" name="newPassword" required minlength="8" autofocus />
        </div>
        
        <div class="modal-buttons">
          <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-primary">Reset Password</button>
        </div>
      </form>
    </div>
  </div>
  ` : ''}

  <!-- Delete User Modal -->
  <div id="delete-user-modal" class="modal-overlay">
    <div class="modal">
      <h2>🗑️ Delete User</h2>
      <p>Are you sure you want to delete <strong>${escapeHtml(targetUser.username)}</strong>? This action cannot be undone.</p>
      <form method="POST" action="/settings/users/${targetUser.id}/delete" class="modal-form">
        <div class="modal-buttons">
          <a href="${currentDetailsUrl}" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-delete">Delete User</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}

