# Cloudflare NAS

A lightweight, self-hosted file browser for Cloudflare R2 storage buckets. Browse, download, and organize your files with a clean directory-listing interface.

## Features

- **🔒 Security**

  - Basic Authentication
  - Self-hosted on your Cloudflare account

- **📁 File Management**

  - Directory listing with sortable columns (name, modified, size)
  - Multi-bucket support with easy switching
  - Create new files with content
  - Create folders
  - Upload files (multiple at once)
  - File downloads

- **🎨 Theming**
  - Light, dark, and system-auto themes
  - Mobile-responsive design

## Roadmap

- [ ] Multi-part upload for large files
- [ ] File preview (images, PDF, text, markdown)
- [ ] Rename & delete operations
- [ ] Metadata editing
- [ ] Shareable links
- [ ] Cloudflare Access integration

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
│   ├── download.ts   # File downloads
│   └── folder.ts     # Folder creation
├── ui/
│   ├── styles.ts     # CSS theming
│   ├── components.ts # UI components (switchers, menus)
│   └── listing-page.ts # Main page template
└── utils/
    ├── buckets.ts    # Bucket discovery
    └── format.ts     # Formatting utilities
```
