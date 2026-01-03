/**
 * User Management pages UI
 */

import type { AuthenticatedUser } from "../auth/middleware";
import type { User } from "../db/users";
import type { BucketInfo, Theme } from "../types";
import { escapeHtml, formatDateString, formatISOString } from "../utils/format";
import { renderAlert, renderHead } from "./components";

export interface UsersPageOptions {
  currentBucket: BucketInfo;
  theme: Theme;
  currentUser: AuthenticatedUser;
  users: User[];
  successMessage?: string;
  errorMessage?: string;
}

export function renderUsersPage(options: UsersPageOptions): string {
  const { currentBucket, theme, currentUser, users, successMessage, errorMessage } = options;

  const alertHtml = successMessage
    ? renderAlert("success", escapeHtml(successMessage), "/settings/users")
    : errorMessage
      ? renderAlert("error", escapeHtml(errorMessage), "/settings/users")
      : '';

  const userRows = users
    .map((u) => {
      const isCurrentUser = u.id === currentUser.id;
      const adminBadge = u.is_admin ? '<span class="badge badge-admin">Admin</span>' : '';
      const tempPwBadge = u.must_change_password
        ? '<span class="badge badge-warning">Temp PW</span>'
        : '';

      return `
        <tr>
          <td>${escapeHtml(u.username)}</td>
          <td class="col-status">${adminBadge} ${tempPwBadge}</td>
          <td class="col-time">
            <span class="mobile-hidden">${formatISOString(u.created_at)}</span>
            <span class="mobile-visible">${formatDateString(u.created_at)}</span>
          </td>
          <td class="col-details">
            ${!isCurrentUser ? `
            <a href="/settings/users/${u.id}" class="details-link" title="User details">⋮</a>
            ` : '<span class="text-muted">You</span>'}
          </td>
        </tr>
      `;
    })
    .join("");

  const userCount = users.length;
  const adminCount = users.filter(u => u.is_admin).length;
  const regularUserCount = userCount - adminCount;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "User Management", theme })}
<body>
  <div class="header">
    <h1>User Management</h1>
    <div class="header-controls">
      <a href="#create-user-modal" class="btn btn-action">➕ New User</a>
      <a href="/settings" class="btn btn-action">
        ⚙️ Settings
      </a>
    </div>
  </div>
  <hr>
  
  ${alertHtml}
  
  ${users.length > 0 ? `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th class="col-status">Status</th>
            <th class="col-time">Created</th>
            <th class="col-details"></th>
          </tr>
        </thead>
        <tbody>
          ${userRows}
        </tbody>
      </table>
    </div>
  ` : '<p class="empty-state">No users found.</p>'}
  <hr>
  <div class="footer">
    <div class="footer-stats">
      <span class="stat"><span class="stat-label">Users:</span> ${userCount}</span>
      ${adminCount > 0 ? `<span class="stat"><span class="stat-label">Admins:</span> ${adminCount}</span>` : ''}
      ${regularUserCount > 0 ? `<span class="stat"><span class="stat-label">Regular:</span> ${regularUserCount}</span>` : ''}
    </div>
    <div class="footer-info">
      New users will be assigned a temporary password and required to change it on first login.
    </div>
  </div>

  <!-- Create User Modal -->
  <div id="create-user-modal" class="modal-overlay">
    <div class="modal">
      <h2>➕ Create New User</h2>
      <form method="POST" action="/settings/users" class="modal-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" required minlength="3" autofocus />
        </div>
        
        <div class="form-group">
          <label for="password">Temporary Password</label>
          <input type="password" id="password" name="password" required minlength="8" />
          <p class="help-text">User will be required to change this on first login.</p>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="isAdmin" value="true" />
            Make this user an admin
          </label>
        </div>
        
        <div class="modal-buttons">
          <a href="/settings/users" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-success">Create User</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}

