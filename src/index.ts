import { Hono } from "hono";
import type { AuthenticatedUser } from "./auth/middleware";
import { authMiddleware, optionalAuthMiddleware } from "./auth/middleware";
import { loginHandlerRoute, loginPageRoute, logoutRoute, setupRoute } from "./routes/auth";
import { browseRoute } from "./routes/browse";
import { detailsHandlerRoute, detailsPageRoute } from "./routes/details";
import { downloadRoute } from "./routes/download";
import { faviconRoute } from "./routes/favicon";
import { createFileRoute } from "./routes/file";
import { createFolderRoute } from "./routes/folder";
import {
  changePasswordRoute,
  createUserRoute,
  deleteShareLinkSettingsRoute,
  deleteUserRoute,
  processChangePasswordRoute,
  resetUserPasswordRoute,
  setThemeRoute,
  settingsRoute,
  shareLinkDetailsPageRoute,
  shareLinksPageRoute,
  showChangePasswordRoute,
  toggleUserAdminRoute,
  updateShareLinkRoute,
  userDetailsPageRoute,
  usersPageRoute,
} from "./routes/settings";
import {
  accessShareRoute,
  browseShareRoute,
  createShareLinkRoute,
  deleteShareLinkRoute,
  downloadShareRoute,
  verifySharePasswordRoute,
} from "./routes/share";
import { stylesRoute } from "./routes/styles";
import { uploadFilesRoute, uploadFolderRoute } from "./routes/upload";
import { webdavRoute } from "./routes/webdav";
import type { BucketInfo } from "./types";
import { discoverBuckets, setCurrentBucket } from "./utils/buckets";
import { initLogger } from "./utils/logger";

const app = new Hono<{
  Bindings: Env;
  Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
}>();

// Initialize our global structured logger once per request
app.use("*", async (c, next) => {
  initLogger(c.env);
  await next();
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

// Auth routes (no auth required)
app.get("/login", loginPageRoute);
app.post("/login", loginHandlerRoute);
app.post("/setup", setupRoute); // First-run admin account creation
app.post("/logout", logoutRoute);

// Public share routes (no auth required, uses optional auth for buckets discovery)
app.use("/s/*", optionalAuthMiddleware);
// Download must come before wildcard route to not be caught by it
app.get("/s/:token/download", downloadShareRoute);
// Browse shared directories - wildcard catches subfolder paths
app.get("/s/:token/*", browseShareRoute);
app.get("/s/:token", accessShareRoute);
app.post("/s/:token", verifySharePasswordRoute);

// Change password routes (requires auth but allowed when must_change_password is set)
app.get("/change-password", authMiddleware, showChangePasswordRoute);
app.post("/change-password", authMiddleware, processChangePasswordRoute);

// Root redirect to first bucket (requires auth)
app.get("/", authMiddleware, (c) => {
  const buckets = c.get("buckets");
  if (buckets.length === 0) {
    return c.text("No R2 buckets configured", 500);
  }
  setCurrentBucket(c, buckets[0].binding);
  return c.redirect(`/b/${buckets[0].binding}/`);
});

// WebDAV routes for mounting as network drive (must be before other routes)
// WebDAV uses Basic Auth validated against D1
app.all("/webdav/:bucket/*", authMiddleware, webdavRoute);
app.all("/webdav/:bucket", authMiddleware, webdavRoute);

// All setting routes require authentication
app.use("/settings/*", authMiddleware);

// Settings page and management
app.get("/settings", settingsRoute);
app.post("/settings/theme", setThemeRoute);

// Settings sub-pages
app.get("/settings/users", usersPageRoute);
app.get("/settings/users/:id", userDetailsPageRoute);
app.post("/settings/users", createUserRoute);
app.post("/settings/users/:id/delete", deleteUserRoute);
app.post("/settings/users/:id/toggle-admin", toggleUserAdminRoute);
app.post("/settings/users/:id/reset-password", resetUserPasswordRoute);

app.post("/settings/password", changePasswordRoute);

app.get("/settings/links", shareLinksPageRoute);
app.get("/settings/links/:id", shareLinkDetailsPageRoute);
app.post("/settings/links/:id/update", updateShareLinkRoute);
app.post("/settings/links/:id/delete", deleteShareLinkSettingsRoute);

// All bucket routes require authentication
app.use("/b/*", authMiddleware);

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

// Share link management
app.post("/b/:bucket/share", createShareLinkRoute);
app.post("/b/:bucket/share/:id/delete", deleteShareLinkRoute);

// Details page for file/folder (rename, delete, etc.) - must be before browse routes
app.get("/b/:bucket/details/*", detailsPageRoute);
app.post("/b/:bucket/details/*", detailsHandlerRoute);

// Browse bucket directories
app.get("/b/:bucket/*", browseRoute);
app.get("/b/:bucket", browseRoute);

export default app;
