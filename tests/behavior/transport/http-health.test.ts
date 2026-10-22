/**
 * B003: With --http=<port>, the server listens on that port and answers GET /health.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  startHttpServer,
  type RunningHttpServer,
} from "../../../src/http-server.js";

describe("HTTP server health endpoint", () => {
  let running: RunningHttpServer;

  beforeEach(async () => {
    running = await startHttpServer({ port: 0 });
  });

  afterEach(async () => {
    await running.close();
  });

  it("answers GET /health with 200", async () => {
    const response = await fetch(`http://127.0.0.1:${running.port}/health`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  it("answers PUT /mcp with 405 and keeps serving", async () => {
    const response = await fetch(`http://127.0.0.1:${running.port}/mcp`, {
      method: "PUT",
    });
    expect(response.status).toBe(405);
    const health = await fetch(`http://127.0.0.1:${running.port}/health`);
    expect(health.status).toBe(200);
  });
});

describe("HTTP mode from the command line", () => {
  let dataDir: string;
  let child: ChildProcess | undefined;
  let blocker: Server | undefined;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-http-"));
  });

  afterEach(async () => {
    child?.kill();
    child = undefined;
    await new Promise<void>((resolve) =>
      blocker ? blocker.close(() => resolve()) : resolve(),
    );
    blocker = undefined;
    await rm(dataDir, { recursive: true, force: true });
  });

  function spawnServer(port: number): {
    process: ChildProcess;
    stderr: () => string;
  } {
    let stderr = "";
    const proc = spawn("node", ["dist/index.js", `--http=${port}`, dataDir], {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: process.cwd(),
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child = proc;
    return { process: proc, stderr: () => stderr };
  }

  async function waitFor<T>(probe: () => T | undefined): Promise<T> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const value = probe();
      if (value !== undefined) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("timed out waiting");
  }

  it("logs the bound port and serves /health there", async () => {
    const server = spawnServer(0);
    const port = await waitFor(() => {
      const match = server.stderr().match(/listening on .*:(\d+)/);
      return match ? Number(match[1]) : undefined;
    });

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
  });

  it("exits 1 naming the port when it is already in use", async () => {
    blocker = createServer();
    const busyPort = await new Promise<number>((resolve) => {
      blocker?.listen(0, () => {
        const address = blocker?.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });

    const server = spawnServer(busyPort);
    const exitCode = await new Promise<number | null>((resolve) => {
      server.process.on("exit", (code) => resolve(code));
    });

    expect(exitCode).toBe(1);
    expect(server.stderr()).toContain(String(busyPort));
  });
});
