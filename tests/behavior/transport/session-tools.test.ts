/**
 * B005: Requests carrying a known session ID reach that session's tools.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALL_TOOL_NAMES,
  callTool,
  connectClient,
  startTestServer,
  TOOL_CALLS,
  type TestClient,
  type TestServer,
  UUID_PATTERN,
} from "./helpers.js";

describe("serving tools within a session", () => {
  let server: TestServer;
  let session: TestClient;

  beforeEach(async () => {
    server = await startTestServer();
    session = await connectClient(server.url);
  });

  afterEach(async () => {
    await session.client.close();
    await server.stop();
  });

  it("completes the handshake with a UUID session", () => {
    expect(session.sessionId).toMatch(UUID_PATTERN);
  });

  it("lists all four tools", async () => {
    const { tools } = await session.client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(ALL_TOOL_NAMES);
  });

  it("succeeds on every tool call", async () => {
    for (const { name, args } of TOOL_CALLS) {
      const result = await callTool(session.client, name, args);
      expect(result.ok, `${name}: ${JSON.stringify(result)}`).toBe(true);
    }
  }, 120_000);
});
