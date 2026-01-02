/**
 * CacheManager - Central controller for session-based artifact caching.
 * Per research.md and data-model.md specifications.
 * T011: Implement CacheManager class core structure.
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import {
  writeArtifactToFile,
  readArtifactFromFile,
  createSessionDirectory,
  deleteSessionDirectory,
} from "./storage.js";
import type {
  CacheConfig,
  CacheState,
  CacheResult,
  ArtifactRef,
  LRUEntry,
} from "./types.js";

/**
 * Content type to file extension mapping.
 */
const CONTENT_TYPE_EXTENSION: Record<
  "image/svg+xml" | "application/pdf",
  "svg" | "pdf"
> = {
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/**
 * In-memory artifact metadata for quick lookups.
 */
interface ArtifactMeta {
  id: string;
  sessionId: string;
  contentType: "image/svg+xml" | "application/pdf";
  extension: "svg" | "pdf";
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
  path: string;
  uri: string;
}

/**
 * Session metadata tracked in memory.
 */
interface SessionMetadata {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  artifacts: Map<string, ArtifactMeta>;
  totalSizeBytes: number;
  directoryPath: string;
}

/**
 * CacheManager handles session-scoped artifact storage with LRU eviction.
 */
export class CacheManager {
  private config: CacheConfig;
  private sessions: Map<string, SessionMetadata>;
  private totalSizeBytes: number;
  private isHealthy: boolean;
  private lastCleanupAt: number | null;
  private cleanupIntervalId: NodeJS.Timeout | null;

  private constructor(config: CacheConfig) {
    this.config = config;
    this.sessions = new Map();
    this.totalSizeBytes = 0;
    this.isHealthy = false;
    this.lastCleanupAt = null;
    this.cleanupIntervalId = null;
  }

  /**
   * Create and initialize a new CacheManager.
   * Clears any orphaned artifacts from previous runs (FR-013).
   */
  static async create(config: CacheConfig): Promise<CacheManager> {
    const manager = new CacheManager(config);
    await manager.initialize();
    return manager;
  }

  /**
   * Initialize the cache manager.
   * Creates root directory and clears orphaned sessions.
   */
  private async initialize(): Promise<void> {
    try {
      // Clear entire cache directory on startup (per research.md Decision 8)
      await rm(this.config.rootDirectory, { recursive: true, force: true });
      await mkdir(this.config.rootDirectory, { recursive: true });

      this.isHealthy = true;

      // Start periodic cleanup if enabled
      if (this.config.cleanupIntervalMs > 0) {
        this.cleanupIntervalId = setInterval(() => {
          this.cleanupOrphanSessions().catch(() => {
            // Ignore cleanup errors
          });
        }, this.config.cleanupIntervalMs);
        // Don't keep the process alive just for cleanup
        this.cleanupIntervalId.unref();
      }
    } catch (error) {
      this.isHealthy = false;
      throw error;
    }
  }

  /**
   * Shutdown the cache manager.
   * Clears all sessions and stops cleanup interval.
   */
  async shutdown(): Promise<void> {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Clean up all sessions
    for (const [sessionId] of this.sessions) {
      await this.cleanupSession(sessionId);
    }

    this.isHealthy = false;
  }

  /**
   * Get current cache state.
   */
  getState(): CacheState {
    let artifactCount = 0;
    for (const session of this.sessions.values()) {
      artifactCount += session.artifacts.size;
    }

    return {
      totalSizeBytes: this.totalSizeBytes,
      sessionCount: this.sessions.size,
      artifactCount,
      isHealthy: this.isHealthy,
      lastCleanupAt: this.lastCleanupAt,
    };
  }

  /**
   * Check if cache is available for use.
   */
  isAvailable(): boolean {
    return this.config.enabled && this.isHealthy;
  }

  /**
   * Write an artifact to the cache.
   *
   * @param sessionId - Session identifier
   * @param content - Artifact content as Buffer
   * @param contentType - MIME type of the artifact
   * @returns Artifact reference for the tool response
   */
  async writeArtifact(
    sessionId: string,
    content: Buffer,
    contentType: "image/svg+xml" | "application/pdf",
  ): Promise<ArtifactRef> {
    const artifactId = randomUUID();
    const extension = CONTENT_TYPE_EXTENSION[contentType];
    const now = Date.now();

    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      const directoryPath = await createSessionDirectory(
        this.config.rootDirectory,
        sessionId,
      );
      session = {
        id: sessionId,
        createdAt: now,
        lastActivityAt: now,
        artifacts: new Map(),
        totalSizeBytes: 0,
        directoryPath,
      };
      this.sessions.set(sessionId, session);
    }

    // Write file
    const fileName = `${artifactId}.${extension}`;
    const filePath = join(session.directoryPath, fileName);
    const { sizeBytes } = await writeArtifactToFile(filePath, content);

    // Create file URI
    const uri = `file://${filePath}`;

    // Create artifact metadata
    const artifact: ArtifactMeta = {
      id: artifactId,
      sessionId,
      contentType,
      extension,
      sizeBytes,
      createdAt: now,
      lastAccessedAt: now,
      path: filePath,
      uri,
    };

    // Update tracking
    session.artifacts.set(artifactId, artifact);
    session.totalSizeBytes += sizeBytes;
    session.lastActivityAt = now;
    this.totalSizeBytes += sizeBytes;

    // Check quota and evict if needed (T050)
    if (this.totalSizeBytes > this.config.quotaBytes) {
      await this.evictLRU();
    }

    // Return reference for tool response
    return {
      artifact_id: artifactId,
      uri,
      content_type: contentType,
      size_bytes: sizeBytes,
    };
  }

  /**
   * Get an artifact by ID.
   *
   * @param artifactId - Artifact identifier
   * @param requestSessionId - Session making the request (for isolation check)
   * @returns Result with artifact content or error
   */
  async getArtifact(
    artifactId: string,
    requestSessionId: string,
  ): Promise<
    CacheResult<{ content: Buffer; contentType: string; sizeBytes: number }>
  > {
    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(artifactId)) {
      return {
        ok: false,
        error: {
          code: "INVALID_ARTIFACT_ID",
          message: "artifact_id must be a valid UUID",
        },
      };
    }

    // Find artifact across all sessions
    let foundArtifact: ArtifactMeta | undefined;
    let foundSession: SessionMetadata | undefined;

    for (const session of this.sessions.values()) {
      const artifact = session.artifacts.get(artifactId);
      if (artifact) {
        foundArtifact = artifact;
        foundSession = session;
        break;
      }
    }

    if (!foundArtifact || !foundSession) {
      return {
        ok: false,
        error: {
          code: "ARTIFACT_NOT_FOUND",
          message: `Artifact '${artifactId}' not found`,
        },
      };
    }

    // Check session isolation
    if (foundArtifact.sessionId !== requestSessionId) {
      return {
        ok: false,
        error: {
          code: "SESSION_MISMATCH",
          message: "Artifact belongs to a different session",
          details: {
            artifact_session: foundArtifact.sessionId,
            request_session: requestSessionId,
          },
        },
      };
    }

    // Read content
    try {
      const content = await readArtifactFromFile(foundArtifact.path);

      // Update last accessed time
      const now = Date.now();
      foundArtifact.lastAccessedAt = now;
      foundSession.lastActivityAt = now;

      return {
        ok: true,
        value: {
          content,
          contentType: foundArtifact.contentType,
          sizeBytes: foundArtifact.sizeBytes,
        },
      };
    } catch {
      // File was deleted (e.g., by eviction) - remove from metadata
      this.totalSizeBytes -= foundArtifact.sizeBytes;
      foundSession.totalSizeBytes -= foundArtifact.sizeBytes;
      foundSession.artifacts.delete(artifactId);

      return {
        ok: false,
        error: {
          code: "ARTIFACT_NOT_FOUND",
          message: `Artifact '${artifactId}' not found`,
        },
      };
    }
  }

  /**
   * Update session activity timestamp.
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Clean up a specific session and its artifacts.
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Update total size
    this.totalSizeBytes -= session.totalSizeBytes;

    // Delete directory and all contents
    await deleteSessionDirectory(session.directoryPath);

    // Remove from tracking
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up orphaned sessions (sessions with no recent activity).
   */
  private async cleanupOrphanSessions(): Promise<void> {
    const now = Date.now();
    const staleThreshold = now - this.config.sessionTimeoutMs;

    const staleSessions: string[] = [];
    for (const session of this.sessions.values()) {
      if (session.lastActivityAt < staleThreshold) {
        staleSessions.push(session.id);
      }
    }

    for (const sessionId of staleSessions) {
      await this.cleanupSession(sessionId);
    }

    this.lastCleanupAt = now;
  }

  /**
   * Get LRU-sorted list of all artifacts.
   */
  private getLRUIndex(): LRUEntry[] {
    const entries: LRUEntry[] = [];

    for (const session of this.sessions.values()) {
      for (const artifact of session.artifacts.values()) {
        entries.push({
          artifactId: artifact.id,
          sessionId: artifact.sessionId,
          lastAccessedAt: artifact.lastAccessedAt,
          sizeBytes: artifact.sizeBytes,
        });
      }
    }

    // Sort by lastAccessedAt ascending (oldest first)
    entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    return entries;
  }

  /**
   * Evict LRU artifacts until cache is under 90% quota.
   */
  async evictLRU(): Promise<void> {
    const targetSize = this.config.quotaBytes * 0.9;

    while (this.totalSizeBytes > targetSize) {
      const lruIndex = this.getLRUIndex();
      if (lruIndex.length === 0) {
        break;
      }

      const oldest = lruIndex[0];
      const session = this.sessions.get(oldest.sessionId);
      if (!session) {
        break;
      }

      const artifact = session.artifacts.get(oldest.artifactId);
      if (!artifact) {
        break;
      }

      // Delete file
      try {
        await rm(artifact.path, { force: true });
      } catch {
        // Ignore deletion errors
      }

      // Update tracking
      this.totalSizeBytes -= artifact.sizeBytes;
      session.totalSizeBytes -= artifact.sizeBytes;
      session.artifacts.delete(oldest.artifactId);

      // Clean up empty session
      if (session.artifacts.size === 0) {
        await deleteSessionDirectory(session.directoryPath);
        this.sessions.delete(oldest.sessionId);
      }
    }
  }
}
