/**
 * Session management using secure tokens stored in cookies
 */

const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Create a session for a user
 * For MVP: we'll store sessions in a simple sessions table
 * @param db - D1 database instance
 * @param userId - User ID
 * @returns Session token
 */
export async function createSession(
  db: D1Database,
  userId: string
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  await db
    .prepare(
      "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(token, userId, expiresAt, Date.now())
    .run();

  return token;
}

/**
 * Validate a session token and return the user ID
 * @param db - D1 database instance
 * @param token - Session token
 * @returns User ID if valid, null otherwise
 */
export async function validateSession(
  db: D1Database,
  token: string
): Promise<string | null> {
  const result = await db
    .prepare(
      "SELECT user_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?"
    )
    .bind(token, Date.now())
    .first<{ user_id: string; expires_at: number }>();

  if (!result) {
    return null;
  }

  return result.user_id;
}

/**
 * Clear a session (logout)
 * @param db - D1 database instance
 * @param token - Session token
 */
export async function clearSession(
  db: D1Database,
  token: string
): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

/**
 * Clear all expired sessions (cleanup)
 * @param db - D1 database instance
 */
export async function clearExpiredSessions(db: D1Database): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .bind(Date.now())
    .run();
}
