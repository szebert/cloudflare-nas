# Cloudflare NAS

A lightweight, self-hosted file browser for Cloudflare R2 storage buckets. Browse, download, and organize your files with a clean directory-listing interface. **Mount as a network drive on Windows and macOS using WebDAV!**

## Features

- **🔒 Security**

  - Basic Authentication
  - Self-hosted on your Cloudflare account

- **📁 File Management**

  - Directory listing with sortable columns (name, type, modified, size)
  - Multi-bucket support with easy switching
  - Create new files with content
  - Create folders
  - Upload files (multiple at once)
  - Upload entire folders (preserves directory structure)
  - File downloads
  - Rename & delete operations
  - Edit text files directly in the browser (up to 1MB)

- **👁️ File Preview**

  - Image preview (JPEG, PNG, GIF, WebP, SVG, and more)
  - Video preview with native player controls
  - Text file preview with syntax highlighting
  - Automatic MIME type detection via magic bytes

- **📝 Metadata Management**

  - View and edit custom metadata (key-value pairs)
  - Manage HTTP metadata (contentType, cacheControl, contentDisposition, etc.)
  - Full metadata editing interface in file details page

- **💾 Network Drive Support (WebDAV)**

  - Mount as a network drive on Windows
  - Mount as a network drive on macOS
  - Full read/write support via WebDAV protocol

- **🎨 Theming**
  - Light, dark, and system-auto themes
  - Mobile-responsive design

## Roadmap

- [ ] Multi-part upload for large files
- [ ] PDF previews
- [ ] Cloudflare D1 integration
  - User authentication and management
  - Permission levels (read, write, admin)
  - Support for shareable links with permission controls
- [ ] Shareable links (requires D1 integration for permissions)
- [ ] npm package distribution
  - Quick setup via `pnpm dlx cloudflare-nas`
  - CLI tool for initialization
  - Template-based project generation

## Mounting as a Network Drive

This project supports WebDAV, allowing you to mount your R2 buckets as network drives on Windows and macOS. **Note:** Cloudflare Workers cannot run SSH/SFTP servers (they're HTTP-only), but WebDAV provides the same functionality for mounting network drives.

### Windows

1. Open **File Explorer**
2. Right-click **This PC** (or **My Computer**) and select **Map network drive...**
3. Choose a drive letter (e.g., `Z:`)
4. In the **Folder** field, enter your WebDAV URL:
   ```
   https://your-worker.your-subdomain.workers.dev/webdav/your-bucket-name
   ```
5. Check **Connect using different credentials**
6. Click **Finish**
7. Enter your credentials:
   - Username: Your `AUTH_USERNAME`
   - Password: Your `AUTH_PASSWORD`
8. Check **Remember my credentials** if desired
9. Click **OK**

**Alternative (Command Line):**

```cmd
net use Z: https://your-worker.your-subdomain.workers.dev/webdav/your-bucket-name /user:your-username your-password /persistent:yes
```

### macOS

1. Open **Finder**
2. Press `Cmd + K` (or go to **Go** → **Connect to Server...**)
3. Enter your WebDAV URL:
   ```
   https://your-worker.your-subdomain.workers.dev/webdav/your-bucket-name
   ```
4. Click **Connect**
5. When prompted, select **Registered User**
6. Enter your credentials:
   - Username: Your `AUTH_USERNAME`
   - Password: Your `AUTH_PASSWORD`
7. Click **Connect**
8. The drive will appear in Finder's sidebar

**Alternative (Command Line):**

```bash
open "https://your-worker.your-subdomain.workers.dev/webdav/your-bucket-name"
```

### WebDAV Features

The WebDAV implementation supports:

- ✅ **PROPFIND** - Browse directories
- ✅ **GET** - Download files
- ✅ **PUT** - Upload files
- ✅ **DELETE** - Delete files and folders
- ✅ **MKCOL** - Create directories
- ✅ **MOVE** - Rename/move files and folders
- ✅ **COPY** - Copy files and folders
- ✅ **HEAD** - Get file metadata
- ✅ **OPTIONS** - Discover capabilities

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare account](https://dash.cloudflare.com/sign-up) with R2 enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

   > **Note:** In the future, you'll be able to quickly set up a new project using `pnpm dlx cloudflare-nas`. Stay tuned!

2. **Create an R2 bucket** (if you don't have one):

   ```bash
   npx wrangler r2 bucket create my-bucket
   ```

3. **Configure your bucket** in `wrangler.json`:

   ```json
   {
     "r2_buckets": [
       {
         "binding": "my-bucket",
         "bucket_name": "my-bucket"
       }
     ]
   }
   ```

4. **Set authentication credentials** in `.dev.vars` (for local dev):

   ```
   AUTH_USERNAME=admin
   AUTH_PASSWORD=your-secure-password
   ```

   For production, set these as secrets:

   ```bash
   npx wrangler secret put AUTH_PASSWORD
   ```

5. **Run locally:**

   ```bash
   npm run dev
   ```

6. **Deploy:**
   ```bash
   npm run deploy
   ```

## Project Structure

```
src/
├── index.ts          # App entry, routes, auth middleware
├── types.ts          # TypeScript types
├── routes/
│   ├── browse.ts     # Directory listing
│   ├── details.ts    # File/folder details, preview, edit, metadata
│   ├── download.ts   # File downloads
│   ├── file.ts       # File creation
│   ├── folder.ts     # Folder creation
│   ├── upload.ts     # File and folder uploads
│   ├── webdav.ts     # WebDAV protocol implementation
│   └── ...
├── storage/
│   ├── interface.ts  # Generic storage abstraction
│   └── r2-adapter.ts # R2 storage implementation
├── ui/
│   ├── components.ts # UI components (switchers, menus)
│   ├── details-page.ts # File details and preview page
│   └── listing-page.ts # Main directory listing page
├── styles/
│   ├── base.css      # Base styles
│   ├── dark.css      # Dark theme
│   └── light.css     # Light theme
└── utils/
    ├── buckets.ts    # Bucket discovery
    ├── format.ts     # Formatting utilities
    ├── logger.ts     # Structured logging
    └── mime-detection.ts # MIME type detection (magic bytes)
```
