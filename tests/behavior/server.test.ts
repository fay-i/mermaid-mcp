import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("MCP Server", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("starts with data directory argument", async () => {
    const serverProcess = spawn("node", ["dist/index.js", tempDir], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    // Give the server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check that the process is still running (not crashed)
    expect(serverProcess.exitCode).toBeNull();

    // Clean up
    serverProcess.kill();
  });

  it("exits with error when data directory is missing", async () => {
    const serverProcess = spawn("node", ["dist/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      serverProcess.on("exit", (code) => resolve(code));
      // Fallback timeout in case process doesn't exit
      setTimeout(() => {
        serverProcess.kill();
        resolve(serverProcess.exitCode);
      }, 2000);
    });

    expect(exitCode).toBe(1);
  });

  it("shows help with --help flag", async () => {
    const serverProcess = spawn("node", ["dist/index.js", "--help"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stderr = "";
    serverProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      serverProcess.on("exit", (code) => resolve(code));
    });

    expect(exitCode).toBe(0);
    expect(stderr).toContain("Usage: mermaid-mcp <data-dir>");
    expect(stderr).toContain("Arguments:");
    expect(stderr).toContain("Examples:");
  });

  it("shows version with --version flag", async () => {
    const serverProcess = spawn("node", ["dist/index.js", "--version"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stderr = "";
    serverProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      serverProcess.on("exit", (code) => resolve(code));
    });

    expect(exitCode).toBe(0);
    expect(stderr).toMatch(/mermaid-mcp v\d+\.\d+\.\d+/);
  });

  it("responds to MCP initialize request", async () => {
    const serverProcess = spawn("node", ["dist/index.js", tempDir], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    // Wait for server to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));

    const initializeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    };

    // Send the initialize request
    serverProcess.stdin.write(`${JSON.stringify(initializeRequest)}\n`);

    // Collect response
    const response = await new Promise<string>((resolve, reject) => {
      let data = "";
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for response"));
      }, 5000);

      serverProcess.stdout.on("data", (chunk: Buffer) => {
        data += chunk.toString();
        if (data.includes("\n")) {
          clearTimeout(timeout);
          resolve(data.trim());
        }
      });

      serverProcess.stderr.on("data", (chunk: Buffer) => {
        // Expected: server logs storage initialization
        console.error("stderr:", chunk.toString());
      });
    });

    const parsed = JSON.parse(response);
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(1);
    expect(parsed.result).toBeDefined();
    expect(parsed.result.protocolVersion).toBeDefined();
    expect(parsed.result.serverInfo).toBeDefined();
    expect(parsed.result.serverInfo.name).toBe("mermaid-printer");

    // Clean up
    serverProcess.kill();
  });

  it("logs storage initialization to stderr", async () => {
    const serverProcess = spawn("node", ["dist/index.js", tempDir], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stderr = "";
    const logReceived = new Promise<void>((resolve) => {
      serverProcess.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        // Resolve when we see the expected log message
        if (stderr.includes("[mermaid-mcp] Storage backend enabled: local (")) {
          resolve();
        }
      });
    });

    // Wait for the log message (with timeout)
    await Promise.race([
      logReceived,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout waiting for stderr")), 2000),
      ),
    ]);

    // The log format is: "[mermaid-mcp] Storage backend enabled: local (/path/to/dir)"
    expect(stderr).toContain("[mermaid-mcp] Storage backend enabled: local (");
    expect(stderr).toContain(tempDir);

    // Clean up
    serverProcess.kill();
  });
});
