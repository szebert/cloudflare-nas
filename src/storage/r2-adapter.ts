/**
 * R2 adapter implementation of StorageBucket interface.
 * Wraps Cloudflare R2Bucket to provide generic storage interface.
 */

import type {
  StorageBucket,
  StorageHTTPMetadata,
  StorageListOptions,
  StorageObject,
  StorageObjectBody,
  StorageObjects,
  StoragePutOptions,
} from "./interface";

/**
 * Adapter that wraps R2Bucket to implement StorageBucket interface
 */
export class R2StorageAdapter implements StorageBucket {
  constructor(private readonly r2Bucket: R2Bucket) {}

  async head(key: string): Promise<StorageObject | null> {
    const r2Object = await this.r2Bucket.head(key);
    if (!r2Object) return null;
    return this.mapR2ObjectToStorageObject(r2Object);
  }

  async get(key: string): Promise<StorageObjectBody | null> {
    const r2Object = await this.r2Bucket.get(key);
    if (!r2Object) return null;

    // Check if it has a body (R2ObjectBody vs R2Object)
    if ("body" in r2Object && r2Object.body) {
      return this.mapR2ObjectBodyToStorageObjectBody(r2Object);
    }

    // If no body, return as StorageObject (shouldn't happen with get(), but handle it)
    return this.mapR2ObjectToStorageObject(r2Object) as StorageObjectBody;
  }

  async put(
    key: string,
    value:
      | ReadableStream
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null
      | Blob,
    options?: StoragePutOptions
  ): Promise<StorageObject> {
    const r2Options = options
      ? {
          httpMetadata: options.httpMetadata
            ? this.mapStorageHTTPMetadataToR2(options.httpMetadata)
            : undefined,
          customMetadata: options.customMetadata,
          storageClass: options.storageClass,
        }
      : undefined;

    const r2Object = await this.r2Bucket.put(key, value, r2Options);
    return this.mapR2ObjectToStorageObject(r2Object);
  }

  async delete(keys: string | string[]): Promise<void> {
    await this.r2Bucket.delete(keys);
  }

  async list(options?: StorageListOptions): Promise<StorageObjects> {
    const r2Options = options
      ? {
          limit: options.limit,
          prefix: options.prefix,
          cursor: options.cursor,
          delimiter: options.delimiter,
          startAfter: options.startAfter,
          include: options.include,
        }
      : undefined;

    const r2Objects = await this.r2Bucket.list(r2Options);
    return {
      objects: r2Objects.objects.map((obj) =>
        this.mapR2ObjectToStorageObject(obj)
      ),
      delimitedPrefixes: r2Objects.delimitedPrefixes,
      truncated: r2Objects.truncated,
      cursor: r2Objects.truncated ? r2Objects.cursor : undefined,
    };
  }

  /**
   * Map R2Object to StorageObject
   */
  private mapR2ObjectToStorageObject(r2Object: R2Object): StorageObject {
    return {
      key: r2Object.key,
      size: r2Object.size,
      uploaded: r2Object.uploaded,
      httpMetadata: r2Object.httpMetadata
        ? this.mapR2HTTPMetadataToStorage(r2Object.httpMetadata)
        : undefined,
      customMetadata: r2Object.customMetadata,
      storageClass: r2Object.storageClass,
      httpEtag: r2Object.httpEtag,
    };
  }

  /**
   * Map R2ObjectBody to StorageObjectBody
   */
  private mapR2ObjectBodyToStorageObjectBody(
    r2Object: R2ObjectBody
  ): StorageObjectBody {
    const base = this.mapR2ObjectToStorageObject(r2Object);
    // Create an object with getters for body and bodyUsed
    const result = {
      ...base,
      arrayBuffer: () => r2Object.arrayBuffer(),
      bytes: () => r2Object.bytes(),
      text: () => r2Object.text(),
      json: <T>() => r2Object.json<T>(),
      blob: () => r2Object.blob(),
    } as StorageObjectBody;

    // Define getters for body and bodyUsed
    Object.defineProperty(result, "body", {
      get: () => r2Object.body,
      enumerable: true,
      configurable: false,
    });

    Object.defineProperty(result, "bodyUsed", {
      get: () => r2Object.bodyUsed,
      enumerable: true,
      configurable: false,
    });

    return result;
  }

  /**
   * Map R2HTTPMetadata to StorageHTTPMetadata
   */
  private mapR2HTTPMetadataToStorage(
    r2Metadata: R2HTTPMetadata
  ): StorageHTTPMetadata {
    return {
      contentType: r2Metadata.contentType,
      contentLanguage: r2Metadata.contentLanguage,
      contentDisposition: r2Metadata.contentDisposition,
      contentEncoding: r2Metadata.contentEncoding,
      cacheControl: r2Metadata.cacheControl,
      cacheExpiry: r2Metadata.cacheExpiry,
    };
  }

  /**
   * Map StorageHTTPMetadata to R2HTTPMetadata
   */
  private mapStorageHTTPMetadataToR2(
    storageMetadata: StorageHTTPMetadata
  ): R2HTTPMetadata {
    return {
      contentType: storageMetadata.contentType,
      contentLanguage: storageMetadata.contentLanguage,
      contentDisposition: storageMetadata.contentDisposition,
      contentEncoding: storageMetadata.contentEncoding,
      cacheControl: storageMetadata.cacheControl,
      cacheExpiry: storageMetadata.cacheExpiry,
    };
  }
}

/**
 * Create a StorageBucket from an R2Bucket
 */
export function createR2StorageBucket(r2Bucket: R2Bucket): StorageBucket {
  return new R2StorageAdapter(r2Bucket);
}
