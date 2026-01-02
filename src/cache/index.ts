/**
 * Cache module public API.
 * T012: Export cache module public API.
 */

export { CacheManager } from "./manager.js";
export { loadCacheConfig } from "./config.js";
export { extractSessionId, type RequestHandlerExtra } from "./session.js";
export type {
  ArtifactRef,
  Artifact,
  SessionMeta,
  CacheConfig,
  CacheState,
  CacheError,
  CacheErrorCode,
  CacheResult,
  LRUEntry,
} from "./types.js";
export {
  CONTENT_TYPE_TO_EXTENSION,
  EXTENSION_TO_CONTENT_TYPE,
} from "./types.js";
