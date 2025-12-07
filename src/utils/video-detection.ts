/**
 * Checks if file bytes match known video format magic bytes (file signatures).
 */
function checkVideoMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;

  // MP4: ftyp... (ISO Base Media)
  // MP4 files start with ftyp at offset 4
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    // Check for common MP4 brands
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (
      brand === "isom" ||
      brand === "iso2" ||
      brand === "mp41" ||
      brand === "mp42" ||
      brand === "avc1" ||
      brand === "dash"
    )
      return true;
  }

  // WebM: 1A 45 DF A3 (EBML header)
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return true;

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
  )
    return true;

  // MOV/QuickTime: ftyp...qt
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "qt  " || brand === "moov") return true;
  }

  // FLV: 46 4C 56 01 (FLV header)
  if (
    bytes[0] === 0x46 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x56 &&
    bytes[3] === 0x01
  )
    return true;

  // MKV: 1A 45 DF A3 (same as WebM, but can be differentiated by content)
  // We'll treat MKV as video if it has the EBML header
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    // Check for matroska signature
    if (bytes.length >= 40) {
      const header = String.fromCharCode(
        ...bytes.slice(0, Math.min(100, bytes.length))
      );
      if (header.includes("matroska")) return true;
    }
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
  )
    return true;

  return false;
}

/**
 * Checks if a file is a video by examining its magic bytes.
 * @param bucket R2Bucket instance
 * @param filePath Path to the file in the bucket
 * @param fileSize Size of the file (to avoid checking huge files)
 * @returns true if magic bytes indicate a video format
 */
async function checkVideoMagicBytesAsync(
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
      // Only check first 100 bytes (enough for all video format signatures)
      const bytesToCheck = Math.min(100, arrayBuffer.byteLength);
      const bytes = new Uint8Array(arrayBuffer.slice(0, bytesToCheck));
      return checkVideoMagicBytes(bytes);
    }
  } catch (error) {
    // If we can't read magic bytes, return false
    return false;
  }

  return false;
}

/**
 * Determines if a file is likely a video.
 * Uses the simplest checks first (content type, extension) and only falls back
 * to magic bytes check if easy checks are insufficient.
 * @param contentType MIME content type of the file
 * @param fileName Name of the file (for extension check)
 * @param bucket R2Bucket instance (optional, needed for magic bytes check)
 * @param filePath Path to the file in the bucket (optional, needed for magic bytes check)
 * @param fileSize Size of the file (optional, needed for magic bytes check)
 * @returns true if the file is a video
 */
export async function isVideo(
  contentType: string | null,
  fileName: string,
  bucket?: R2Bucket,
  filePath?: string,
  fileSize?: number
): Promise<boolean> {
  // Easiest check: content type
  if (contentType && contentType.startsWith("video/")) {
    return true;
  }

  // Easy check: file extension
  const videoExtensions = [
    ".mp4",
    ".m4v",
    ".mov",
    ".qt",
    ".avi",
    ".wmv",
    ".asf",
    ".flv",
    ".swf",
    ".webm",
    ".mkv",
    ".mpeg",
    ".mpg",
    ".mpe",
    ".mp2",
    ".m2v",
    ".3gp",
    ".3g2",
    ".ogv",
    ".ogg",
    ".ts",
    ".mts",
    ".m2ts",
  ];
  const lowerFileName = fileName.toLowerCase();
  if (videoExtensions.some((ext) => lowerFileName.endsWith(ext))) {
    return true;
  }

  // If easy checks didn't pass and we have the necessary info, try magic bytes
  if (bucket && filePath && fileSize !== undefined) {
    return await checkVideoMagicBytesAsync(bucket, filePath, fileSize);
  }

  // If we can't do magic bytes check, return false
  return false;
}
