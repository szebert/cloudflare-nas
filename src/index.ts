import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { browseRoute } from "./routes/browse";
import { detailsHandlerRoute, detailsPageRoute } from "./routes/details";
import { downloadRoute } from "./routes/download";
import { faviconRoute } from "./routes/favicon";
import { createFileRoute } from "./routes/file";
import { createFolderRoute } from "./routes/folder";
import { stylesRoute } from "./routes/styles";
import { uploadFilesRoute, uploadFolderRoute } from "./routes/upload";
import { webdavRoute } from "./routes/webdav";
import type { BucketInfo } from "./types";
import { discoverBuckets } from "./utils/buckets";
import { initLogger } from "./utils/logger";

const app = new Hono<{
  Bindings: Env;
  Variables: { buckets: BucketInfo[] };
}>();

// Initialize our global structured logger once per request
app.use("*", async (c, next) => {
  initLogger(c.env);
  await next();
});

// Basic authentication using env vars
app.use("*", async (c, next) => {
  const auth = basicAuth({
    username: c.env.AUTH_USERNAME,
    password: c.env.AUTH_PASSWORD,
  });
  return auth(c, next);
});

// Discover buckets dynamically
app.use("*", async (c, next) => {
  const discovered = discoverBuckets(c.env);
  c.set("buckets", discovered);
  await next();
});

// Handle .well-known requests (Chrome DevTools, etc.)
app.get("/.well-known/*", (c) => c.body(null, 204));

app.get("/style.css", stylesRoute);

// Serve favicon
app.get("/favicon.ico", (c) => {
  return c.redirect("/favicon.svg", 301);
});

app.get("/favicon.svg", faviconRoute);

// Root redirect to first bucket
app.get("/", (c) => {
  const buckets = c.get("buckets");
  if (buckets.length === 0) {
    return c.text("No R2 buckets configured", 500);
  }
  return c.redirect(`/b/${buckets[0].binding}/`);
});

// WebDAV routes for mounting as network drive (must be before other routes)
app.all("/webdav/:bucket/*", webdavRoute);
app.all("/webdav/:bucket", webdavRoute);

// Download files from bucket
app.get("/b/:bucket/download/*", downloadRoute);

// Create folder
app.post("/b/:bucket/folder", createFolderRoute);

// Create file
app.post("/b/:bucket/file", createFileRoute);

// Upload files
app.post("/b/:bucket/upload", uploadFilesRoute);

// Upload folder
app.post("/b/:bucket/upload-folder", uploadFolderRoute);

// Details page for file/folder (rename, delete, etc.) - must be before browse routes
app.get("/b/:bucket/details/*", detailsPageRoute);
app.post("/b/:bucket/details/*", detailsHandlerRoute);

// Browse bucket directories
app.get("/b/:bucket/*", browseRoute);
app.get("/b/:bucket", browseRoute);

export default app;
