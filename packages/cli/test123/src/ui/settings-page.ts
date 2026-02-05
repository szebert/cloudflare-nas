import type { AuthenticatedUser } from "../auth/middleware";
import type { BucketInfo, Theme } from "../types";
import { escapeHtml } from "../utils/format";
import { renderAlert, renderHead, renderThemeButtonGroup } from "./components";

export interface SettingsPageOptions {
  currentBucket: BucketInfo;
  theme: Theme;
  user: AuthenticatedUser;
  successMessage?: string;
  errorMessage?: string;
}

export function renderSettingsPage(options: SettingsPageOptions): string {
  const { currentBucket, theme, user, successMessage, errorMessage } = options;

  const themeButtonGroup = renderThemeButtonGroup(currentBucket.binding, theme);

  const alertHtml = successMessage
    ? renderAlert("success", escapeHtml(successMessage), "/settings")
    : errorMessage
      ? renderAlert("error", escapeHtml(errorMessage), "/settings")
      : '';

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Settings", theme })}
<body>
  <div class="header">
    <h1>Settings</h1>
    <div class="header-controls">
      <a href="/b/${currentBucket.binding}/" class="btn btn-action">
        ⬅️ Back to ${currentBucket.binding}
      </a>
    </div>
  </div>
  <hr>
  
  ${alertHtml}
  
  <div class="settings-page">
    <div class="settings-nav">
      ${user.is_admin ? `
      <a href="/settings/users" class="settings-nav-item">
        <span class="settings-nav-icon">👥</span>
        <div class="settings-nav-content">
          <span class="settings-nav-title">User Management</span>
          <span class="settings-nav-desc">Create, edit, and delete users</span>
        </div>
        <span class="settings-nav-arrow">→</span>
      </a>
      ` : ''}
      
      <a href="#change-password-modal" class="settings-nav-item">
        <span class="settings-nav-icon">🔐</span>
        <div class="settings-nav-content">
          <span class="settings-nav-title">Change Password</span>
          <span class="settings-nav-desc">Update your account password</span>
        </div>
        <span class="settings-nav-arrow">→</span>
      </a>
      
      <a href="/settings/links" class="settings-nav-item">
        <span class="settings-nav-icon">🔗</span>
        <div class="settings-nav-content">
          <span class="settings-nav-title">Share Links</span>
          <span class="settings-nav-desc">Manage active share links</span>
        </div>
        <span class="settings-nav-arrow">→</span>
      </a>
    </div>

    <div class="settings-section">
      <h2>🎨 Theme</h2>
      <p>Choose your preferred theme:</p>
      <div class="setting-item">
        ${themeButtonGroup}
      </div>
    </div>

    <div class="settings-section">
      <h2>👤 Account</h2>
      <p>Signed in as <strong>${escapeHtml(user.username)}</strong>${user.is_admin ? ' (Admin)' : ''}</p>
      <div class="setting-item">
        <form method="POST" action="/logout" style="display: inline;">
          <button type="submit" class="btn btn-secondary">
            🚪 Logout
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Change Password Modal -->
  <div id="change-password-modal" class="modal-overlay">
    <div class="modal">
      <h2>🔐 Change Password</h2>
      <p>Change password for <strong>${escapeHtml(user.username)}</strong></p>
      <form method="POST" action="/settings/password" class="modal-form">
        <div class="form-group">
          <label for="currentPassword">Current Password</label>
          <input type="password" id="currentPassword" name="currentPassword" required autocomplete="current-password" autofocus />
        </div>
        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input type="password" id="newPassword" name="newPassword" required minlength="8" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input type="password" id="confirmPassword" name="confirmPassword" required minlength="8" autocomplete="new-password" />
        </div>
        
        <div class="modal-buttons">
          <a href="/settings" class="btn btn-cancel">Cancel</a>
          <button type="submit" class="btn btn-primary">Change Password</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}
