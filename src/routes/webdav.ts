import type { Context } from "hono";
import type { BucketInfo } from "../types";
import { getBucketByBinding } from "../utils/buckets";
import { escapeXml } from "../utils/format";
import { logger } from "../utils/logger";
import { detectContentType } from "../utils/mime-detection";

export async function webdavRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const log = logger();
  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");
  const method = c.req.method;
  const url = new URL(c.req.url);

  log.debug("WEBDAV incoming request", {
    method,
    pathname: url.pathname,
    bucketBinding,
  });

  // Get the bucket info
  const bucketInfo = getBucketByBinding(buckets, bucketBinding);
  if (!bucketInfo) {
    log.warn("WEBDAV bucket not found", { bucketBinding });
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  // Extract path from URL
  let path = decodeURIComponent(url.pathname)
    .replace(`/webdav/${bucketBinding}`, "")
    .replace(/^\/+/, "");

  // Preserve trailing slash if present (indicates directory)
  const hadTrailingSlash = url.pathname.endsWith("/");

  // Handle root path
  if (!path) {
    path = "";
  } else if (hadTrailingSlash && !path.endsWith("/")) {
    // Restore trailing slash if it was in the original URL
    path += "/";
  }

  log.debug("WEBDAV resolved path", { path, hadTrailingSlash });

  // Route to appropriate handler
  switch (method) {
    case "OPTIONS":
      return handleOptions(c);
    case "PROPFIND":
      return handlePropfind(c, bucketInfo, path);
    case "GET":
      return handleGet(c, bucketInfo, path);
    case "HEAD":
      return handleHead(c, bucketInfo, path);
    case "PUT":
      return handlePut(c, bucketInfo, path);
    case "DELETE":
      return handleDelete(c, bucketInfo, path);
    case "MKCOL":
      return handleMkcol(c, bucketInfo, path);
    case "MOVE":
      return handleMove(c, bucketInfo, path);
    case "COPY":
      return handleCopy(c, bucketInfo, path);
    case "LOCK":
      return handleLock(c, bucketInfo, path);
    case "UNLOCK":
      return handleUnlock(c, bucketInfo, path);
    case "PROPPATCH":
      return handleProppatch(c, bucketInfo, path);
    default:
      logger().warn("WEBDAV method not allowed", { method });
      return c.text(`Method ${method} not allowed`, 405);
  }
}

function handleOptions(c: Context) {
  const headers = new Headers();
  headers.set("DAV", "1, 2");
  headers.set(
    "Allow",
    "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH"
  );
  headers.set("MS-Author-Via", "DAV");
  return new Response(null, { status: 200, headers });
}

async function handlePropfind(
  c: Context,
  bucketInfo: BucketInfo,
  path: string
) {
  const log = logger();
  const depth = c.req.header("Depth") || "1";

  log.debug("PROPFIND start", { path, depth });

  // Parse request body if present (for specific property requests)
  let requestedProps: string[] = [];
  try {
    const body = await c.req.text();
    if (body) {
      // Simple XML parsing for propfind - extract prop names
      const propMatches = body.match(/<D:prop><D:([^>]+)>/g);
      if (propMatches) {
        requestedProps = propMatches.map((m) => m.replace(/<[^>]+>/g, ""));
      }
    }
  } catch {
    // Ignore parsing errors, use default props
  }

  // Default properties if none specified
  if (requestedProps.length === 0) {
    requestedProps = [
      "displayname",
      "resourcetype",
      "getcontentlength",
      "getlastmodified",
      "getcontenttype",
    ];
  }

  // Determine if path is a directory
  // If path ends with / or is empty, it's definitely a directory
  // Otherwise, check if it exists as a directory by listing with that prefix
  let isDirectory = path === "" || path.endsWith("/");

  // If path doesn't end with /, check if it's actually a directory
  if (!isDirectory && path) {
    const testList = await bucketInfo.bucket.list({
      prefix: `${path}/`,
      delimiter: "/",
      limit: 1,
    });
    // If we get any results with this prefix, it's a directory
    isDirectory =
      testList.objects.length > 0 || testList.delimitedPrefixes.length > 0;
  }

  // If it's not a directory, make sure the file actually exists.
  // If it doesn't, return 404 so Windows knows there's no file yet.
  if (!isDirectory && path) {
    const head = await bucketInfo.bucket.head(path);
    log.debug("PROPFIND single-file existence check", {
      path,
      exists: !!head,
      size: head?.size,
    });
    if (!head) {
      return c.text("Not Found", 404);
    }
  }

  const entries: Array<{ path: string; isDirectory: boolean }> = [];

  if (isDirectory) {
    // List directory contents
    // Normalize path - remove trailing slash before adding it back to avoid double slashes
    const normalizedPath = path.replace(/\/+$/, "");
    const prefix = normalizedPath ? `${normalizedPath}/` : "";
    const listed = await bucketInfo.bucket.list({
      prefix,
      delimiter: "/",
      include: ["httpMetadata"],
    });

    log.debug("PROPFIND directory listing", {
      path,
      normalizedPath,
      prefix,
      objectCount: listed.objects.length,
      dirCount: listed.delimitedPrefixes.length,
    });

    // Add current directory (use normalized path)
    const currentPath = normalizedPath || "/";
    entries.push({
      path: currentPath.endsWith("/") ? currentPath : currentPath + "/",
      isDirectory: true,
    });

    // Add subdirectories
    for (const dirPrefix of listed.delimitedPrefixes) {
      // Remove the current prefix and trailing slash to get just the folder name
      let relativePath = dirPrefix;
      if (prefix) {
        relativePath = dirPrefix.replace(prefix, "");
      }
      // Remove trailing slash
      relativePath = relativePath.replace(/\/$/, "");

      if (relativePath) {
        // Construct full path - ensure it doesn't have double slashes
        let fullPath = normalizedPath
          ? `${normalizedPath}/${relativePath}`.replace(/\/+/g, "/")
          : relativePath;
        // Ensure directory paths end with a slash for consistency
        if (!fullPath.endsWith("/")) {
          fullPath += "/";
        }
        entries.push({ path: fullPath, isDirectory: true });
      }
    }

    // Add files
    for (const obj of listed.objects) {
      if (obj.key === prefix || obj.key.endsWith("/")) continue;
      const relativePath = obj.key.replace(prefix, "");
      const fullPath = normalizedPath
        ? `${normalizedPath}/${relativePath}`
        : relativePath;
      entries.push({ path: fullPath, isDirectory: false });
    }

    // If depth is 0, only return current directory
    if (depth === "0") {
      entries.splice(1);
    }
  } else {
    // Single file
    entries.push({ path, isDirectory: false });
  }

  // Build XML response
  const responses = await Promise.all(
    entries.map(async (entry) => {
      // Normalize path for href construction
      let fullPath = entry.path === "/" ? "" : entry.path;
      // Remove leading slash if present, but keep trailing slash for directories
      fullPath = fullPath.replace(/^\/+/, "");

      // Construct href - WebDAV hrefs should use raw paths (XML escaping handles special chars)
      let href = `/webdav/${bucketInfo.binding}`;
      if (fullPath) {
        href += "/" + fullPath;
      } else if (entry.isDirectory) {
        href += "/";
      }

      if (entry.isDirectory) {
        return `    <D:response>
      <D:href>${escapeXml(href)}</D:href>
      <D:propstat>
        <D:prop>
          ${
            requestedProps.includes("displayname")
              ? `<D:displayname>${escapeXml(
                  entry.path.replace(/\/$/, "").split("/").pop() || "/"
                )}</D:displayname>`
              : ""
          }
          ${
            requestedProps.includes("resourcetype")
              ? `<D:resourcetype><D:collection/></D:resourcetype>`
              : ""
          }
          ${
            requestedProps.includes("getcontentlength")
              ? `<D:getcontentlength/>`
              : ""
          }
          ${
            requestedProps.includes("getlastmodified")
              ? `<D:getlastmodified/>`
              : ""
          }
          ${
            requestedProps.includes("getcontenttype")
              ? `<D:getcontenttype/>`
              : ""
          }
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;
      } else {
        // Get file metadata
        const head = await bucketInfo.bucket.head(fullPath);
        log.debug("PROPFIND file entry", {
          entryPath: entry.path,
          fullPath,
          exists: !!head,
          size: head?.size,
        });

        // Defensive: file might have been deleted between earlier check and now
        if (!head) {
          return `    <D:response>
            <D:href>${escapeXml(href)}</D:href>
            <D:status>HTTP/1.1 404 Not Found</D:status>
          </D:response>`;
        }

        const size = head.size;
        const modified = head?.uploaded
          ? head.uploaded.toUTCString()
          : new Date().toUTCString();
        const contentType =
          head?.httpMetadata?.contentType || "application/octet-stream";
        const name = entry.path.split("/").pop() || entry.path;

        return `    <D:response>
      <D:href>${escapeXml(href)}</D:href>
      <D:propstat>
        <D:prop>
          ${
            requestedProps.includes("displayname")
              ? `<D:displayname>${escapeXml(name)}</D:displayname>`
              : ""
          }
          ${requestedProps.includes("resourcetype") ? `<D:resourcetype/>` : ""}
          ${
            requestedProps.includes("getcontentlength")
              ? `<D:getcontentlength>${size}</D:getcontentlength>`
              : ""
          }
          ${
            requestedProps.includes("getlastmodified")
              ? `<D:getlastmodified>${modified}</D:getlastmodified>`
              : ""
          }
          ${
            requestedProps.includes("getcontenttype")
              ? `<D:getcontenttype>${contentType}</D:getcontenttype>`
              : ""
          }
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;
      }
    })
  );

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${responses.join("\n")}
</D:multistatus>`;

  log.debug("PROPFIND done", { path, entryCount: entries.length });

  return new Response(xml, {
    status: 207,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      DAV: "1, 2",
    },
  });
}

async function handleGet(c: Context, bucketInfo: BucketInfo, path: string) {
  const log = logger();

  if (path.endsWith("/")) {
    return c.text("Cannot GET directory", 400);
  }

  const object = await bucketInfo.bucket.get(path);
  log.debug("GET", { path, exists: !!object, size: object?.size });
  if (!object) {
    return c.text("File not found", 404);
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Content-Length", object.size.toString());
  headers.set("ETag", object.httpEtag);
  if (object.uploaded) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  return new Response(object.body, { headers });
}

async function handleHead(c: Context, bucketInfo: BucketInfo, path: string) {
  if (path.endsWith("/")) {
    // Directory
    const headers = new Headers();
    headers.set("Content-Type", "httpd/unix-directory");
    return new Response(null, { status: 200, headers });
  }

  const head = await bucketInfo.bucket.head(path);
  if (!head) {
    return c.text("File not found", 404);
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    head.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Content-Length", head.size.toString());
  headers.set("ETag", head.httpEtag);
  if (head.uploaded) {
    headers.set("Last-Modified", head.uploaded.toUTCString());
  }

  return new Response(null, { status: 200, headers });
}

async function handlePut(c: Context, bucketInfo: BucketInfo, path: string) {
  const log = logger();

  if (path.endsWith("/")) {
    log.debug("PUT reject directory path", { path });
    return c.text("Cannot PUT to directory path", 400);
  }

  try {
    const ifNoneMatch = c.req.header("If-None-Match");
    const ifMatch = c.req.header("If-Match");
    const contentLength = c.req.header("Content-Length");
    let contentType =
      c.req.header("Content-Type") || "application/octet-stream";

    // Check if file already exists
    const existing = await bucketInfo.bucket.head(path);
    log.debug("PUT existing head", {
      exists: !!existing,
      size: existing?.size,
      etag: existing?.httpEtag,
    });

    // Check if there's a directory placeholder with the same name (path + "/")
    // If so, delete it since we're creating a file, not a directory
    const dirPlaceholder = path + "/";
    const dirCheck = await bucketInfo.bucket.head(dirPlaceholder);
    if (
      dirCheck &&
      dirCheck.httpMetadata?.contentType === "httpd/unix-directory"
    ) {
      log.debug("PUT deleting directory placeholder", { dirPlaceholder });
      // Delete the directory placeholder
      await bucketInfo.bucket.delete(dirPlaceholder);
    }

    // Read the request body (may be 0 bytes — that's fine)
    const body = await c.req.arrayBuffer();
    log.debug("PUT body length", { byteLength: body.byteLength });

    // If Content-Type is generic or missing, detect from file content/extension
    if (contentType === "application/octet-stream" || !contentType) {
      const detected = await detectContentType({
        contentType,
        filePath: path,
        bytes: body.byteLength > 0 ? body : undefined,
      });
      if (detected) {
        contentType = detected;
        log.debug("PUT detected content type", {
          path,
          detectedType: detected,
        });
      }
    }

    log.debug("PUT start", {
      path,
      ifNoneMatch,
      ifMatch,
      contentLength,
      contentType,
    });

    // Always allow PUT to overwrite (WebDAV standard behavior),
    // and always write the body, even if it's 0 bytes.
    await bucketInfo.bucket.put(path, body, {
      httpMetadata: {
        contentType,
      },
    });

    // Verify what R2 stored
    const after = await bucketInfo.bucket.head(path);
    log.debug("PUT after put head", {
      exists: !!after,
      size: after?.size,
      etag: after?.httpEtag,
    });

    const status = existing ? 204 : 201;
    log.info("PUT completed", { path, status });

    // Return 204 (No Content) if file existed, 201 (Created) if new
    return new Response(null, { status });
  } catch (error) {
    logger().error("PUT error", { path, error: String(error) });
    return c.text(`Failed to upload: ${String(error)}`, 500);
  }
}

async function handleDelete(c: Context, bucketInfo: BucketInfo, path: string) {
  try {
    if (path.endsWith("/") || path === "") {
      // Directory deletion
      const prefix = path === "" ? "" : path;
      const listed = await bucketInfo.bucket.list({ prefix });

      for (const obj of listed.objects) {
        await bucketInfo.bucket.delete(obj.key);
      }

      // Also delete any subdirectories (they're represented as objects with trailing /)
      const allListed = await bucketInfo.bucket.list({
        prefix,
        delimiter: "/",
      });
      for (const obj of allListed.objects) {
        if (obj.key.endsWith("/")) {
          await bucketInfo.bucket.delete(obj.key);
        }
      }
    } else {
      // File deletion
      await bucketInfo.bucket.delete(path);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logger().error("DELETE error", { path, error: String(error) });
    return c.text(`Failed to delete: ${String(error)}`, 500);
  }
}

async function handleMkcol(c: Context, bucketInfo: BucketInfo, path: string) {
  if (!path.endsWith("/")) {
    path += "/";
  }

  // In R2, directories don't exist as separate objects, but we can create a placeholder
  // Some clients expect this. We'll create an empty object with the directory path
  try {
    // Check if already exists
    const existing = await bucketInfo.bucket.head(path);
    if (existing) {
      return c.text("Directory already exists", 405);
    }

    // Create directory placeholder (empty object with trailing slash)
    await bucketInfo.bucket.put(path, new Uint8Array(0), {
      httpMetadata: {
        contentType: "httpd/unix-directory",
      },
    });

    return new Response(null, { status: 201 });
  } catch (error) {
    logger().error("MKCOL error", { path, error: String(error) });
    return c.text(`Failed to create directory: ${String(error)}`, 500);
  }
}

async function handleMove(c: Context, bucketInfo: BucketInfo, path: string) {
  const destination = c.req.header("Destination");
  if (!destination) {
    return c.text("Destination header required", 400);
  }

  try {
    const destUrl = new URL(destination);
    const destPath = decodeURIComponent(destUrl.pathname)
      .replace(`/webdav/${bucketInfo.binding}`, "")
      .replace(/^\/+/, "");

    if (path === destPath) {
      return new Response(null, { status: 204 });
    }

    const isDirectory = path.endsWith("/") || path === "";

    if (isDirectory) {
      // Move directory (all objects with prefix)
      const oldPrefix =
        path === "" ? "" : path.endsWith("/") ? path : `${path}/`;
      const newPrefix = destPath.endsWith("/") ? destPath : `${destPath}/`;

      const listed = await bucketInfo.bucket.list({ prefix: oldPrefix });

      for (const obj of listed.objects) {
        const newKey = obj.key.replace(oldPrefix, newPrefix);
        const source = await bucketInfo.bucket.get(obj.key);
        if (source) {
          await bucketInfo.bucket.put(newKey, source.body, {
            httpMetadata: source.httpMetadata,
            customMetadata: source.customMetadata,
          });
          await bucketInfo.bucket.delete(obj.key);
        }
      }
    } else {
      // Move file
      const source = await bucketInfo.bucket.get(path);
      if (!source) {
        return c.text("Source not found", 404);
      }

      await bucketInfo.bucket.put(destPath, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
      });
      await bucketInfo.bucket.delete(path);
    }

    return new Response(null, { status: 201 });
  } catch (error) {
    logger().error("MOVE error", { path, destination, error: String(error) });
    return c.text(`Failed to move: ${String(error)}`, 500);
  }
}

async function handleCopy(c: Context, bucketInfo: BucketInfo, path: string) {
  const destination = c.req.header("Destination");
  if (!destination) {
    return c.text("Destination header required", 400);
  }

  try {
    const destUrl = new URL(destination);
    const destPath = decodeURIComponent(destUrl.pathname)
      .replace(`/webdav/${bucketInfo.binding}`, "")
      .replace(/^\/+/, "");

    if (path === destPath) {
      return new Response(null, { status: 204 });
    }

    const isDirectory = path.endsWith("/") || path === "";

    if (isDirectory) {
      // Copy directory (all objects with prefix)
      const oldPrefix =
        path === "" ? "" : path.endsWith("/") ? path : `${path}/`;
      const newPrefix = destPath.endsWith("/") ? destPath : `${destPath}/`;

      const listed = await bucketInfo.bucket.list({ prefix: oldPrefix });

      for (const obj of listed.objects) {
        const newKey = obj.key.replace(oldPrefix, newPrefix);
        const source = await bucketInfo.bucket.get(obj.key);
        if (source) {
          await bucketInfo.bucket.put(newKey, source.body, {
            httpMetadata: source.httpMetadata,
            customMetadata: source.customMetadata,
          });
        }
      }
    } else {
      // Copy file
      const source = await bucketInfo.bucket.get(path);
      if (!source) {
        return c.text("Source not found", 404);
      }

      await bucketInfo.bucket.put(destPath, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: source.customMetadata,
      });
    }

    return new Response(null, { status: 201 });
  } catch (error) {
    logger().error("COPY error", { path, destination, error: String(error) });
    return c.text(`Failed to copy: ${String(error)}`, 500);
  }
}

async function handleLock(c: Context, bucketInfo: BucketInfo, path: string) {
  const log = logger();

  // Windows usually sends LOCK after a 0-byte PUT placeholder.
  // We just say "sure, you have a lock" and return a token.

  log.debug("LOCK start", { path });

  // Read body just so the stream is consumed, but we don't actually parse it.
  try {
    const bodyText = await c.req.text();
    log.debug("LOCK body (truncated)", { snippet: bodyText.slice(0, 200) });
  } catch (err) {
    log.debug("LOCK error reading body", { path, error: String(err) });
  }

  // Generate a dummy lock token
  const token = `opaquelocktoken:${crypto.randomUUID?.() ?? Date.now()}`;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:timeout>Second-600</D:timeout>
      <D:locktoken>
        <D:href>${escapeXml(token)}</D:href>
      </D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;

  const headers = new Headers();
  headers.set("Content-Type", "application/xml; charset=utf-8");
  headers.set("Lock-Token", `<${token}>`);

  log.info("LOCK granted", { path, token });

  // 200 is fine whether or not the resource exists yet
  return new Response(xml, { status: 200, headers });
}

async function handleUnlock(c: Context, bucketInfo: BucketInfo, path: string) {
  const log = logger();
  const tokenHeader = c.req.header("Lock-Token");
  log.debug("UNLOCK start", { path, tokenHeader });

  // We don't actually track locks; just pretend unlock always succeeds.
  return new Response(null, { status: 204 });
}

async function handleProppatch(
  c: Context,
  bucketInfo: BucketInfo,
  path: string
) {
  const log = logger();
  log.debug("PROPPATCH start", { path });

  let body = "";
  try {
    body = await c.req.text();
  } catch (err) {
    log.debug("PROPPATCH error reading body", { path, error: String(err) });
  }
  log.debug("PROPPATCH body (truncated)", { snippet: body.slice(0, 200) });

  // Build href just like PROPFIND
  let fullPath = path === "/" ? "" : path;
  fullPath = fullPath.replace(/^\/+/, "");

  let href = `/webdav/${bucketInfo.binding}`;
  if (fullPath) {
    href += "/" + fullPath;
  } else {
    href += "/";
  }

  // Minimal "everything succeeded" multistatus response.
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${escapeXml(href)}</D:href>
    <D:propstat>
      <D:prop>
        <!-- We don't actually store any props, but claim success -->
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

  const headers = new Headers();
  headers.set("Content-Type", "application/xml; charset=utf-8");

  log.debug("PROPPATCH returning success", { path });

  return new Response(xml, { status: 207, headers });
}
