import type { Context } from "hono";
import baseStyles from "../styles/base.css";
import darkColors from "../styles/dark.css";
import lightColors from "../styles/light.css";
import type { Theme } from "../types";

export async function stylesRoute(c: Context) {
  const url = new URL(c.req.url);
  const themeParam = url.searchParams.get("theme");
  const theme: Theme =
    themeParam === "light" || themeParam === "dark" ? themeParam : "system";

  let combinedStyles: string;

  if (theme === "light") {
    combinedStyles = `<style>
${baseStyles}
${lightColors}
</style>`;
  } else if (theme === "dark") {
    combinedStyles = `<style>
${baseStyles}
${darkColors}
</style>`;
  } else {
    // system - use media query
    combinedStyles = `<style>
${baseStyles}
${lightColors}
@media (prefers-color-scheme: dark) {
${darkColors}
}
</style>`;
  }

  return c.body(combinedStyles, 200, {
    "Content-Type": "text/css",
    "Cache-Control": "public, max-age=31536000",
  });
}
