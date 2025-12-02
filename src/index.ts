import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { browseRoute } from "./routes/browse";
import { downloadRoute } from "./routes/download";
import { createFolderRoute } from "./routes/folder";
import type { BucketInfo } from "./types";
import { discoverBuckets } from "./utils/buckets";

const app = new Hono<{
  Bindings: Env;
  Variables: { buckets: BucketInfo[] };
}>();

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

// Serve favicon
app.get("/favicon.ico", (c) => {
  return c.redirect("/favicon.svg", 301);
});

app.get("/favicon.svg", (c) => {
  const isDev = c.env.DEV_MODE === "true";
  const strokeColor = isDev ? "#f00" : "#ff0"; // Red for dev, yellow for production
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 75 75"><rect width="70" height="70" x="2.5" y="2.5" stroke="${strokeColor}" stroke-width="5" ry="7.94"/><g clip-path="url(#a)" transform="translate(.1 17.54)"><path fill="#f6821f" d="m51.03 36.43.37-1.32c.46-1.58.3-3.04-.47-4.11a4.17 4.17 0 0 0-3.3-1.64l-26.9-.34a.53.53 0 0 1-.43-.23.54.54 0 0 1-.05-.48.72.72 0 0 1 .62-.48l27.15-.35c3.22-.14 6.7-2.77 7.93-5.97l1.55-4.07a.9.9 0 0 0 .06-.35c0-.06 0-.12-.02-.19A17.68 17.68 0 0 0 40.3 3.01a17.7 17.7 0 0 0-16.75 12.06 7.95 7.95 0 0 0-12.48 8.38 11.35 11.35 0 0 0-10.86 13c.03.26.26.45.52.45l49.67.01h.02c.27 0 .53-.2.6-.48z"/><path fill="#fbad41" d="m59.99 17.74-.75.01a.2.2 0 0 0-.11.03.43.43 0 0 0-.27.3l-1.07 3.66c-.45 1.58-.28 3.04.48 4.1.7 1 1.87 1.57 3.3 1.64l5.73.35a.5.5 0 0 1 .4.22c.1.14.12.32.07.5a.72.72 0 0 1-.63.47l-5.95.34c-3.23.16-6.73 2.78-7.95 5.98l-.43 1.13c-.08.21.07.43.28.44H73.6c.25 0 .46-.17.54-.4a14.74 14.74 0 0 0-14.16-18.77z"/></g><defs><clipPath id="a"><path fill="#fff" d="M.1 2H232v35.93H.1z"/></clipPath></defs></svg>`;
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=31536000",
  });
});

// Root redirect to first bucket
app.get("/", (c) => {
  const buckets = c.get("buckets");
  if (buckets.length === 0) {
    return c.text("No R2 buckets configured", 500);
  }
  return c.redirect(`/b/${buckets[0].binding}/`);
});

// Download files from bucket
app.get("/b/:bucket/download/*", downloadRoute);

// Create folder
app.post("/b/:bucket/folder", createFolderRoute);

// Browse bucket directories
app.get("/b/:bucket/*", browseRoute);
app.get("/b/:bucket", browseRoute);

export default app;
