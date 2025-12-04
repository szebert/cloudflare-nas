import type { Theme } from "../types";
import { getThemeStyles } from "./styles";

export interface ActionsPageOptions {
  bucketBinding: string;
  name: string;
  parentPath: string;
  fullPath: string;
  isDirectory: boolean;
  theme: Theme;
}

export function renderActionsPage(options: ActionsPageOptions): string {
  const { bucketBinding, name, parentPath, fullPath, isDirectory, theme } =
    options;

  const icon = isDirectory ? "📁" : "📄";
  const itemType = isDirectory ? "folder" : "file";
  const cancelUrl = parentPath
    ? `/b/${bucketBinding}/${parentPath}`
    : `/b/${bucketBinding}/`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actions - ${name}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  ${getThemeStyles(theme)}
</head>
<body>
  <div class="actions-page">
    <div class="actions-header">
      <h1>${icon} ${name}</h1>
      <div class="path-info">/${fullPath}</div>
    </div>

    <!-- Rename Section -->
    <div class="action-section modal">
      <h2>✏️ Rename</h2>
      <form method="POST">
        <input type="hidden" name="action" value="rename">
        <input type="hidden" name="parentPath" value="${parentPath}">
        <input type="hidden" name="oldName" value="${name}">
        <input type="hidden" name="isDirectory" value="${isDirectory}">
        <input type="hidden" name="theme" value="${theme}">
        <input type="text" name="newName" value="${name}" required>
        <button type="submit" class="btn btn-primary">Rename</button>
      </form>
    </div>

    <!-- Delete Section -->
    <div class="action-section danger modal">
      <h2>🗑️ Delete</h2>
      <p>This will permanently delete this ${itemType}${
    isDirectory ? " and all its contents" : ""
  }. This action cannot be undone.</p>
      <form method="POST">
        <input type="hidden" name="action" value="delete">
        <input type="hidden" name="parentPath" value="${parentPath}">
        <input type="hidden" name="name" value="${name}">
        <input type="hidden" name="isDirectory" value="${isDirectory}">
        <input type="hidden" name="theme" value="${theme}">
        <button type="submit" class="btn btn-danger">Delete ${itemType}</button>
      </form>
    </div>

    <a href="${cancelUrl}?theme=${theme}" class="back-link">← Back to listing</a>
  </div>
</body>
</html>`;
}
