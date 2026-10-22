/**
 * B004: An initialize request with no session ID opens a new session.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../../../src/index.js";
import {
  startHttpServer,
  type RunningHttpServer,
} from "../../../src/http-server.js";
import type { StorageBackend } from "../../../src/storage/index.js";
import { postInitialize, UUID_PATTERN } from "./helpers.js";

const unusedStorage = {} as StorageBackend;

describe("opening a session", () => {
  let running: RunningHttpServer;

  beforeEach(async () => {
    running = await startHttpServer({
      port: 0,
      createMcpServer: () => createServer(unusedStorage),
    });
  });

  afterEach(async () => {
    await running.close();
  });

  it("returns a successful initialize result with a UUID session ID", async () => {
    const response = await postInitialize(running.port);

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toMatch(UUID_PATTERN);
    const body = await response.text();
    expect(body).toContain('"serverInfo"');
    expect(body).toContain("mermaid-printer");
  });

  it("gives each handshake a different session ID", async () => {
    const first = await postInitialize(running.port);
    const second = await postInitialize(running.port);

    const firstId = first.headers.get("mcp-session-id");
    const secondId = second.headers.get("mcp-session-id");
    expect(firstId).toMatch(UUID_PATTERN);
    expect(secondId).toMatch(UUID_PATTERN);
    expect(firstId).not.toBe(secondId);
  });
});
