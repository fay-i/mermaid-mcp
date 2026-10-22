/**
 * B008: Twenty clients that connect, list tools and disconnect one after
 * another all succeed against the same running server.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALL_TOOL_NAMES,
  connectClient,
  startTestServer,
  type TestServer,
} from "./helpers.js";

describe("sequential clients", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("serves twenty clients in a row", async () => {
    const sessionIds = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const { client, transport, sessionId } = await connectClient(server.url);
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual(ALL_TOOL_NAMES);
      sessionIds.add(sessionId);
      await transport.terminateSession();
      await client.close();
    }

    expect(sessionIds.size).toBe(20);
    const health = await fetch(
      `http://127.0.0.1:${server.running.port}/health`,
    );
    expect(health.status).toBe(200);
  });
});
