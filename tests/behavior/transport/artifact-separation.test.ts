/**
 * B015: Two clients rendering concurrently never store artifacts under
 * each other's session.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  sessionOfArtifact,
  startTestServer,
  TOOL_CALLS,
  type TestClient,
  type TestServer,
} from "./helpers.js";

const RENDERS = TOOL_CALLS.filter(({ name }) => name !== "healthcheck");

async function sessionsUsedBy(
  server: TestServer,
  session: TestClient,
): Promise<Set<string>> {
  const results: Record<string, unknown>[] = [];
  for (const { name, args } of RENDERS) {
    results.push(await callTool(session.client, name, args));
  }
  return new Set(
    results.map((result) => sessionOfArtifact(server.dataDir, result)),
  );
}

describe("artifact separation between clients", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("keeps each client's artifacts under its own session only", async () => {
    const a = await connectClient(server.url);
    const b = await connectClient(server.url);

    const [aSessions, bSessions] = await Promise.all([
      sessionsUsedBy(server, a),
      sessionsUsedBy(server, b),
    ]);

    expect([...aSessions]).toEqual([a.sessionId]);
    expect([...bSessions]).toEqual([b.sessionId]);
    expect(a.sessionId).not.toBe(b.sessionId);

    await a.client.close();
    await b.client.close();
  }, 180_000);
});
