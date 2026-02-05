/**
 * Generic storage bucket abstraction interface.
 * This allows swapping between different cloud storage providers (R2, S3, etc.)
 * without changing business logic.
 */

/**
 * HTTP metadata for stored objects
 */
export interface StorageHTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

/**
 * Options for listing objects
 */
export interface StorageListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  startAfter?: string;
  include?: ("httpMetadata" | "customMetadata")[];
}

/**
 * Options for putting/uploading objects
 */
export interface StoragePutOptions {
  httpMetadata?: StorageHTTPMetadata;
  customMetadata?: Record<string, string>;
  storageClass?: string;
}

/**
 * Represents a stored object (metadata only, no body)
 */
export interface StorageObject {
  readonly key: string;
  readonly size: number;
  readonly uploaded: Date;
  readonly httpMetadata?: StorageHTTPMetadata;
  readonly customMetadata?: Record<string, string>;
  readonly storageClass?: string;
  readonly httpEtag: string;
}

/**
 * Represents a stored object with body content
 */
export interface StorageObjectBody extends StorageObject {
  readonly body: ReadableStream;
  readonly bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

/**
 * Result of listing objects
 */
export interface StorageObjects {
  objects: StorageObject[];
  delimitedPrefixes: string[];
  truncated: boolean;
  cursor?: string;
}

/**
 * Generic storage bucket interface
 */
export interface StorageBucket {
  /**
   * Get object metadata without body
   */
  head(key: string): Promise<StorageObject | null>;

  /**
   * Get object with body
   */
  get(key: string): Promise<StorageObjectBody | null>;

  /**
   * Put/upload object
   */
  put(
    key: string,
    value:
      | ReadableStream
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null
      | Blob,
    options?: StoragePutOptions
  ): Promise<StorageObject>;

  /**
   * Delete object(s)
   */
  delete(keys: string | string[]): Promise<void>;

  /**
   * List objects
   */
  list(options?: StorageListOptions): Promise<StorageObjects>;
}
