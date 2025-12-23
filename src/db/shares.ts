/**
 * Share database operations
 */

export interface Share {
  id: string;
  slug: string;
  r2_bucket: string;
  r2_prefix: string;
  owner_user_id: string;
  quota_bytes: number | null;
  created_at: number;
}

export interface ShareGrant {
  share_id: string;
  subject_type: "user" | "group" | "all";
  subject_id: string | null;
  permission: "read" | "write" | "read_write";
}

/**
 * Get share by slug
 */
export async function getShareBySlug(
  db: D1Database,
  slug: string
): Promise<Share | null> {
  const result = await db
    .prepare("SELECT * FROM shares WHERE slug = ?")
    .bind(slug)
    .first<Share>();

  return result || null;
}

/**
 * Get share by ID
 */
export async function getShareById(
  db: D1Database,
  shareId: string
): Promise<Share | null> {
  const result = await db
    .prepare("SELECT * FROM shares WHERE id = ?")
    .bind(shareId)
    .first<Share>();

  return result || null;
}

/**
 * Create a new share
 */
export async function createShare(
  db: D1Database,
  slug: string,
  r2Bucket: string,
  r2Prefix: string,
  ownerUserId: string,
  quotaBytes?: number | null
): Promise<Share> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();

  await db
    .prepare(
      "INSERT INTO shares (id, slug, r2_bucket, r2_prefix, owner_user_id, quota_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      slug,
      r2Bucket,
      r2Prefix,
      ownerUserId,
      quotaBytes ?? null,
      createdAt
    )
    .run();

  return {
    id,
    slug,
    r2_bucket: r2Bucket,
    r2_prefix: r2Prefix,
    owner_user_id: ownerUserId,
    quota_bytes: quotaBytes ?? null,
    created_at: createdAt,
  };
}

/**
 * Grant permission on a share
 */
export async function grantPermission(
  db: D1Database,
  shareId: string,
  subjectType: "user" | "group" | "all",
  subjectId: string | null,
  permission: "read" | "write" | "read_write"
): Promise<void> {
  await db
    .prepare(
      "INSERT OR REPLACE INTO share_grants (share_id, subject_type, subject_id, permission) VALUES (?, ?, ?, ?)"
    )
    .bind(shareId, subjectType, subjectId, permission)
    .run();
}

/**
 * Revoke permission on a share
 */
export async function revokePermission(
  db: D1Database,
  shareId: string,
  subjectType: "user" | "group" | "all",
  subjectId: string | null
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM share_grants WHERE share_id = ? AND subject_type = ? AND subject_id = ?"
    )
    .bind(shareId, subjectType, subjectId)
    .run();
}

/**
 * Get all grants for a share
 */
export async function getShareGrants(
  db: D1Database,
  shareId: string
): Promise<ShareGrant[]> {
  const results = await db
    .prepare("SELECT * FROM share_grants WHERE share_id = ?")
    .bind(shareId)
    .all<ShareGrant>();

  return results.results || [];
}
