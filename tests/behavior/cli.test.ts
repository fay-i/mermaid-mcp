/**
 * Unit tests for CLI argument parsing.
 */

import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseArgs } from "../../src/index.js";

describe("parseArgs", () => {
  const originalEnv = process.env;
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });
  const mockConsoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockExit.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("data directory argument", () => {
    it("accepts absolute path", () => {
      const result = parseArgs(["node", "index.js", "/tmp/artifacts"]);
      expect(result.dataDir).toBe("/tmp/artifacts");
    });

    it("resolves relative path to absolute", () => {
      const result = parseArgs(["node", "index.js", "./data/artifacts"]);
      expect(result.dataDir).toBe(resolve("./data/artifacts"));
    });

    it("resolves path with tilde expansion handled by shell", () => {
      // Note: ~ expansion is done by shell, not by Node
      const result = parseArgs(["node", "index.js", "/home/user/artifacts"]);
      expect(result.dataDir).toBe("/home/user/artifacts");
    });
  });

  describe("missing data directory", () => {
    it("exits with error when no arguments provided", () => {
      expect(() => parseArgs(["node", "index.js"])).toThrow(
        "process.exit called",
      );
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error: data directory argument is required.\n",
      );
    });

    it("allows missing data dir in S3 mode", () => {
      process.env.STORAGE_TYPE = "s3";
      const result = parseArgs(["node", "index.js"]);
      expect(result.dataDir).toBeUndefined();
    });
  });

  describe("--help flag", () => {
    it("shows help and exits with code 0", () => {
      expect(() => parseArgs(["node", "index.js", "--help"])).toThrow(
        "process.exit called",
      );
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Usage: mermaid-mcp <data-dir>"),
      );
    });

    it("supports -h shorthand", () => {
      expect(() => parseArgs(["node", "index.js", "-h"])).toThrow(
        "process.exit called",
      );
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("help text includes examples", () => {
      expect(() => parseArgs(["node", "index.js", "--help"])).toThrow();
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Examples:"),
      );
    });

    it("help text includes S3 environment variables", () => {
      expect(() => parseArgs(["node", "index.js", "--help"])).toThrow();
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("STORAGE_TYPE=s3"),
      );
    });
  });

  describe("--version flag", () => {
    it("shows version and exits with code 0", () => {
      expect(() => parseArgs(["node", "index.js", "--version"])).toThrow(
        "process.exit called",
      );
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/mermaid-mcp v\d+\.\d+\.\d+/),
      );
    });

    it("supports -v shorthand", () => {
      expect(() => parseArgs(["node", "index.js", "-v"])).toThrow(
        "process.exit called",
      );
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe("flag precedence", () => {
    it("--help takes precedence over data dir", () => {
      expect(() =>
        parseArgs(["node", "index.js", "/tmp/data", "--help"]),
      ).toThrow("process.exit called");
      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Usage:"),
      );
    });

    it("--version takes precedence over data dir", () => {
      expect(() =>
        parseArgs(["node", "index.js", "/tmp/data", "--version"]),
      ).toThrow("process.exit called");
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });
});
