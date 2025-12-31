import { describe, expect, it } from "vitest";
import { healthcheckTool } from "../../src/tools/healthcheck.js";

describe("healthcheck tool", () => {
  describe("basic behavior", () => {
    it("returns ok=true and status='healthy' when invoked with no params", async () => {
      const result = await healthcheckTool.handler({});

      expect(result.ok).toBe(true);
      expect(result.status).toBe("healthy");
    });

    it("returns valid semver version string in response", async () => {
      const result = await healthcheckTool.handler({});

      // Semver pattern: major.minor.patch with optional prerelease/build metadata
      const semverPattern = /^\d+\.\d+\.\d+.*$/;
      expect(result.version).toMatch(semverPattern);
    });

    it("returns valid ISO 8601 timestamp in response", async () => {
      const result = await healthcheckTool.handler({});

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(result.timestamp).toMatch(isoPattern);

      // Verify it's a valid date
      const date = new Date(result.timestamp);
      expect(date.toISOString()).toBe(result.timestamp);
    });
  });

  describe("echo functionality", () => {
    it("echoes exact value when echo parameter provided", async () => {
      const result = await healthcheckTool.handler({ echo: "hello world" });

      expect(result.echo).toBe("hello world");
    });

    it("omits echo field when no echo parameter provided", async () => {
      const result = await healthcheckTool.handler({});

      expect(result).not.toHaveProperty("echo");
    });

    it("handles empty string echo correctly", async () => {
      const result = await healthcheckTool.handler({ echo: "" });

      expect(result.echo).toBe("");
    });

    it("preserves special characters in echo value", async () => {
      const specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~\n\t\\";
      const result = await healthcheckTool.handler({ echo: specialChars });

      expect(result.echo).toBe(specialChars);
    });
  });

  describe("performance", () => {
    it("responds within 100ms (per SC-002)", async () => {
      const start = performance.now();
      await healthcheckTool.handler({});
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });
});
