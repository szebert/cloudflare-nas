import type { BucketInfo, Theme } from "../types";

export function renderThemeSwitcher(
  bucket: BucketInfo,
  path: string,
  currentTheme: Theme,
  options?: { isDetailsPage?: boolean; isDirectory?: boolean }
): string {
  const themes: { value: Theme; emoji: string; label: string }[] = [
    { value: "system", emoji: "🌓", label: "Auto" },
    { value: "light", emoji: "☀️", label: "Light" },
    { value: "dark", emoji: "🌙", label: "Dark" },
  ];

  const isDetailsPage = options?.isDetailsPage ?? false;
  const isDirectory = options?.isDirectory ?? false;

  let basePath: string;
  if (isDetailsPage) {
    basePath = `/b/${bucket.binding}/details/${path}${isDirectory ? "/" : ""}`;
  } else {
    basePath = path ? `/b/${bucket.binding}/${path}` : `/b/${bucket.binding}/`;
  }

  const currentEmoji =
    themes.find((t) => t.value === currentTheme)?.emoji || "🌓";

  const themeOptions = themes
    .map((t) => {
      const isCurrent = t.value === currentTheme;
      const className = isCurrent ? "popup-item current" : "popup-item";
      return `<a href="${basePath}?theme=${t.value}" class="${className}">${t.emoji} ${t.label}</a>`;
    })
    .join("");

  return `
    <div class="switcher-popup">
      <button type="button" class="switcher-btn">
        ${currentEmoji} Theme ▾
      </button>
      <div class="popup-menu">
        ${themeOptions}
      </div>
    </div>`;
}

export function renderBucketSwitcher(
  buckets: BucketInfo[],
  currentBucket: BucketInfo,
  theme: Theme
): string {
  // Don't render if only one bucket
  if (buckets.length <= 1) return "";

  const options = buckets
    .map((b) => {
      const isCurrent = b.binding === currentBucket.binding;
      const className = isCurrent ? "popup-item current" : "popup-item";
      return `<a href="/b/${b.binding}/?theme=${theme}" class="${className}">📁 ${b.binding}</a>`;
    })
    .join("");

  return `
    <div class="switcher-popup">
      <button type="button" class="switcher-btn">
        📁 ${currentBucket.binding} ▾
      </button>
      <div class="popup-menu">
        ${options}
      </div>
    </div>`;
}

export function renderNewMenu(): string {
  return `
    <div class="switcher-popup">
      <button type="button" class="switcher-btn">
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
