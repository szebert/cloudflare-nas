import type { BucketInfo, Theme } from "../types";
import { renderHead, renderThemeButtonGroup } from "./components";

export interface SettingsPageOptions {
  currentBucket: BucketInfo;
  theme: Theme;
}

export function renderSettingsPage(options: SettingsPageOptions): string {
  const { currentBucket, theme } = options;

  const themeButtonGroup = renderThemeButtonGroup(currentBucket.binding, theme);

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Settings", theme })}
<body>
  <div class="header">
    <h1>Settings</h1>
    <div class="header-controls">
      <a href="/b/${currentBucket.binding}/" class="btn action-btn">
        ⬅️ Back to ${currentBucket.binding}
      </a>
    </div>
  </div>
  <hr>
  <div class="settings-page">
    <div class="settings-section">
      <h2>Theme</h2>
      <p>Choose your preferred theme:</p>
      <div class="setting-item">
        ${themeButtonGroup}
      </div>
    </div>

    <div class="settings-section">
      <h2>Account</h2>
      <div class="setting-item">
        <form method="POST" action="/logout" style="display: inline;">
          <button type="submit" class="btn btn-secondary">
            🚪 Logout
          </button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>`;
}
