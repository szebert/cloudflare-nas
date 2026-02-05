/**
 * Utility functions for share link path validation and manipulation
 */

/**
 * Normalizes a path for comparison by:
 * - Removing leading/trailing slashes
 * - Resolving any . or .. components
 * - Ensuring consistent format
 */
export function normalizeSharePath(path: string): string {
  if (!path) return "";

  // Remove leading and trailing slashes
  let normalized = path.replace(/^\/+|\/+$/g, "");

  // Split into parts and resolve . and ..
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (part === "" || part === ".") {
      // Skip empty parts and current directory
      continue;
    } else if (part === "..") {
      // Go up one level, but don't allow going above root
      if (parts.length > 0) {
        parts.pop();
      }
    } else {
      parts.push(part);
    }
  }

  return parts.join("/");
}

/**
 * Validates that a requested path is within the share's scope.
 * Prevents path traversal attacks.
 * 
 * @param sharePath The root path of the share (e.g., "folder/subfolder")
 * @param requestedPath The path being requested (e.g., "folder/subfolder/file.txt")
 * @returns true if the requested path is within the share scope
 */
export function isPathWithinShare(sharePath: string, requestedPath: string): boolean {
  const normalizedShare = normalizeSharePath(sharePath);
  const normalizedRequest = normalizeSharePath(requestedPath);

  // If share path is empty, allow access to root
  if (!normalizedShare) {
    return true;
  }

  // Requested path must start with the share path
  if (!normalizedRequest.startsWith(normalizedShare)) {
    return false;
  }

  // Ensure it's not just a prefix match (e.g., "folder" matching "folder2")
  // Check that either:
  // 1. The paths are exactly equal
  // 2. The requested path continues with a slash after the share path
  if (normalizedRequest.length === normalizedShare.length) {
    return true;
  }

  // Check that the next character after the share path is a slash
  return normalizedRequest[normalizedShare.length] === "/";
}

/**
 * Gets the relative path from the share root.
 * 
 * @param sharePath The root path of the share
 * @param requestedPath The full requested path
 * @returns The relative path from the share root, or empty string if at root
 */
export function getRelativePath(sharePath: string, requestedPath: string): string {
  const normalizedShare = normalizeSharePath(sharePath);
  const normalizedRequest = normalizeSharePath(requestedPath);

  // If share path is empty, the relative path is the full requested path
  if (!normalizedShare) {
    return normalizedRequest;
  }

  // If requested path doesn't start with share path, return empty
  if (!normalizedRequest.startsWith(normalizedShare)) {
    return "";
  }

  // Extract the relative portion
  const relative = normalizedRequest.slice(normalizedShare.length).replace(/^\/+/, "");
  return relative;
}

/**
 * Builds the full R2 path by combining share root with relative path.
 * 
 * @param sharePath The root path of the share
 * @param relativePath The relative path from share root
 * @returns The full R2 path
 */
export function buildSharePath(sharePath: string, relativePath: string): string {
  const normalizedShare = normalizeSharePath(sharePath);
  const normalizedRelative = normalizeSharePath(relativePath);

  if (!normalizedShare) {
    return normalizedRelative;
  }

  if (!normalizedRelative) {
    return normalizedShare;
  }

  return `${normalizedShare}/${normalizedRelative}`;
}

