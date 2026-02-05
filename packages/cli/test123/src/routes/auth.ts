/**
 * Authentication routes (login/logout)
 */

import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { clearSession, createSession, validateSession } from "../auth/session";
import { createUser, getUserById, hasAnyUsers, verifyUserCredentials } from "../db/users";
import { renderLoginPage } from "../ui/login-page";
import { logger } from "../utils/logger";
import { getTheme } from "../utils/theme";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Validate and return a safe redirect URL
 * Only allows relative paths (starting with /) to prevent open redirects
 * and ensure redirects stay in the same environment (local vs production)
 */
function getSafeRedirectUrl(
  redirectUrl: string | undefined,
  log: ReturnType<typeof logger>
): string {
  if (!redirectUrl) {
    return "/";
  }

  // Only allow relative paths (starting with /) - reject absolute URLs
  if (redirectUrl.startsWith("/")) {
    return redirectUrl;
  }

  log.warn("Invalid redirect URL rejected", { redirectUrl });
  return "/";
}

/**
 * GET /login - Show login page
 * Shows setup form if no users exist, otherwise shows login form
 * Redirects to intended destination if already authenticated
 */
export async function loginPageRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: any[] } }>
) {
  const log = logger();
  const db = (c.env as any).DB as D1Database;
  const redirectUrl = c.req.query("redirect");
  const theme = getTheme(c);

  if (!db) {
    log.error("D1 database not configured");
    return c.text("Database not configured", 500);
  }

  // Check if any users exist - if not, show setup page
  const usersExist = await hasAnyUsers(db);
  if (!usersExist) {
    const html = renderLoginPage({ redirectUrl, theme, isSetup: true });
    return c.html(html);
  }

  // Check if user is already authenticated
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const userId = await validateSession(db, sessionToken);
    if (userId) {
      const user = await getUserById(db, userId);
      if (user) {
        // User is already authenticated, redirect to intended destination
        const redirect = getSafeRedirectUrl(redirectUrl, log);
        return c.redirect(redirect, 303);
      }
    }
  }

  // Not authenticated, show login page
  const html = renderLoginPage({ redirectUrl, theme });
  return c.html(html);
}

/**
 * POST /login - Handle login form submission
 */
export async function loginHandlerRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: any[] } }>
) {
  const log = logger();
  const db = (c.env as any).DB as D1Database;

  if (!db) {
    log.error("D1 database not configured");
    return c.text("Database not configured", 500);
  }

  const formData = await c.req.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const redirectUrl = c.req.query("redirect");
  const theme = getTheme(c);

  if (!username || !password) {
    const html = renderLoginPage({
      redirectUrl,
      error: "Username and password are required",
      theme,
    });
    return c.html(html);
  }

  // Verify credentials
  const user = await verifyUserCredentials(db, username, password);
  if (!user) {
    log.warn("Login failed", { username });
    const html = renderLoginPage({
      redirectUrl,
      error: "Invalid username or password",
      theme,
    });
    return c.html(html);
  }

  // Create session
  const sessionToken = await createSession(db, user.id);
  log.info("Login successful", { username, userId: user.id });

  // Set session cookie
  const redirect = getSafeRedirectUrl(redirectUrl, log);

  setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
  return c.redirect(redirect, 303);
}

/**
 * POST /setup - Handle first admin account creation
 * Only works when no users exist in the database
 */
export async function setupRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: any[] } }>
) {
  const log = logger();
  const db = (c.env as any).DB as D1Database;
  const theme = getTheme(c);

  if (!db) {
    log.error("D1 database not configured");
    return c.text("Database not configured", 500);
  }

  // Security check: only allow setup if no users exist
  const usersExist = await hasAnyUsers(db);
  if (usersExist) {
    log.warn("Setup attempted but users already exist");
    return c.redirect("/login", 303);
  }

  const formData = await c.req.formData();
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!username || !password || !confirmPassword) {
    const html = renderLoginPage({
      error: "All fields are required",
      theme,
      isSetup: true,
    });
    return c.html(html);
  }

  if (username.length < 3) {
    const html = renderLoginPage({
      error: "Username must be at least 3 characters",
      theme,
      isSetup: true,
    });
    return c.html(html);
  }

  if (password.length < 8) {
    const html = renderLoginPage({
      error: "Password must be at least 8 characters",
      theme,
      isSetup: true,
    });
    return c.html(html);
  }

  if (password !== confirmPassword) {
    const html = renderLoginPage({
      error: "Passwords do not match",
      theme,
      isSetup: true,
    });
    return c.html(html);
  }

  try {
    // Create admin user (no must_change_password for the initial admin)
    const user = await createUser(db, username, password, true, false);
    log.info("Initial admin user created", { username, userId: user.id });

    // Create session and log them in
    const sessionToken = await createSession(db, user.id);

    setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });

    return c.redirect("/", 303);
  } catch (error: any) {
    log.error("Failed to create admin user", { error: error.message });
    const html = renderLoginPage({
      error: "Failed to create admin account. Please try again.",
      theme,
      isSetup: true,
    });
    return c.html(html);
  }
}

/**
 * POST /logout - Handle logout
 */
export async function logoutRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: any[]; user?: any } }>
) {
  const log = logger();
  const db = (c.env as any).DB as D1Database;
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);

  if (db && sessionToken) {
    await clearSession(db, sessionToken);
    log.info("Logout successful");
  }

  // Clear session cookie and redirect
  setCookie(c, SESSION_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 0,
  });
  return c.redirect("/login", 303);
}
