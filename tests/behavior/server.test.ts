import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("MCP Server", () => {
  it("starts without crashing", async () => {
    const serverProcess = spawn("node", ["dist/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    // Give the server a moment to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that the process is still running (not crashed)
    expect(serverProcess.exitCode).toBeNull();

    // Clean up
    serverProcess.kill();
  });

  it("responds to MCP initialize request", async () => {
    const serverProcess = spawn("node", ["dist/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

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
});
