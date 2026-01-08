/**
 * Storage Error Classes
 * Feature: 010-local-disk-storage
 */

import type { StorageErrorCode } from "./types.js";

/**
 * Base error class for storage operations
 */
export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Storage full error (disk full)
 */
export class StorageFullError extends StorageError {
  constructor(message: string) {
    super("STORAGE_FULL", message);
    this.name = "StorageFullError";
  }
}

/**
 * Permission denied error (write access denied)
 */
export class StoragePermissionError extends StorageError {
  constructor(message: string) {
    super("PERMISSION_DENIED", message);
    this.name = "StoragePermissionError";
  }
}

/**
 * Artifact not found error
 */
export class ArtifactNotFoundError extends StorageError {
  constructor(sessionId: string, artifactId: string) {
    super(
      "ARTIFACT_NOT_FOUND",
      `Artifact not found: ${sessionId}/${artifactId}`,
    );
    this.name = "ArtifactNotFoundError";
  }
}

/**
 * Invalid session ID error
 */
export class InvalidSessionIdError extends StorageError {
  constructor(sessionId: string) {
    super("INVALID_SESSION_ID", `Invalid session ID format: ${sessionId}`);
    this.name = "InvalidSessionIdError";
  }
}

/**
 * Invalid artifact ID error
 */
export class InvalidArtifactIdError extends StorageError {
  constructor(artifactId: string) {
    super("INVALID_ARTIFACT_ID", `Invalid artifact ID format: ${artifactId}`);
    this.name = "InvalidArtifactIdError";
  }
}

/**
 * S3 operation error
 */
export class S3Error extends StorageError {
  constructor(message: string) {
    super("S3_ERROR", message);
    this.name = "S3Error";
  }
}

/**
 * Storage unavailable error
 */
export class StorageUnavailableError extends StorageError {
  constructor(message: string) {
    super("STORAGE_UNAVAILABLE", message);
    this.name = "StorageUnavailableError";
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends StorageError {
  constructor(message: string) {
    super("CONFIGURATION_ERROR", message);
    this.name = "ConfigurationError";
  }
}
