/**
 * Public share access page UI
 */

import type { Theme } from "../types";
import { escapeHtml, formatISOString } from "../utils/format";
import { renderHead } from "./components";

export interface SharePageOptions {
  theme: Theme;
  error?: string;
  shareLink?: {
    token: string;
    r2_path: string;
    is_directory: boolean;
    expires_at: number | null;
    max_downloads: number | null;
    download_count: number;
  };
}

export interface SharePasswordPageOptions {
  token: string;
  theme: Theme;
  error?: string;
}

export function renderSharePage(options: SharePageOptions): string {
  const { theme, error, shareLink } = options;

  let content = "";
  let pageTitle = "Shared Content";

  if (error) {
    content = `
      <div class="container-content">
        <h2 class="container-error">⚠️ Unable to Access Share</h2>
        <p>${escapeHtml(error)}</p>
        <a href="/" class="btn btn-primary">Go to Home</a>
      </div>
    `;
  } else if (shareLink) {
    const filename = shareLink.r2_path.split("/").filter(Boolean).pop() || shareLink.r2_path;
    pageTitle = `${filename} - Shared Content`;
    const expiresInfo = shareLink.expires_at
      ? `Expires: ${formatISOString(new Date(shareLink.expires_at))}`
      : "No expiration";
    const downloadsInfo = shareLink.max_downloads
      ? `Downloads: ${shareLink.download_count} / ${shareLink.max_downloads}`
      : `Downloads: ${shareLink.download_count}`;

    if (shareLink.is_directory) {
      content = `
        <div class="container-content">
          <h2>📁 Shared Folder</h2>
          <p class="share-filename">${escapeHtml(filename)}</p>
          <div class="share-info">
            <p>${expiresInfo}</p>
            <p>${downloadsInfo}</p>
          </div>
          <p class="share-note">This is a shared folder. Directory browsing coming soon.</p>
        </div>
      `;
    } else {
      content = `
        <div class="container-content">
          <h2>📄 Shared File</h2>
          <p class="share-filename">${escapeHtml(filename)}</p>
          <div class="share-info">
            <p>${expiresInfo}</p>
            <p>${downloadsInfo}</p>
          </div>
          <a href="/s/${shareLink.token}/download" class="btn btn-primary">
            ⬇️ Download
          </a>
        </div>
      `;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: pageTitle, theme })}
<body>
  <div>
    <div class="container">
      <h1>Cloudflare NAS</h1>
      ${content}
    </div>
  </div>
</body>
</html>`;
}

export function renderSharePasswordPage(options: SharePasswordPageOptions): string {
  const { token, theme, error } = options;

  return `<!DOCTYPE html>
<html lang="en">
${renderHead({ title: "Protected Share", theme })}
<body>
  <div>
    <div class="container">
      <h1>🔒 Protected Share</h1>
      <p>This shared content is password protected.</p>
      
      ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ""}
      
      <form method="POST" action="/s/${token}" class="container-form">
        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autofocus
          />
        </div>
        
        <button type="submit" class="btn btn-primary">Access Content</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

