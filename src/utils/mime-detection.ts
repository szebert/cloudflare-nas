/**
 * MIME type detection utilities.
 * Detects content types from file content (magic bytes) and file extensions.
 */

interface DetectContentTypeOptions {
  /** Current content type (if known) - will be used if not generic */
  contentType?: string | null;
  /** File path for extension-based detection */
  filePath: string;
  /** File bytes for magic byte detection (for uploads) */
  bytes?: Uint8Array | ArrayBuffer;
  /** R2Bucket instance for reading existing files */
  bucket?: R2Bucket;
  /** File size (needed when using bucket) */
  fileSize?: number;
}

/**
 * Unified content type detection function.
 * Priority: provided contentType (if not generic) > magic bytes > file extension
 * @param options Detection options
 * @returns Detected MIME type or null
 */
export async function detectContentType(
  options: DetectContentTypeOptions
): Promise<string | null> {
  const { contentType, filePath, bytes, bucket, fileSize } = options;

  // If we have a specific content type (not generic), use it
  if (contentType && contentType !== "application/octet-stream") {
    return contentType;
  }

  // Try magic bytes first (most accurate)
  if (bytes) {
    const bytesArray =
      bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    const bytesToCheck = Math.min(512, bytesArray.length);
    const firstBytes = bytesArray.slice(0, bytesToCheck);
    const detected = detectContentTypeFromBytes(firstBytes);
    if (detected) {
      return detected;
    }
  } else if (bucket && fileSize !== undefined && fileSize > 0) {
    // For existing files, read magic bytes from bucket
    const MAX_MAGIC_BYTE_CHECK_SIZE = 10 * 1024 * 1024; // 10MB
    if (fileSize <= MAX_MAGIC_BYTE_CHECK_SIZE) {
      try {
        const object = await bucket.get(filePath);
        if (object && object.body) {
          const arrayBuffer = await object.arrayBuffer();
          const bytesToCheck = Math.min(512, arrayBuffer.byteLength);
          const firstBytes = new Uint8Array(arrayBuffer.slice(0, bytesToCheck));
          const detected = detectContentTypeFromBytes(firstBytes);
          if (detected) {
            return detected;
          }
        }
      } catch {
        // If we can't read, fall through to extension
      }
    }
  }

  // Fall back to extension-based detection
  return detectContentTypeFromPath(filePath);
}

/**
 * Detects MIME content type from file content (magic bytes).
 * This is more accurate than extension-based detection.
 * @param bytes First bytes of the file (at least 12-100 bytes recommended)
 * @returns MIME type string or null if unknown
 */
export function detectContentTypeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 2) return null;

  // Images
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  // GIF: 47 49 46 38 (GIF8)
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }

  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }

  // WebP: RIFF...WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // ICO: 00 00 01 00
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return "image/x-icon";
  }

  // TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
  if (
    (bytes[0] === 0x49 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x2a &&
      bytes[3] === 0x00) ||
    (bytes[0] === 0x4d &&
      bytes[1] === 0x4d &&
      bytes[2] === 0x00 &&
      bytes[3] === 0x2a)
  ) {
    return "image/tiff";
  }

  // AVIF: ftyp...avif
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") {
      return "image/avif";
    }
  }

  // SVG: Check if it starts with XML declaration or <svg
  if (bytes.length >= 5) {
    const start = String.fromCharCode(
      ...bytes.slice(0, Math.min(100, bytes.length))
    );
    if (start.trim().startsWith("<?xml") || start.trim().startsWith("<svg")) {
      return "image/svg+xml";
    }
  }

  // Videos
  // MP4: ftyp... (ISO Base Media)
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (
      brand === "isom" ||
      brand === "iso2" ||
      brand === "mp41" ||
      brand === "mp42" ||
      brand === "avc1" ||
      brand === "dash"
    ) {
      return "video/mp4";
    }
    if (brand === "qt  " || brand === "moov") {
      return "video/quicktime";
    }
  }

  // WebM: 1A 45 DF A3 (EBML header)
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    // Check if it's WebM or MKV
    if (bytes.length >= 40) {
      const header = String.fromCharCode(
        ...bytes.slice(0, Math.min(100, bytes.length))
      );
      if (header.includes("matroska")) {
        return "video/x-matroska";
      }
    }
    return "video/webm";
  }

  // AVI: RIFF...AVI
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x41 &&
    bytes[9] === 0x56 &&
    bytes[10] === 0x49 &&
    bytes[11] === 0x20
  ) {
    return "video/x-msvideo";
  }

  // FLV: 46 4C 56 01
  if (
    bytes[0] === 0x46 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x56 &&
    bytes[3] === 0x01
  ) {
    return "video/x-flv";
  }

  // WMV/ASF: 30 26 B2 75 8E 66 CF 11
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x30 &&
    bytes[1] === 0x26 &&
    bytes[2] === 0xb2 &&
    bytes[3] === 0x75 &&
    bytes[4] === 0x8e &&
    bytes[5] === 0x66 &&
    bytes[6] === 0xcf &&
    bytes[7] === 0x11
  ) {
    return "video/x-ms-wmv";
  }

  // Audio
  // MP3: ID3 tag (49 44 33) or MPEG frame sync (FF FB or FF F3)
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] === 0xfb || bytes[1] === 0xf3))
  ) {
    return "audio/mpeg";
  }

  // WAV: RIFF...WAVE
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return "audio/wav";
  }

  // OGG: OggS
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return "audio/ogg";
  }

  // FLAC: fLaC
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x66 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x61 &&
    bytes[3] === 0x43
  ) {
    return "audio/flac";
  }

  // Documents
  // PDF: %PDF
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }

  // ZIP-based formats (ZIP, DOCX, XLSX, PPTX)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    // Check for Office Open XML formats by looking for specific internal structure
    // For now, return generic ZIP - extension can help differentiate
    return "application/zip";
  }

  // Text files - check if it's valid UTF-8 or ASCII
  if (bytes.length >= 1) {
    try {
      const text = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: false,
      }).decode(bytes.slice(0, Math.min(512, bytes.length)));
      // Check for common text file indicators
      if (
        text.trim().startsWith("<?xml") ||
        text.trim().startsWith("<!DOCTYPE html") ||
        text.trim().startsWith("<html")
      ) {
        if (text.includes("<?xml") || text.includes("<svg")) {
          return "application/xml";
        }
        return "text/html";
      }
      // If it's mostly printable ASCII/UTF-8, could be text
      // But we'll be conservative and only return text for known patterns
    } catch {
      // Not valid UTF-8, not a text file
    }
  }

  return null;
}

/**
 * Detects MIME content type from file extension.
 * Returns the appropriate MIME type or null if unknown.
 * @param filePath The file path or filename
 * @returns MIME type string or null
 */
export function detectContentTypeFromPath(filePath: string): string | null {
  // Extract extension (case-insensitive)
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filePath.length - 1) {
    return null;
  }
  const ext = filePath.slice(lastDot + 1).toLowerCase();

  // Comprehensive MIME type mapping
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
    tiff: "image/tiff",
    tif: "image/tiff",
    avif: "image/avif",
    heic: "image/heic",
    heif: "image/heif",
    // Videos
    mp4: "video/mp4",
    m4v: "video/x-m4v",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
    webm: "video/webm",
    mkv: "video/x-matroska",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
    "3gp": "video/3gpp",
    "3g2": "video/3gpp2",
    ogv: "video/ogg",
    ts: "video/mp2t",
    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac",
    wma: "audio/x-ms-wma",
    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Text
    txt: "text/plain",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    xml: "application/xml",
    csv: "text/csv",
    // Archives
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
    // Code
    jsx: "text/jsx",
    tsx: "text/tsx",
    py: "text/x-python",
    java: "text/x-java-source",
    c: "text/x-c",
    cpp: "text/x-c++",
    h: "text/x-c",
    hpp: "text/x-c++",
    // Other
    exe: "application/x-msdownload",
    dmg: "application/x-apple-diskimage",
    iso: "application/x-iso9660-image",
  };

  return mimeTypes[ext] || null;
}
