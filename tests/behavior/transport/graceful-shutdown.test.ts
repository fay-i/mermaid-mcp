/**
 * B022: On SIGTERM the HTTP server closes its sessions and exits 0 promptly,
 * so pod rollouts and compose stops never hang or report a crash.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectClient } from "./helpers.js";

describe("graceful shutdown", () => {
  let dataDir: string;
  let child: ChildProcess;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "mermaid-mcp-shutdown-"));
  });

  afterEach(async () => {
    child.kill("SIGKILL");
    await rm(dataDir, { recursive: true, force: true });
  });

  it("exits 0 within a few seconds of SIGTERM with sessions open", async () => {
    let stderr = "";
    child = spawn("node", ["dist/index.js", "--http=0", dataDir], {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: process.cwd(),
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const port = await new Promise<number>((resolve, reject) => {
      const timer = setInterval(() => {
        const match = stderr.match(/listening on .*:(\d+)/);
        if (match) {
          clearInterval(timer);
          resolve(Number(match[1]));
        }
      }, 50);
      setTimeout(() => reject(new Error(`no listen log: ${stderr}`)), 10_000);
    });

    const url = new URL(`http://127.0.0.1:${port}/mcp`);
    const a = await connectClient(url);
    const b = await connectClient(url);
    await a.client.listTools();
    await b.client.listTools();

    const exited = new Promise<{ code: number | null; signal: string | null }>(
      (resolve) =>
        child.on("exit", (code, signal) => resolve({ code, signal })),
    );
    const startedAt = Date.now();
    child.kill("SIGTERM");
    const { code, signal } = await exited;

    expect({ code, signal }).toEqual({ code: 0, signal: null });
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    await a.client.close().catch(() => undefined);
    await b.client.close().catch(() => undefined);
  }, 30_000);
});
