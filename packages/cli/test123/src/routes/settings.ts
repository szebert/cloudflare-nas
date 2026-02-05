import type { Context } from "hono";
import type { AuthenticatedUser } from "../auth/middleware";
import {
  deleteShareLink,
  getAllShareLinks,
  getShareLinkById,
  getShareLinksByUser,
  updateShareLink
} from "../db/share-links";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  setUserPassword,
  toggleUserAdmin,
} from "../db/users";
import type { BucketInfo, Theme } from "../types";
import { renderChangePasswordPage } from "../ui/change-password-page";
import { renderShareLinkDetailsPage } from "../ui/details-share-link-page";
import { renderSettingsPage } from "../ui/settings-page";
import { renderShareLinksPage } from "../ui/settings-share-links-page";
import { renderUserDetailsPage } from "../ui/settings-user-details-page";
import { renderUsersPage } from "../ui/settings-users-page";
import { getCurrentBucket } from "../utils/buckets";
import { getTheme, setTheme } from "../utils/theme";
import { getOrigin } from "../utils/url";

/**
 * GET /settings - Main settings page
 */
export async function settingsRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const buckets = c.get("buckets");
  const user = c.get("user");

  if (!user) {
    return c.redirect("/login");
  }

  // Get the bucket info from cookie
  const currentBucket = getCurrentBucket(c, buckets);
  if (!currentBucket) {
    return c.text("No buckets configured", 404);
  }

  const theme = getTheme(c);
  const url = new URL(c.req.url);
  const successMessage = url.searchParams.get("success");
  const errorMessage = url.searchParams.get("error");

  const htmlContent = renderSettingsPage({
    currentBucket,
    theme,
    user,
    successMessage: successMessage || undefined,
    errorMessage: errorMessage || undefined,
  });

  return c.html(htmlContent);
}

/**
 * GET /settings/users - User management page (admin only)
 */
export async function usersPageRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const buckets = c.get("buckets");
  const user = c.get("user");

  if (!user || !user.is_admin) {
    return c.text("Forbidden", 403);
  }

  const currentBucket = getCurrentBucket(c, buckets);
  if (!currentBucket) {
    return c.text("No buckets configured", 404);
  }

  const db = (c.env as any).DB as D1Database;
  const theme = getTheme(c);
  const users = await getAllUsers(db);

  const url = new URL(c.req.url);
  const successMessage = url.searchParams.get("success");
  const errorMessage = url.searchParams.get("error");

  return c.html(
    renderUsersPage({
      currentBucket,
      theme,
      currentUser: user,
      users,
      successMessage: successMessage || undefined,
      errorMessage: errorMessage || undefined,
    })
  );
}

/**
 * GET /settings/users/:id - User details page (admin only)
 */
export async function userDetailsPageRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const buckets = c.get("buckets");
  const userId = c.req.param("id");
  const user = c.get("user");

  if (!user || !user.is_admin) {
    return c.text("Forbidden", 403);
  }

  const currentBucket = getCurrentBucket(c, buckets);
  if (!currentBucket) {
    return c.text("No buckets configured", 404);
  }

  const db = (c.env as any).DB as D1Database;
  const theme = getTheme(c);
  const targetUser = await getUserById(db, userId);

  if (!targetUser) {
    return c.redirect(`/settings/users?error=${encodeURIComponent("User not found")}`);
  }

  // Prevent viewing self on this page
  if (targetUser.id === user.id) {
    return c.redirect(`/settings/users`);
  }

  const url = new URL(c.req.url);
  const successMessage = url.searchParams.get("success");
  const errorMessage = url.searchParams.get("error");

  return c.html(
    renderUserDetailsPage({
      currentBucket,
      theme,
      currentUser: user,
      targetUser,
      successMessage: successMessage || undefined,
      errorMessage: errorMessage || undefined,
    })
  );
}

/**
 * GET /settings/links - Share links page
 */
export async function shareLinksPageRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const buckets = c.get("buckets");
  const user = c.get("user");

  if (!user) {
    return c.redirect("/login");
  }

  const currentBucket = getCurrentBucket(c, buckets);
  if (!currentBucket) {
    return c.text("No buckets configured", 404);
  }

  const db = (c.env as any).DB as D1Database;
  const theme = getTheme(c);

  // Get share links (admin sees all, regular users see their own)
  const shareLinks = user.is_admin
    ? await getAllShareLinks(db)
    : await getShareLinksByUser(db, user.id);

  // Check for success/error messages in query params
  const url = new URL(c.req.url);
  const successMessage = url.searchParams.get("success");
  const errorMessage = url.searchParams.get("error");

  return c.html(
    renderShareLinksPage({
      currentBucket,
      theme,
      user,
      shareLinks,
      successMessage: successMessage || undefined,
      errorMessage: errorMessage || undefined,
    })
  );
}

/**
 * POST /settings/theme - Set theme preference
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

/**
 * POST /settings/users - Create a new user (admin only)
 */
export async function createUserRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");

  if (!user || !user.is_admin) {
    return c.text("Forbidden", 403);
  }

  const db = (c.env as any).DB as D1Database;
  const formData = await c.req.formData();

  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;
  const isAdmin = formData.get("isAdmin") === "true";

  if (!username || !password) {
    return c.redirect(
      `/settings/users?error=${encodeURIComponent("Username and password are required")}`
    );
  }

  if (password.length < 8) {
    return c.redirect(
      `/settings/users?error=${encodeURIComponent("Password must be at least 8 characters")}`
    );
  }

  try {
    await createUser(db, username, password, isAdmin, true);
    return c.redirect(
      `/settings/users?success=${encodeURIComponent(`User "${username}" created successfully`)}`
    );
  } catch (error: any) {
    const message = error.message?.includes("UNIQUE")
      ? "Username already exists"
      : "Failed to create user";
    return c.redirect(
      `/settings/users?error=${encodeURIComponent(message)}`
    );
  }
}

/**
 * POST /settings/users/:id/delete - Delete a user (admin only)
 */
export async function deleteUserRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  const userId = c.req.param("id");

  if (!user || !user.is_admin) {
    return c.text("Forbidden", 403);
  }

  // Prevent self-deletion
  if (userId === user.id) {
    return c.redirect(
      `/settings/users?error=${encodeURIComponent("Cannot delete your own account")}`
    );
  }

  const db = (c.env as any).DB as D1Database;

  try {
    await deleteUser(db, userId);
    return c.redirect(
      `/settings/users?success=${encodeURIComponent("User deleted successfully")}`
    );
  } catch (error) {
    return c.redirect(
      `/settings/users?error=${encodeURIComponent("Failed to delete user")}`
    );
  }
}

/**
 * POST /settings/users/:id/toggle-admin - Toggle admin status (admin only)
 */
export async function toggleUserAdminRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  const userId = c.req.param("id");

  if (!user || !user.is_admin) {
    return c.text("Forbidden", 403);
  }

  // Prevent self-demotion
  if (userId === user.id) {
    return c.redirect(
      `/settings/users/${userId}?error=${encodeURIComponent("Cannot change your own admin status")}`
    );
  }

  const db = (c.env as any).DB as D1Database;

  try {
    await toggleUserAdmin(db, userId);
    return c.redirect(
      `/settings/users/${userId}?success=${encodeURIComponent("Admin status updated")}`
    );
  } catch (error) {
    return c.redirect(
      `/settings/users/${userId}?error=${encodeURIComponent("Failed to update user")}`
    );
  }
}

/**
 * POST /settings/users/:id/reset-password - Reset user password (admin only, non-admin users)
 */
export async function resetUserPasswordRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  const userId = c.req.param("id");

  if (!user || !user.is_admin) {
    return c.text("Forbidden", 403);
  }

  const db = (c.env as any).DB as D1Database;
  const targetUser = await getUserById(db, userId);

  if (!targetUser) {
    return c.redirect(
      `/settings/users?error=${encodeURIComponent("User not found")}`
    );
  }

  // Only allow reset for non-admin users
  if (targetUser.is_admin === 1) {
    return c.redirect(
      `/settings/users/${userId}?error=${encodeURIComponent("Cannot reset password for admin users")}`
    );
  }

  const formData = await c.req.formData();
  const newPassword = formData.get("newPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    return c.redirect(
      `/settings/users/${userId}?error=${encodeURIComponent("Password must be at least 8 characters")}`
    );
  }

  try {
    // Set password with must_change_password = true
    await setUserPassword(db, userId, newPassword, true);
    return c.redirect(
      `/settings/users/${userId}?success=${encodeURIComponent("Password reset successfully. User will be required to change it on next login.")}`
    );
  } catch (error) {
    return c.redirect(
      `/settings/users/${userId}?error=${encodeURIComponent("Failed to reset password")}`
    );
  }
}

/**
 * POST /settings/password - Change own password
 */
export async function changePasswordRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");

  if (!user) {
    return c.redirect("/login");
  }

  const db = (c.env as any).DB as D1Database;
  const formData = await c.req.formData();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return c.redirect(
      `/settings?error=${encodeURIComponent("All password fields are required")}`
    );
  }

  if (newPassword !== confirmPassword) {
    return c.redirect(
      `/settings?error=${encodeURIComponent("New passwords do not match")}`
    );
  }

  if (newPassword.length < 8) {
    return c.redirect(
      `/settings?error=${encodeURIComponent("New password must be at least 8 characters")}`
    );
  }

  const result = await changeUserPassword(db, user.id, currentPassword, newPassword);

  if (!result.success) {
    return c.redirect(
      `/settings?error=${encodeURIComponent(result.error || "Failed to change password")}`
    );
  }

  return c.redirect(
    `/settings?success=${encodeURIComponent("Password changed successfully")}`
  );
}

/**
 * GET /settings/links/:id - Show share link details page
 */
export async function shareLinkDetailsPageRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const buckets = c.get("buckets");
  const user = c.get("user");
  const linkId = c.req.param("id");

  if (!user) {
    return c.redirect("/login");
  }

  const currentBucket = getCurrentBucket(c, buckets);
  if (!currentBucket) {
    return c.text("No buckets configured", 404);
  }

  const db = (c.env as any).DB as D1Database;
  const theme = getTheme(c);

  const shareLink = await getShareLinkById(db, linkId);
  if (!shareLink) {
    return c.redirect(
      `/settings/links?error=${encodeURIComponent("Share link not found")}`
    );
  }

  // Only allow viewing by the creator or an admin
  if (shareLink.created_by !== user.id && !user.is_admin) {
    return c.redirect(
      `/settings/links?error=${encodeURIComponent("You can only view your own share links")}`
    );
  }

  // Build the share URL using the correct origin for the current environment
  const origin = getOrigin(c.req);
  const shareUrl = `${origin}/s/${shareLink.token}`;

  const urlParams = new URL(c.req.url);
  const successMessage = urlParams.searchParams.get("success");
  const errorMessage = urlParams.searchParams.get("error");

  return c.html(
    renderShareLinkDetailsPage({
      currentBucket,
      theme,
      user,
      shareLink,
      shareUrl,
      successMessage: successMessage || undefined,
      errorMessage: errorMessage || undefined,
    })
  );
}

/**
 * POST /settings/links/:id/update - Update share link properties
 */
export async function updateShareLinkRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  const linkId = c.req.param("id");

  if (!user) {
    return c.redirect("/login");
  }

  const db = (c.env as any).DB as D1Database;

  const shareLink = await getShareLinkById(db, linkId);
  if (!shareLink) {
    return c.redirect(
      `/settings/links?error=${encodeURIComponent("Share link not found")}`
    );
  }

  // Only allow editing by the creator or an admin
  if (shareLink.created_by !== user.id && !user.is_admin) {
    return c.redirect(
      `/settings/links/${linkId}?error=${encodeURIComponent("You can only edit your own share links")}`
    );
  }

  const formData = await c.req.formData();

  const updateOptions: {
    token?: string;
    password?: string | null;
    expiresAt?: number | null;
    maxDownloads?: number | null;
  } = {};

  // Update token if provided
  const token = (formData.get("token") as string)?.trim();
  if (token) {
    updateOptions.token = token;
  }

  // Update password if provided
  const password = formData.get("password") as string | null;
  if (password !== null) {
    // Empty string means remove password, otherwise set new password
    updateOptions.password = password === "" ? null : password;
  }

  // Update expiration if provided
  const expiresAtStr = formData.get("expiresAt") as string | null;
  if (expiresAtStr !== null) {
    if (expiresAtStr === "") {
      updateOptions.expiresAt = null; // Remove expiration
    } else {
      const date = new Date(expiresAtStr);
      if (!isNaN(date.getTime())) {
        updateOptions.expiresAt = date.getTime();
      }
    }
  }

  // Update max downloads if provided
  const maxDownloadsStr = formData.get("maxDownloads") as string | null;
  if (maxDownloadsStr !== null) {
    if (maxDownloadsStr === "") {
      updateOptions.maxDownloads = null; // Remove limit
    } else {
      const parsed = parseInt(maxDownloadsStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        updateOptions.maxDownloads = parsed;
      }
    }
  }

  try {
    await updateShareLink(db, linkId, updateOptions);
    return c.redirect(
      `/settings/links/${linkId}?success=${encodeURIComponent("Share link updated successfully")}`
    );
  } catch (error: any) {
    return c.redirect(
      `/settings/links/${linkId}?error=${encodeURIComponent(error.message || "Failed to update share link")}`
    );
  }
}

/**
 * POST /settings/links/:id/delete - Delete a share link
 */
export async function deleteShareLinkSettingsRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  const linkId = c.req.param("id");

  if (!user) {
    return c.redirect("/login");
  }

  const db = (c.env as any).DB as D1Database;

  // Get the share link to check ownership
  const shareLink = await getShareLinkById(db, linkId);
  if (!shareLink) {
    return c.redirect(
      `/settings/links?error=${encodeURIComponent("Share link not found")}`
    );
  }

  // Only allow deletion by the creator or an admin
  if (shareLink.created_by !== user.id && !user.is_admin) {
    return c.redirect(
      `/settings/links?error=${encodeURIComponent("You can only delete your own share links")}`
    );
  }

  await deleteShareLink(db, linkId);

  return c.redirect(
    `/settings/links?success=${encodeURIComponent("Share link deleted")}`
  );
}

/**
 * GET /change-password - Show change password page (for forced password change)
 */
export async function showChangePasswordRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");
  const theme = getTheme(c);

  if (!user) {
    return c.redirect("/login");
  }

  const url = new URL(c.req.url);
  const error = url.searchParams.get("error");

  return c.html(
    renderChangePasswordPage({
      theme,
      username: user.username,
      isForced: user.must_change_password,
      error: error || undefined,
    })
  );
}

/**
 * POST /change-password - Process change password (for forced password change)
 */
export async function processChangePasswordRoute(
  c: Context<{
    Bindings: Env;
    Variables: { buckets: BucketInfo[]; user?: AuthenticatedUser };
  }>
) {
  const user = c.get("user");

  if (!user) {
    return c.redirect("/login");
  }

  const db = (c.env as any).DB as D1Database;
  const formData = await c.req.formData();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return c.redirect(
      `/change-password?error=${encodeURIComponent("All password fields are required")}`
    );
  }

  if (newPassword !== confirmPassword) {
    return c.redirect(
      `/change-password?error=${encodeURIComponent("New passwords do not match")}`
    );
  }

  if (newPassword.length < 8) {
    return c.redirect(
      `/change-password?error=${encodeURIComponent("New password must be at least 8 characters")}`
    );
  }

  const result = await changeUserPassword(db, user.id, currentPassword, newPassword);

  if (!result.success) {
    return c.redirect(
      `/change-password?error=${encodeURIComponent(result.error || "Failed to change password")}`
    );
  }

  // Redirect to home page after successful password change
  return c.redirect("/");
}
