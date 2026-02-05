import { HonoRequest } from "hono/request";

/**
 * Gets the correct origin/base URL for the current environment.
 * Detects dev mode by checking for wrangler dev headers (mf-original-url or referer with localhost).
 * In dev mode, extracts localhost origin from these headers.
 * In production, uses the request origin.
 */
export function getOrigin(request: HonoRequest): string {
  const headers = request.raw.headers;
  const requestUrl = request.url;

  // Helper to get header value (case-insensitive for Headers object)
  const getHeader = (name: string): string | null => {
    if (!headers) return null;
    if (headers instanceof Headers) {
      // Headers.get() is case-insensitive
      return headers.get(name.toLowerCase());
    }
    // For record, check both exact and lowercase keys
    return headers[name] || headers[name.toLowerCase()] || null;
  };

  // Check for mf-original-url header (set by wrangler dev in --remote mode)
  const mfOriginalUrl = getHeader("mf-original-url");

  if (mfOriginalUrl) {
    try {
      const url = new URL(mfOriginalUrl);
      return url.origin;
    } catch {
      // If parsing fails, fall through to other checks
    }
  }

  // Check referer header for localhost (fallback for dev mode)
  const referer = getHeader("referer");

  if (referer && (referer.includes("localhost") || referer.includes("127.0.0.1"))) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      // If parsing fails, fall through
    }
  }

  // In production (or if no dev headers found), use the request origin
  const url = new URL(requestUrl);
  return url.origin;
}

