/**
 * Password hashing using PBKDF2 via Web Crypto API
 */

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256; // 32 bytes
const HASH_ALGORITHM = "SHA-256";

/**
 * Generate a random salt
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Hash a password using PBKDF2
 * @param password - Plain text password
 * @param salt - Optional salt (generated if not provided)
 * @returns Object with hash and salt
 */
export async function hashPassword(
  password: string,
  salt?: string
): Promise<{ hash: string; salt: string }> {
  const saltValue = salt || generateSalt();
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(saltValue);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return { hash, salt: saltValue };
}

/**
 * Verify a password against a stored hash and salt
 * @param password - Plain text password to verify
 * @param storedHash - Stored password hash
 * @param storedSalt - Stored salt
 * @returns True if password matches
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}
