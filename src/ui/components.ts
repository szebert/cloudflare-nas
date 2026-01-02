import type { BucketInfo, Theme } from "../types";

export function renderHead(options: { title: string; theme: Theme }): string {
  const { title, theme } = options;
  const darkReaderMeta =
    theme === "dark" ? `<meta name="darkreader-lock">` : "";

  return `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${darkReaderMeta}
      <title>${title}</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg">
      <link rel="stylesheet" href="/style.css?theme=${theme}">
    </head>`;
}

export function renderThemeSwitcher(
  bucket: BucketInfo,
  currentTheme: Theme
): string {
  const themes: { value: Theme; emoji: string; label: string }[] = [
    { value: "dark", emoji: "🌙", label: "Dark" },
    { value: "system", emoji: "🌓", label: "Auto" },
    { value: "light", emoji: "☀️", label: "Light" },
  ];

  const currentEmoji =
    themes.find((t) => t.value === currentTheme)?.emoji || "🌓";

  const themeOptions = themes
    .map((t) => {
      const isCurrent = t.value === currentTheme;
      const className = isCurrent ? "popup-item current" : "popup-item";
      return `<button type="submit" name="theme" value="${t.value}" class="${className}">${t.emoji} ${t.label}</button>`;
    })
    .join("");

  return `
    <form method="POST" action="/settings/theme" class="btn-action-popup">
      <button type="button" class="btn btn-action">
        ${currentEmoji} Theme ▾
      </button>
      <div class="popup-menu">
        ${themeOptions}
      </div>
    </form>`;
}

export function renderThemeButtonGroup(
  _bucketBinding: string,
  currentTheme: Theme,
): string {
  const themes: { value: Theme; emoji: string; label: string }[] = [
    { value: "dark", emoji: "🌙", label: "Dark" },
    { value: "system", emoji: "🌓", label: "Auto" },
    { value: "light", emoji: "☀️", label: "Light" },
  ];

  const buttons = themes
    .map((t) => {
      const isCurrent = t.value === currentTheme;
      const className = isCurrent ? "btn btn-theme active" : "btn btn-theme";
      const disabled = isCurrent ? " disabled" : "";
      return `<button type="submit" name="theme" value="${t.value}" class="${className}"${disabled}>${t.emoji} ${t.label}</button>`;
    })
    .join("");

  return `
    <form method="POST" action="/settings/theme">
      <div class="theme-button-group">
        ${buttons}
      </div>
    </form>`;
}

export function renderBucketSwitcher(
  buckets: BucketInfo[],
  currentBucket: BucketInfo
): string {
  // Don't render if only one bucket
  if (buckets.length <= 1) return "";

  const options = buckets
    .map((b) => {
      const isCurrent = b.binding === currentBucket.binding;
      const className = isCurrent ? "popup-item current" : "popup-item";
      return `<a href="/b/${b.binding}/" class="${className}">📁 ${b.binding}</a>`;
    })
    .join("");

  return `
    <div class="btn-action-popup">
      <button type="button" class="btn btn-action">
        📁 ${currentBucket.binding} ▾
      </button>
      <div class="popup-menu">
        ${options}
      </div>
    </div>`;
}

export function renderNewMenu(): string {
  return `
    <div class="btn-action-popup">
      <button type="button" class="btn btn-action">
        ➕ New ▾
      </button>
      <div class="popup-menu">
        <a href="#new-file" class="popup-item">
          📄 New File
        </a>
        <a href="#new-folder" class="popup-item">
          📁 New Folder
        </a>
        <a href="#upload-files" class="popup-item">
          📤 Upload Files
        </a>
        <a href="#upload-folder" class="popup-item">
          📂 Upload Folder
        </a>
      </div>
    </div>`;
}
