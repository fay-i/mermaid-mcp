/**
 * Behavior tests for CDN Proxy router (User Story 3).
 * Tests: T060
 *
 * These tests verify the routing logic for both S3 and local storage path patterns.
 */

import { describe, expect, it } from "vitest";
import { parseRoute } from "../../../src/cdn-proxy/router.js";

describe("parseRoute", () => {
  describe("health endpoint", () => {
    it("should route /health to health endpoint", () => {
      const result = parseRoute("/health");
      expect(result.type).toBe("health");
    });
  });

  describe("S3 artifact paths (legacy format)", () => {
    it("should parse S3 format: /artifacts/{uuid}.svg", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parseRoute(`/artifacts/${uuid}.svg`);

      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.artifactId).toBe(uuid.toLowerCase());
        expect(result.artifact.extension).toBe("svg");
        expect(result.artifact.sessionId).toBeUndefined();
      }
    });

    it("should parse S3 format: /artifacts/{uuid}.pdf", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parseRoute(`/artifacts/${uuid}.pdf`);

      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.artifactId).toBe(uuid.toLowerCase());
        expect(result.artifact.extension).toBe("pdf");
        expect(result.artifact.sessionId).toBeUndefined();
      }
    });

    it("should handle uppercase UUIDs in S3 format", () => {
      const uuid = "550E8400-E29B-41D4-A716-446655440000";
      const result = parseRoute(`/artifacts/${uuid}.svg`);

      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.artifactId).toBe(uuid.toLowerCase());
        expect(result.artifact.extension).toBe("svg");
      }
    });
  });

  describe("local storage artifact paths (session-based format)", () => {
    it("should parse local format: /artifacts/{session}/{uuid}.svg", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const artifactId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
      const result = parseRoute(`/artifacts/${sessionId}/${artifactId}.svg`);

      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.sessionId).toBe(sessionId.toLowerCase());
        expect(result.artifact.artifactId).toBe(artifactId.toLowerCase());
        expect(result.artifact.extension).toBe("svg");
      }
    });

    it("should parse local format: /artifacts/{session}/{uuid}.pdf", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const artifactId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
      const result = parseRoute(`/artifacts/${sessionId}/${artifactId}.pdf`);

      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.sessionId).toBe(sessionId.toLowerCase());
        expect(result.artifact.artifactId).toBe(artifactId.toLowerCase());
        expect(result.artifact.extension).toBe("pdf");
      }
    });

    it("should handle uppercase UUIDs in local format", () => {
      const sessionId = "550E8400-E29B-41D4-A716-446655440000";
      const artifactId = "6BA7B810-9DAD-11D1-80B4-00C04FD430C8";
      const result = parseRoute(`/artifacts/${sessionId}/${artifactId}.svg`);

      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        expect(result.artifact.sessionId).toBe(sessionId.toLowerCase());
        expect(result.artifact.artifactId).toBe(artifactId.toLowerCase());
        expect(result.artifact.extension).toBe("svg");
      }
    });
  });

  describe("invalid paths", () => {
    it("should return invalid_path for malformed S3 path", () => {
      const result = parseRoute("/artifacts/invalid-uuid.svg");
      expect(result.type).toBe("invalid_path");
    });

    it("should return invalid_path for malformed local path", () => {
      const result = parseRoute("/artifacts/invalid-session/invalid-uuid.svg");
      expect(result.type).toBe("invalid_path");
    });

    it("should return invalid_path for path with wrong number of segments", () => {
      const result = parseRoute("/artifacts/too/many/segments.svg");
      expect(result.type).toBe("invalid_path");
    });

    it("should return invalid_path for unsupported extension", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parseRoute(`/artifacts/${uuid}.png`);
      expect(result.type).toBe("invalid_path");
    });

    it("should return invalid_path for path starting with /artifacts/ but invalid", () => {
      const result = parseRoute("/artifacts/not-a-valid-path");
      expect(result.type).toBe("invalid_path");
    });
  });

  describe("not found paths", () => {
    it("should return not_found for unknown paths", () => {
      const result = parseRoute("/unknown/path");
      expect(result.type).toBe("not_found");
    });

    it("should return not_found for root path", () => {
      const result = parseRoute("/");
      expect(result.type).toBe("not_found");
    });

    it("should return not_found for paths not starting with /artifacts/", () => {
      const result = parseRoute("/api/v1/artifacts");
      expect(result.type).toBe("not_found");
    });
  });

  describe("path precedence", () => {
    it("should prefer local format over S3 format when both match", () => {
      // This shouldn't happen in practice, but test the regex precedence
      // Local format: /artifacts/{session}/{uuid}.{ext}
      // S3 format: /artifacts/{uuid}.{ext}
      // If a path matches local format, it should be parsed as local
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const artifactId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
      const result = parseRoute(`/artifacts/${sessionId}/${artifactId}.svg`);

      expect(result.type).toBe("artifact");
      if (result.type === "artifact") {
        // Should be parsed as local format (with sessionId)
        expect(result.artifact.sessionId).toBe(sessionId.toLowerCase());
        expect(result.artifact.artifactId).toBe(artifactId.toLowerCase());
      }
    });
  });
});
