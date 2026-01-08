/**
 * Shared validation utilities for storage backends
 */

import { InvalidArtifactIdError, InvalidSessionIdError } from "./errors.js";

/**
 * UUID validation regex (RFC 4122)
 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates UUID format to prevent path traversal attacks
 * @throws InvalidSessionIdError if fieldName is "sessionId" and validation fails
 * @throws InvalidArtifactIdError if fieldName is "artifactId" and validation fails
 */
export function validateUUID(id: string, fieldName: string): void {
  if (!UUID_REGEX.test(id)) {
    if (fieldName === "sessionId") {
      throw new InvalidSessionIdError(id);
    }
    throw new InvalidArtifactIdError(id);
  }
}
