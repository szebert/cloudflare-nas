/**
 * Change password page UI
 * Used for forced password changes on first login
 */

import type { Theme } from "../types";
import { escapeHtml } from "../utils/format";
import { renderAlert, renderHead } from "./components";

export interface ChangePasswordPageOptions {
  theme: Theme;
  error?: string;
  success?: string;
  isForced?: boolean; // True if this is a forced password change
  username: string;
}

export function renderChangePasswordPage(options: ChangePasswordPageOptions): string {
  const { theme, error, success, isForced, username } = options;

  const title = isForced ? "Change Your Password" : "Change Password";
  const subtitle = isForced
    ? "You must change your password before continuing."
    : `Change password for ${escapeHtml(username)}`;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Change Password", theme })}
<body>
  <div>
    <div class="container">
      <h1>${title}</h1>
      <p class="container-subtitle">${subtitle}</p>
      
      ${error ? renderAlert("error", escapeHtml(error), "/change-password") : ""}
      ${success ? renderAlert("success", escapeHtml(success), "/change-password") : ""}
      
      <form method="POST" action="/change-password" class="container-form">
        <div class="form-group">
          <label for="currentPassword">Current Password</label>
          <input
            type="password"
            id="currentPassword"
            name="currentPassword"
            required
            autofocus
            autocomplete="current-password"
          />
        </div>
        
        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            required
            autocomplete="new-password"
            minlength="8"
          />
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            autocomplete="new-password"
            minlength="8"
          />
        </div>
        
        <button type="submit" class="btn btn-primary">Change Password</button>
        
        ${!isForced ? `
        <div class="form-footer">
          <a href="javascript:history.back()" class="btn btn-secondary">Cancel</a>
        </div>
        ` : `
        <div class="form-footer">
          <form method="POST" action="/logout" style="display: inline;">
            <button type="submit" class="btn btn-secondary">Logout Instead</button>
          </form>
        </div>
        `}
      </form>
    </div>
  </div>
</body>
</html>`;
}

