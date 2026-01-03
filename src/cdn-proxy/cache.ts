/**
 * LRU cache for CDN Proxy artifacts.
 * Uses lru-cache library with size-based eviction and TTL.
 */

import { LRUCache } from "lru-cache";
import type { CacheEntry, CacheStats } from "./types.js";

/**
 * Cache configuration.
 */
export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSizeBytes: number;

  /** Cache entry TTL in milliseconds */
  ttlMs: number;

  /** Threshold for caching: only cache artifacts smaller than this */
  thresholdBytes: number;
}

/**
 * Cache interface for artifact caching.
 */
export interface ArtifactCache {
  /** Get an entry from cache. Returns undefined if not found or expired. */
  get(key: string): CacheEntry | undefined;

  /** Store an entry in cache. Returns false if too large for caching. */
  set(key: string, entry: CacheEntry): boolean;

  /** Check if an artifact should be cached based on size */
  shouldCache(sizeBytes: number): boolean;

  /** Get cache statistics */
  getStats(): CacheStats;

  /** Check if there's an in-flight request for a key */
  hasInFlight(key: string): boolean;

  /** Get in-flight request promise */
  getInFlight(key: string): Promise<CacheEntry> | undefined;

  /** Set in-flight request promise */
  setInFlight(key: string, promise: Promise<CacheEntry>): void;

  /** Remove in-flight request */
  removeInFlight(key: string): void;
}

/**
 * Create an LRU cache for artifacts.
 */
export function createCache(config: CacheConfig): ArtifactCache {
  // Track hit/miss statistics
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  // LRU cache with size-based eviction
  const cache = new LRUCache<string, CacheEntry>({
    maxSize: config.maxSizeBytes,
    sizeCalculation: (entry) => entry.sizeBytes,
    ttl: config.ttlMs,
    dispose: () => {
      evictions++;
    },
  });

  // Track in-flight requests for request coalescing
  const inFlight = new Map<string, Promise<CacheEntry>>();

  return {
    get(key: string): CacheEntry | undefined {
      const entry = cache.get(key);
      if (entry) {
        hits++;
      } else {
        misses++;
      }
      return entry;
    },

    set(key: string, entry: CacheEntry): boolean {
      if (entry.sizeBytes > config.thresholdBytes) {
        return false; // Too large for caching
      }
      cache.set(key, entry);
      return true;
    },

    shouldCache(sizeBytes: number): boolean {
      return sizeBytes <= config.thresholdBytes;
    },

    getStats(): CacheStats {
      const total = hits + misses;
      return {
        hits,
        misses,
        evictions,
        sizeBytes: cache.calculatedSize ?? 0,
        maxSizeBytes: config.maxSizeBytes,
        entryCount: cache.size,
        hitRate: total > 0 ? hits / total : 0,
      };
    },

    hasInFlight(key: string): boolean {
      return inFlight.has(key);
    },

    getInFlight(key: string): Promise<CacheEntry> | undefined {
      return inFlight.get(key);
    },

    setInFlight(key: string, promise: Promise<CacheEntry>): void {
      inFlight.set(key, promise);
    },

    removeInFlight(key: string): void {
      inFlight.delete(key);
    },
  };
}
