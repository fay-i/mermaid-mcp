/**
 * B021: Many handshakes arriving at once all succeed, and a connection that
 * never sends a request does not block anyone else.
 */

import { connect, type Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALL_TOOL_NAMES,
  connectClient,
  startTestServer,
  type TestServer,
  UUID_PATTERN,
} from "./helpers.js";

describe("connection bursts", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("gives 25 concurrent handshakes distinct working sessions", async () => {
    const clients = await Promise.all(
      Array.from({ length: 25 }, () => connectClient(server.url)),
    );

    const ids = new Set(clients.map((session) => session.sessionId));
    expect(ids.size).toBe(25);
    for (const id of ids) expect(id).toMatch(UUID_PATTERN);

    const listings = await Promise.all(
      clients.map((session) => session.client.listTools()),
    );
    for (const { tools } of listings) {
      expect(tools.map((tool) => tool.name).sort()).toEqual(ALL_TOOL_NAMES);
    }

    await Promise.all(clients.map((session) => session.client.close()));
  }, 60_000);

  it("serves a real client while a silent socket stays open", async () => {
    const silent: Socket = await new Promise((resolve) => {
      const socket = connect(server.running.port, "127.0.0.1", () =>
        resolve(socket),
      );
    });

    const { client } = await connectClient(server.url);
    await expect(client.listTools()).resolves.toBeDefined();

    await client.close();
    silent.destroy();
  });
});
