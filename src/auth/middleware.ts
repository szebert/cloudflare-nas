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
}

const SESSION_COOKIE_NAME = "session_token";

/**
 * Extract Basic Auth credentials from request
 */
function extractBasicAuth(
  c: Context
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
  next: Next
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
        c.set("user", {
          id: user.id,
          username: user.username,
          is_admin: user.is_admin === 1,
        });
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
      basicAuth.password
    );
    if (user) {
      c.set("user", {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin === 1,
      });
      await next();
      return;
    }
  }

  // No valid authentication found
  // For browser requests, redirect to login
  // For API/WebDAV, return 401
  const acceptHeader = c.req.header("Accept") || "";
  const isBrowserRequest =
    acceptHeader.includes("text/html") ||
    !acceptHeader.includes("application/json");

  if (isBrowserRequest) {
    // Extract only the pathname (not the full URL) to ensure redirects stay in the same environment
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
  next: Next
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
      basicAuth.password
    );
    if (user) {
      c.set("user", {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin === 1,
      });
    }
  }

  await next();
}
