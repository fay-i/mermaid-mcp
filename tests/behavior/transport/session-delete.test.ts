/**
 * B006: A client DELETE ends its session; later requests with that ID are refused.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  connectClient,
  postInSession,
  startTestServer,
  type TestServer,
} from "./helpers.js";

describe("ending a session with DELETE", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("refuses the closed session's ID with 404", async () => {
    const { client, transport, sessionId } = await connectClient(server.url);
    const before = await postInSession(server.running.port, sessionId);
    expect(before.status).toBe(200);

    await transport.terminateSession();
    await client.close();

    const after = await postInSession(server.running.port, sessionId);
    expect(after.status).toBe(404);
  });

  it("answers the DELETE with a success status", async () => {
    const { client, sessionId } = await connectClient(server.url);
    const response = await fetch(server.url, {
      method: "DELETE",
      headers: {
        "mcp-session-id": sessionId,
        "mcp-protocol-version": "2025-06-18",
      },
    });
    expect(response.ok).toBe(true);
    await client.close();
  });
});
