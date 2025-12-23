/**
 * Permission checking utilities
 */

export type Permission = "read" | "write" | "read_write";

/**
 * Check if a user has the required permission on a share
 * @param db - D1 database instance
 * @param userId - User ID
 * @param shareId - Share ID
 * @param requiredPermission - Required permission level
 * @returns True if user has permission
 */
export async function checkPermission(
  db: D1Database,
  userId: string,
  shareId: string,
  requiredPermission: Permission
): Promise<boolean> {
  // First check if user is admin
  const user = await db
    .prepare("SELECT is_admin FROM users WHERE id = ?")
    .bind(userId)
    .first<{ is_admin: number }>();

  if (user && user.is_admin === 1) {
    return true; // Admins bypass all checks
  }

  // Check if user is the owner
  const share = await db
    .prepare("SELECT owner_user_id FROM shares WHERE id = ?")
    .bind(shareId)
    .first<{ owner_user_id: string }>();

  if (share && share.owner_user_id === userId) {
    return true; // Owners have all permissions
  }

  // Check direct user grants
  const userGrant = await db
    .prepare(
      "SELECT permission FROM share_grants WHERE share_id = ? AND subject_type = 'user' AND subject_id = ?"
    )
    .bind(shareId, userId)
    .first<{ permission: Permission }>();

  if (userGrant) {
    if (hasPermission(userGrant.permission, requiredPermission)) {
      return true;
    }
  }

  // Check group grants
  const userGroups = await db
    .prepare("SELECT group_id FROM user_groups WHERE user_id = ?")
    .bind(userId)
    .all<{ group_id: string }>();

  if (userGroups.results && userGroups.results.length > 0) {
    const groupIds = userGroups.results.map((g) => g.group_id);
    const placeholders = groupIds.map(() => "?").join(",");
    const groupGrant = await db
      .prepare(
        `SELECT permission FROM share_grants WHERE share_id = ? AND subject_type = 'group' AND subject_id IN (${placeholders})`
      )
      .bind(shareId, ...groupIds)
      .first<{ permission: Permission }>();

    if (groupGrant) {
      if (hasPermission(groupGrant.permission, requiredPermission)) {
        return true;
      }
    }
  }

  // Check "all" grants
  const allGrant = await db
    .prepare(
      "SELECT permission FROM share_grants WHERE share_id = ? AND subject_type = 'all' AND subject_id IS NULL"
    )
    .bind(shareId)
    .first<{ permission: Permission }>();

  if (allGrant) {
    if (hasPermission(allGrant.permission, requiredPermission)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a permission level satisfies a required permission
 */
function hasPermission(granted: Permission, required: Permission): boolean {
  if (granted === "read_write") {
    return true; // read_write satisfies all requirements
  }
  if (granted === "write") {
    return required === "write"; // write only satisfies write requirement
  }
  if (granted === "read") {
    return required === "read"; // read only satisfies read requirement
  }
  return false;
}

/**
 * Get all permissions a user has on a share
 * @param db - D1 database instance
 * @param userId - User ID
 * @param shareId - Share ID
 * @returns Array of permission strings
 */
export async function getUserPermissions(
  db: D1Database,
  userId: string,
  shareId: string
): Promise<Permission[]> {
  const permissions: Permission[] = [];

  // Check if user is admin
  const user = await db
    .prepare("SELECT is_admin FROM users WHERE id = ?")
    .bind(userId)
    .first<{ is_admin: number }>();

  if (user && user.is_admin === 1) {
    return ["read", "write", "read_write"]; // Admins have all permissions
  }

  // Check if user is the owner
  const share = await db
    .prepare("SELECT owner_user_id FROM shares WHERE id = ?")
    .bind(shareId)
    .first<{ owner_user_id: string }>();

  if (share && share.owner_user_id === userId) {
    return ["read", "write", "read_write"]; // Owners have all permissions
  }

  // Check direct user grants
  const userGrant = await db
    .prepare(
      "SELECT permission FROM share_grants WHERE share_id = ? AND subject_type = 'user' AND subject_id = ?"
    )
    .bind(shareId, userId)
    .first<{ permission: Permission }>();

  if (userGrant) {
    permissions.push(userGrant.permission);
  }

  // Check group grants
  const userGroups = await db
    .prepare("SELECT group_id FROM user_groups WHERE user_id = ?")
    .bind(userId)
    .all<{ group_id: string }>();

  if (userGroups.results && userGroups.results.length > 0) {
    const groupIds = userGroups.results.map((g) => g.group_id);
    const placeholders = groupIds.map(() => "?").join(",");
    const groupGrants = await db
      .prepare(
        `SELECT permission FROM share_grants WHERE share_id = ? AND subject_type = 'group' AND subject_id IN (${placeholders})`
      )
      .bind(shareId, ...groupIds)
      .all<{ permission: Permission }>();

    if (groupGrants.results) {
      for (const grant of groupGrants.results) {
        if (!permissions.includes(grant.permission)) {
          permissions.push(grant.permission);
        }
      }
    }
  }

  // Check "all" grants
  const allGrant = await db
    .prepare(
      "SELECT permission FROM share_grants WHERE share_id = ? AND subject_type = 'all' AND subject_id IS NULL"
    )
    .bind(shareId)
    .first<{ permission: Permission }>();

  if (allGrant && !permissions.includes(allGrant.permission)) {
    permissions.push(allGrant.permission);
  }

  return permissions;
}
