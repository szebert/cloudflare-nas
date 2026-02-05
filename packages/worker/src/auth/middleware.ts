/**
 * Authentication middleware
 * Handles both session-based auth (browser) and Basic Auth (WebDAV/API)
 */

import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { getUserById, verifyUserCredentials } from "../db/users";
import { logger } from "../utils/logger";
import { validateSession } from "./session";

export interface AuthenticatedUser {
  id: string;
  username: string;
  is_admin: boolean;
  must_change_password: boolean;
}

const SESSION_COOKIE_NAME = "session_token";

/**
 * Extract Basic Auth credentials from request
 */
function extractBasicAuth(
  c: Context,
): { username: string; password: string } | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return null;
  }

  try {
    const base64 = authHeader.substring(6);
    const decoded = atob(base64);
    const [username, password] = decoded.split(":", 2);
    return { username, password };
  } catch {
    return null;
  }
}

/**
 * Authentication middleware
 * Checks session cookie for browser requests, Basic Auth for WebDAV/API
 */
export async function authMiddleware(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: any[]; user?: AuthenticatedUser };
  }>,
  next: Next,
) {
  const log = logger();
  const db = (c.env as any).DB as D1Database;

  if (!db) {
    log.error("D1 database not configured");
    return c.text("Database not configured", 500);
  }

  // Check for session cookie first (browser requests)
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const userId = await validateSession(db, sessionToken);
    if (userId) {
      const user = await getUserById(db, userId);
      if (user) {
        const authenticatedUser: AuthenticatedUser = {
          id: user.id,
          username: user.username,
          is_admin: user.is_admin === 1,
          must_change_password: user.must_change_password === 1,
        };
        c.set("user", authenticatedUser);

        // Check if user must change password (for browser requests only)
        if (user.must_change_password === 1) {
          const currentPath = new URL(c.req.url).pathname;
          // Allow access to password change endpoint and logout
          if (
            !currentPath.startsWith("/change-password") &&
            !currentPath.startsWith("/logout") &&
            !currentPath.startsWith("/styles")
          ) {
            return c.redirect("/change-password");
          }
        }

        await next();
        return;
      }
    }
  }

  // Fall back to Basic Auth (for WebDAV and API clients)
  const basicAuth = extractBasicAuth(c);
  if (basicAuth) {
    const user = await verifyUserCredentials(
      db,
      basicAuth.username,
      basicAuth.password,
    );
    if (user) {
      c.set("user", {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin === 1,
        must_change_password: user.must_change_password === 1,
      });
      // For API/WebDAV, we don't redirect - let the client handle it
      await next();
      return;
    }
  }

  // No valid authentication found
  // For browser requests, redirect to login
  // For API/WebDAV, return 401
  const acceptHeader = c.req.header("Accept") || "";
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  // WebDAV methods that indicate a WebDAV client
  const webdavMethods = [
    "PROPFIND",
    "PROPPATCH",
    "MKCOL",
    "COPY",
    "MOVE",
    "LOCK",
    "UNLOCK",
    "OPTIONS",
  ];
  const isWebDavMethod = webdavMethods.includes(method);
  const isWebDavPath = path.startsWith("/webdav/");

  // It's a WebDAV/API request if:
  // - Uses a WebDAV-specific method, OR
  // - Targets the /webdav/ path, OR
  // - Sends Accept: application/json, OR
  // - Has a Depth header (WebDAV), OR
  // - User-Agent contains "Microsoft-WebDAV" or similar
  const userAgent = c.req.header("User-Agent") || "";
  const hasDepthHeader = !!c.req.header("Depth");
  const isWebDavClient =
    userAgent.includes("Microsoft-WebDAV") ||
    userAgent.includes("WebDAVFS") ||
    userAgent.includes("davfs") ||
    userAgent.includes("Cyberduck");

  const isApiOrWebDavRequest =
    isWebDavMethod ||
    isWebDavPath ||
    acceptHeader.includes("application/json") ||
    hasDepthHeader ||
    isWebDavClient;

  log.debug("Auth check - no valid auth found", {
    method,
    path,
    isWebDavMethod,
    isWebDavPath,
    hasDepthHeader,
    isWebDavClient,
    isApiOrWebDavRequest,
    acceptHeader: acceptHeader.substring(0, 50),
    userAgent: userAgent.substring(0, 50),
  });

  if (!isApiOrWebDavRequest && acceptHeader.includes("text/html")) {
    // Browser request - redirect to login
    const url = new URL(c.req.url);
    const currentPath = url.pathname + url.search;
    return c.redirect(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }

  // API/WebDAV request - return 401 with WWW-Authenticate header
  return c.text("Unauthorized", 401, {
    "WWW-Authenticate": 'Basic realm="Cloudflare NAS"',
  });
}

/**
 * Optional auth middleware - doesn't require auth but sets user if available
 */
export async function optionalAuthMiddleware(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: any[]; user?: AuthenticatedUser };
  }>,
  next: Next,
) {
  const db = (c.env as any).DB as D1Database;

  if (!db) {
    await next();
    return;
  }

  // Check for session cookie
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const userId = await validateSession(db, sessionToken);
    if (userId) {
      const user = await getUserById(db, userId);
      if (user) {
        c.set("user", {
          id: user.id,
          username: user.username,
          is_admin: user.is_admin === 1,
          must_change_password: user.must_change_password === 1,
        });
      }
    }
  }

  // Try Basic Auth
  const basicAuth = extractBasicAuth(c);
  if (basicAuth) {
    const user = await verifyUserCredentials(
      db,
      basicAuth.username,
      basicAuth.password,
    );
    if (user) {
      c.set("user", {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin === 1,
        must_change_password: user.must_change_password === 1,
      });
    }
  }

  await next();
}
