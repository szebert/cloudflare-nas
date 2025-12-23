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
 * Create a new user
 */
export async function createUser(
  db: D1Database,
  username: string,
  password: string,
  isAdmin: boolean = false
): Promise<User> {
  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  const createdAt = Date.now();

  await db
    .prepare(
      "INSERT INTO users (id, username, password_hash, salt, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id, username, hash, salt, isAdmin ? 1 : 0, createdAt)
    .run();

  return {
    id,
    username,
    password_hash: hash,
    salt,
    is_admin: isAdmin ? 1 : 0,
    created_at: createdAt,
  };
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
