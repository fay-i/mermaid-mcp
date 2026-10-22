/**
 * B014: Every artifact a client renders during one connection is stored
 * under that connection's session ID.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  sessionOfArtifact,
  startTestServer,
  TOOL_CALLS,
  type TestServer,
} from "./helpers.js";

describe("artifact grouping per connection", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("stores the SVG, PDF and deck under the client's session", async () => {
    const { client, sessionId } = await connectClient(server.url);
    const renders = TOOL_CALLS.filter(({ name }) => name !== "healthcheck");

    for (const { name, args } of renders) {
      const result = await callTool(client, name, args);
      expect(result.ok, name).toBe(true);
      expect(sessionOfArtifact(server.dataDir, result), name).toBe(sessionId);
    }

    await client.close();
  }, 120_000);
});
