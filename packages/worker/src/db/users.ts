/**
 * User database operations
 */

import { hashPassword, verifyPassword } from "../auth/password";

export interface User {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  is_admin: number; // SQLite stores as INTEGER (0 or 1)
  must_change_password: number; // SQLite stores as INTEGER (0 or 1)
  created_at: number;
}

/**
 * Get user by username
 */
export async function getUserByUsername(
  db: D1Database,
  username: string
): Promise<User | null> {
  const result = await db
    .prepare("SELECT * FROM users WHERE username = ?")
    .bind(username)
    .first<User>();

  return result || null;
}

/**
 * Get user by ID
 */
export async function getUserById(
  db: D1Database,
  userId: string
): Promise<User | null> {
  const result = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<User>();

  return result || null;
}

/**
 * Get all users
 */
export async function getAllUsers(db: D1Database): Promise<User[]> {
  const results = await db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all<User>();

  return results.results || [];
}

/**
 * Check if any users exist in the database
 */
export async function hasAnyUsers(db: D1Database): Promise<boolean> {
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM users")
    .first<{ count: number }>();

  return (result?.count ?? 0) > 0;
}

/**
 * Create a new user
 * @param db - The database connection
 * @param username - The username of the user
 * @param password - The password of the user
 * @param isAdmin - If true, the user will be an admin
 * @param mustChangePassword - If true, the user will be forced to change password on first login
 * @returns The created user
 * @throws {Error} If the username is already taken
 */
export async function createUser(
  db: D1Database,
  username: string,
  password: string,
  isAdmin: boolean = false,
  mustChangePassword: boolean = false
): Promise<User> {
  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  const createdAt = Date.now();

  await db
    .prepare(
      "INSERT INTO users (id, username, password_hash, salt, is_admin, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, username, hash, salt, isAdmin ? 1 : 0, mustChangePassword ? 1 : 0, createdAt)
    .run();

  return {
    id,
    username,
    password_hash: hash,
    salt,
    is_admin: isAdmin ? 1 : 0,
    must_change_password: mustChangePassword ? 1 : 0,
    created_at: createdAt,
  };
}

/**
 * Delete a user by ID
 */
export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  // First delete associated sessions
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  // Then delete the user
  await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
}

/**
 * Toggle admin status for a user
 */
export async function toggleUserAdmin(
  db: D1Database,
  userId: string
): Promise<void> {
  await db
    .prepare("UPDATE users SET is_admin = CASE WHEN is_admin = 1 THEN 0 ELSE 1 END WHERE id = ?")
    .bind(userId)
    .run();
}

/**
 * Change user password
 * @returns true if password was changed successfully
 */
export async function changeUserPassword(
  db: D1Database,
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUserById(db, userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.password_hash, user.salt);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  // Hash new password
  const { hash, salt } = await hashPassword(newPassword);

  // Update password and clear must_change_password flag
  await db
    .prepare(
      "UPDATE users SET password_hash = ?, salt = ?, must_change_password = 0 WHERE id = ?"
    )
    .bind(hash, salt, userId)
    .run();

  return { success: true };
}

/**
 * Force set user password (admin function, does not require current password)
 */
export async function setUserPassword(
  db: D1Database,
  userId: string,
  newPassword: string,
  mustChangePassword: boolean = false
): Promise<void> {
  const { hash, salt } = await hashPassword(newPassword);

  await db
    .prepare(
      "UPDATE users SET password_hash = ?, salt = ?, must_change_password = ? WHERE id = ?"
    )
    .bind(hash, salt, mustChangePassword ? 1 : 0, userId)
    .run();
}

/**
 * Clear the must_change_password flag
 */
export async function clearMustChangePassword(
  db: D1Database,
  userId: string
): Promise<void> {
  await db
    .prepare("UPDATE users SET must_change_password = 0 WHERE id = ?")
    .bind(userId)
    .run();
}

/**
 * Verify user credentials
 * @returns User if credentials are valid, null otherwise
 */
export async function verifyUserCredentials(
  db: D1Database,
  username: string,
  password: string
): Promise<User | null> {
  const user = await getUserByUsername(db, username);
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    return null;
  }

  return user;
}
