import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Theme } from "../types";

const THEME_COOKIE_NAME = "theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Get the current theme from the cookie
 */
export function getTheme(c: Context): Theme {
  const themeCookie = getCookie(c, THEME_COOKIE_NAME);
  if (themeCookie === "light" || themeCookie === "dark") {
    return themeCookie;
  }
  return "system";
}

/**
 * Set the theme cookie
 */
export function setTheme(c: Context, theme: Theme): void {
  setCookie(c, THEME_COOKIE_NAME, theme, {
    path: "/",
    httpOnly: false, // Allow JS access if needed
    secure: true,
    sameSite: "Lax",
    maxAge: THEME_COOKIE_MAX_AGE,
  });
}

