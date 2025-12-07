/**
 * Checks if file bytes match known image format magic bytes (file signatures).
 */
function checkImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return true;

  // GIF: 47 49 46 38 (GIF8)
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  )
    return true;

  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return true;

  // WebP: Check for RIFF...WEBP
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
  )
    return true;

  // ICO: 00 00 01 00
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  )
    return true;

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
  )
    return true;

  // AVIF: ftyp...avif
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    // Check for avif brand in bytes 8-11
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") return true;
  }

  // SVG: Check if it starts with XML declaration or <svg
  if (bytes.length >= 5) {
    const start = String.fromCharCode(
      ...bytes.slice(0, Math.min(100, bytes.length))
    );
    if (start.trim().startsWith("<?xml") || start.trim().startsWith("<svg"))
      return true;
  }

  return false;
}

/**
 * Checks if a file is an image by examining its magic bytes.
 * @param bucket R2Bucket instance
 * @param filePath Path to the file in the bucket
 * @param fileSize Size of the file (to avoid checking huge files)
 * @returns true if magic bytes indicate an image format
 */
async function checkImageMagicBytesAsync(
  bucket: R2Bucket,
  filePath: string,
  fileSize: number
): Promise<boolean> {
  // Only check magic bytes for files under 10MB to avoid downloading huge files
  const MAX_MAGIC_BYTE_CHECK_SIZE = 10 * 1024 * 1024; // 10MB
  if (fileSize <= 0 || fileSize > MAX_MAGIC_BYTE_CHECK_SIZE) {
    return false;
  }

  try {
    // Fetch the object and read first bytes to check magic bytes
    const object = await bucket.get(filePath);
    if (object && object.body) {
      const arrayBuffer = await object.arrayBuffer();
      // Only check first 100 bytes (enough for all image format signatures)
      const bytesToCheck = Math.min(100, arrayBuffer.byteLength);
      const bytes = new Uint8Array(arrayBuffer.slice(0, bytesToCheck));
      return checkImageMagicBytes(bytes);
    }
  } catch (error) {
    // If we can't read magic bytes, return false
    return false;
  }

  return false;
}

/**
 * Determines if a file is likely an image.
 * Uses the simplest checks first (content type, extension) and only falls back
 * to magic bytes check if easy checks are insufficient.
 * @param contentType MIME content type of the file
 * @param fileName Name of the file (for extension check)
 * @param bucket R2Bucket instance (optional, needed for magic bytes check)
 * @param filePath Path to the file in the bucket (optional, needed for magic bytes check)
 * @param fileSize Size of the file (optional, needed for magic bytes check)
 * @returns true if the file is an image
 */
export async function isImage(
  contentType: string | null,
  fileName: string,
  bucket?: R2Bucket,
  filePath?: string,
  fileSize?: number
): Promise<boolean> {
  // Easiest check: content type
  if (contentType && contentType.startsWith("image/")) {
    return true;
  }

  // Easy check: file extension
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
    ".ico",
    ".tiff",
    ".tif",
    ".avif",
    ".heic",
    ".heif",
  ];
  const lowerFileName = fileName.toLowerCase();
  if (imageExtensions.some((ext) => lowerFileName.endsWith(ext))) {
    return true;
  }

  // If easy checks didn't pass and we have the necessary info, try magic bytes
  if (bucket && filePath && fileSize !== undefined) {
    return await checkImageMagicBytesAsync(bucket, filePath, fileSize);
  }

  // If we can't do magic bytes check, return false
  return false;
}
