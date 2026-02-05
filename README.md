# Cloudflare NAS

A lightweight, self-hosted file browser for Cloudflare R2 storage buckets. Browse, download, and organize your files with a clean directory-listing interface. **Mount as a network drive on Windows and macOS using WebDAV!**

## Features

- **🔒 Security & User Management**

  - Multi-user authentication with D1 database
  - Admin and regular user roles
  - First-run setup wizard for initial admin account
  - Session-based authentication for web UI
  - Basic Authentication for WebDAV/API
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

- **🔗 Shareable Links**

  - Create public share links for files and folders
  - Optional password protection
  - Optional expiration dates
  - Optional download limits
  - Manage active share links from settings

- **🎨 Theming**
  - Light, dark, and system-auto themes
  - Mobile-responsive design

## Roadmap

- [ ] Multi-part upload for large files
- [ ] PDF previews
- [ ] Granular share permissions (read/write per share)

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

### Quick Setup (Recommended)

The fastest way to get started is using the CLI:

```bash
pnpm dlx cloudflare-nas@latest
```

This interactive CLI will:

1. Check your Cloudflare authentication (or guide you to log in)
2. Create a D1 database for user management
3. Create or select an R2 bucket for storage
4. Deploy the worker and give you a URL

**That's it!** Visit the URL to create your admin account and start uploading files.

### Manual Setup

If you prefer to set things up manually:

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare account](https://dash.cloudflare.com/sign-up) with R2 enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

#### Steps

1. **Clone and install:**

   ```bash
   git clone https://github.com/your-username/cloudflare-nas
   cd cloudflare-nas/packages/worker
   pnpm install
   ```

2. **Create an R2 bucket** (if you don't have one):

   ```bash
   npx wrangler r2 bucket create my-bucket
   ```

3. **Configure your bucket** in `wrangler.jsonc`:

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

4. **Set up D1 database:**

   ```bash
   # Create the D1 database
   npx wrangler d1 create nas-db

   # Update wrangler.jsonc with the database_id from the output above
   # Then run the schema
   npx wrangler d1 execute nas-db --remote --file=schema.sql
   ```

5. **Run locally:**

   ```bash
   pnpm dev
   ```

   On first run, visit the login page and you'll be prompted to create your admin account.

6. **Deploy:**
   ```bash
   pnpm deploy
   ```

## Project Structure

This is a monorepo with two packages:

```
cloudflare-nas/
├── packages/
│   ├── cli/                  # CLI tool (published as cloudflare-nas)
│   │   ├── src/
│   │   │   ├── index.ts      # CLI entry point
│   │   │   ├── auth/         # Cloudflare authentication
│   │   │   ├── prompts/      # Interactive prompts
│   │   │   ├── resources/    # D1/R2 resource creation
│   │   │   ├── deploy/       # Worker deployment
│   │   │   └── ui/           # CLI output formatting
│   │   └── templates/        # Bundled worker code
│   │
│   └── worker/               # Cloudflare Worker (the NAS app)
│       ├── src/
│       │   ├── index.ts      # App entry, routes
│       │   ├── auth/         # Authentication middleware
│       │   ├── routes/       # HTTP route handlers
│       │   ├── storage/      # R2 storage abstraction
│       │   ├── ui/           # HTML page templates
│       │   └── utils/        # Utilities (logging, MIME detection)
│       ├── schema.sql        # D1 database schema
│       └── wrangler.jsonc    # Wrangler configuration
│
├── package.json              # Workspace root
└── pnpm-workspace.yaml       # PNPM workspace config
```
