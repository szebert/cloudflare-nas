/**
 * Share links database operations
 */

import { hashPassword, verifyPassword } from "../auth/password";

export interface ShareLink {
  id: string;
  token: string;
  created_by: string;
  r2_bucket: string;
  r2_path: string;
  is_directory: number; // SQLite stores as INTEGER (0 or 1)
  password_hash: string | null;
  salt: string | null;
  expires_at: number | null;
  max_downloads: number | null;
  download_count: number;
  created_at: number;
}

export interface CreateShareLinkOptions {
  createdBy: string;
  r2Bucket: string;
  r2Path: string;
  isDirectory: boolean;
  password?: string;
  expiresAt?: number;
  maxDownloads?: number;
}

/**
 * Base62 characters for URL-safe short codes
 */
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generate a short random token for share links (5-7 characters)
 * Uses base62 encoding for URL-safe characters
 */
function generateShortToken(): string {
  // Generate 5-7 character codes (randomly choose length for variety)
  const length = 5 + Math.floor(Math.random() * 3); // 5, 6, or 7
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let token = "";
  for (let i = 0; i < length; i++) {
    token += BASE62[array[i] % BASE62.length];
  }

  return token;
}

/**
 * Generate a unique token for share links
 * Retries if token already exists (unlikely but possible)
 */
async function generateUniqueToken(db: D1Database): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const token = generateShortToken();
    const existing = await getShareLinkByToken(db, token);
    if (!existing) {
      return token;
    }
    attempts++;
  }

  // Fallback: if we somehow can't find a unique short token, use a longer one
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => BASE62[byte % BASE62.length]).join("");
}

/**
 * Create a new share link
 */
export async function createShareLink(
  db: D1Database,
  options: CreateShareLinkOptions
): Promise<ShareLink> {
  const id = crypto.randomUUID();
  const token = await generateUniqueToken(db);
  const createdAt = Date.now();

  let passwordHash: string | null = null;
  let salt: string | null = null;

  if (options.password) {
    const result = await hashPassword(options.password);
    passwordHash = result.hash;
    salt = result.salt;
  }

  await db
    .prepare(
      `INSERT INTO share_links 
       (id, token, created_by, r2_bucket, r2_path, is_directory, password_hash, salt, expires_at, max_downloads, download_count, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .bind(
      id,
      token,
      options.createdBy,
      options.r2Bucket,
      options.r2Path,
      options.isDirectory ? 1 : 0,
      passwordHash,
      salt,
      options.expiresAt ?? null,
      options.maxDownloads ?? null,
      createdAt
    )
    .run();

  return {
    id,
    token,
    created_by: options.createdBy,
    r2_bucket: options.r2Bucket,
    r2_path: options.r2Path,
    is_directory: options.isDirectory ? 1 : 0,
    password_hash: passwordHash,
    salt,
    expires_at: options.expiresAt ?? null,
    max_downloads: options.maxDownloads ?? null,
    download_count: 0,
    created_at: createdAt,
  };
}

/**
 * Get share link by token
 */
export async function getShareLinkByToken(
  db: D1Database,
  token: string
): Promise<ShareLink | null> {
  const result = await db
    .prepare("SELECT * FROM share_links WHERE token = ?")
    .bind(token)
    .first<ShareLink>();

  return result || null;
}

/**
 * Get share link by ID
 */
export async function getShareLinkById(
  db: D1Database,
  id: string
): Promise<ShareLink | null> {
  const result = await db
    .prepare("SELECT * FROM share_links WHERE id = ?")
    .bind(id)
    .first<ShareLink>();

  return result || null;
}

/**
 * Get all share links for a user
 */
export async function getShareLinksByUser(
  db: D1Database,
  userId: string
): Promise<ShareLink[]> {
  const results = await db
    .prepare("SELECT * FROM share_links WHERE created_by = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<ShareLink>();

  return results.results || [];
}

/**
 * Get all share links (admin only)
 */
export async function getAllShareLinks(db: D1Database): Promise<ShareLink[]> {
  const results = await db
    .prepare("SELECT * FROM share_links ORDER BY created_at DESC")
    .all<ShareLink>();

  return results.results || [];
}

/**
 * Delete a share link
 */
export async function deleteShareLink(
  db: D1Database,
  id: string
): Promise<void> {
  await db.prepare("DELETE FROM share_links WHERE id = ?").bind(id).run();
}

/**
 * Increment download count for a share link
 */
export async function incrementDownloadCount(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare("UPDATE share_links SET download_count = download_count + 1 WHERE id = ?")
    .bind(id)
    .run();
}

/**
 * Verify share link password
 */
export async function verifyShareLinkPassword(
  shareLink: ShareLink,
  password: string
): Promise<boolean> {
  if (!shareLink.password_hash || !shareLink.salt) {
    return true; // No password required
  }
  return verifyPassword(password, shareLink.password_hash, shareLink.salt);
}

/**
 * Check if share link is valid (not expired, not exceeded max downloads)
 */
export function isShareLinkValid(shareLink: ShareLink): {
  valid: boolean;
  reason?: string;
} {
  const now = Date.now();

  if (shareLink.expires_at && shareLink.expires_at < now) {
    return { valid: false, reason: "Link has expired" };
  }

  if (
    shareLink.max_downloads !== null &&
    shareLink.download_count >= shareLink.max_downloads
  ) {
    return { valid: false, reason: "Download limit reached" };
  }

  return { valid: true };
}

/**
 * Check if a token is available (not already in use)
 */
export async function isTokenAvailable(
  db: D1Database,
  token: string,
  excludeId?: string
): Promise<boolean> {
  let query = "SELECT COUNT(*) as count FROM share_links WHERE token = ?";
  const params: any[] = [token];

  if (excludeId) {
    query += " AND id != ?";
    params.push(excludeId);
  }

  const result = await db
    .prepare(query)
    .bind(...params)
    .first<{ count: number }>();

  return (result?.count ?? 0) === 0;
}

/**
 * Get share links by path (r2_bucket and r2_path)
 */
export async function getShareLinksByPath(
  db: D1Database,
  r2Bucket: string,
  r2Path: string
): Promise<ShareLink[]> {
  const results = await db
    .prepare("SELECT * FROM share_links WHERE r2_bucket = ? AND r2_path = ? ORDER BY created_at DESC")
    .bind(r2Bucket, r2Path)
    .all<ShareLink>();

  return results.results || [];
}

/**
 * Update share link token
 */
export async function updateShareLinkToken(
  db: D1Database,
  id: string,
  newToken: string
): Promise<void> {
  // Validate token format (URL-safe: alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(newToken)) {
    throw new Error("Token must contain only alphanumeric characters, hyphens, and underscores");
  }

  if (newToken.length < 3 || newToken.length > 20) {
    throw new Error("Token must be between 3 and 20 characters");
  }

  // Check if token is available (excluding current link)
  const available = await isTokenAvailable(db, newToken, id);
  if (!available) {
    throw new Error("Token is already in use");
  }

  await db
    .prepare("UPDATE share_links SET token = ? WHERE id = ?")
    .bind(newToken, id)
    .run();
}

export interface UpdateShareLinkOptions {
  token?: string;
  password?: string | null; // null means remove password, undefined means don't change
  expiresAt?: number | null; // null means remove expiration, undefined means don't change
  maxDownloads?: number | null; // null means remove limit, undefined means don't change
}

/**
 * Update share link properties
 */
export async function updateShareLink(
  db: D1Database,
  id: string,
  options: UpdateShareLinkOptions
): Promise<void> {
  const updates: string[] = [];
  const values: any[] = [];

  // Update token if provided
  if (options.token !== undefined) {
    // Validate token format (URL-safe: alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(options.token)) {
      throw new Error("Token must contain only alphanumeric characters, hyphens, and underscores");
    }

    if (options.token.length < 3 || options.token.length > 20) {
      throw new Error("Token must be between 3 and 20 characters");
    }

    // Check if token is available (excluding current link)
    const available = await isTokenAvailable(db, options.token, id);
    if (!available) {
      throw new Error("Token is already in use");
    }

    updates.push("token = ?");
    values.push(options.token);
  }

  // Update password if provided
  if (options.password !== undefined) {
    if (options.password === null || options.password === "") {
      // Remove password
      updates.push("password_hash = NULL");
      updates.push("salt = NULL");
    } else {
      // Set new password
      const result = await hashPassword(options.password);
      updates.push("password_hash = ?");
      updates.push("salt = ?");
      values.push(result.hash, result.salt);
    }
  }

  // Update expiration if provided
  if (options.expiresAt !== undefined) {
    updates.push("expires_at = ?");
    values.push(options.expiresAt);
  }

  // Update max downloads if provided
  if (options.maxDownloads !== undefined) {
    updates.push("max_downloads = ?");
    values.push(options.maxDownloads);
  }

  if (updates.length === 0) {
    return; // Nothing to update
  }

  values.push(id);

  await db
    .prepare(`UPDATE share_links SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

