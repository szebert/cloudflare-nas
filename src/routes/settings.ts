import type { Context } from "hono";
import type { BucketInfo, Theme } from "../types";
import { renderSettingsPage } from "../ui/settings-page";
import { getBucketByBinding } from "../utils/buckets";
import { getTheme, setTheme } from "../utils/theme";

export async function settingsRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const buckets = c.get("buckets");
  const bucketBinding = c.req.param("bucket");

  // Get the bucket info
  const currentBucket = getBucketByBinding(buckets, bucketBinding);
  if (!currentBucket) {
    return c.text(`Bucket "${bucketBinding}" not found`, 404);
  }

  const theme = getTheme(c);

  const htmlContent = renderSettingsPage({
    currentBucket,
    theme,
  });

  return c.html(htmlContent);
}

/**
 * POST /b/:bucket/settings/theme - Set theme preference
 */
export async function setThemeRoute(
  c: Context<{ Bindings: Env; Variables: { buckets: BucketInfo[] } }>
) {
  const formData = await c.req.formData();
  const themeValue = formData.get("theme") as string;
  const redirectUrl = formData.get("redirect") as string;

  // Validate theme
  const theme: Theme =
    themeValue === "light" || themeValue === "dark" ? themeValue : "system";

  // Set the theme cookie
  setTheme(c, theme);

  // Redirect back to the referring page
  const redirect = redirectUrl || c.req.header("Referer") || "/";
  return c.redirect(redirect, 303);
}
