/**
 * B011: Two clients connected at the same time each get working tools.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  startTestServer,
  TOOL_CALLS,
  type TestClient,
  type TestServer,
} from "./helpers.js";

function runAllTools(session: TestClient) {
  return Promise.all(
    TOOL_CALLS.map(({ name, args }) => callTool(session.client, name, args)),
  );
}

describe("concurrent clients", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("gives both clients a successful result for every tool", async () => {
    const lone = await connectClient(server.url);
    const loneResults = await runAllTools(lone);
    await lone.transport.terminateSession();

    const a = await connectClient(server.url);
    const b = await connectClient(server.url);
    const [aResults, bResults] = await Promise.all([
      runAllTools(a),
      runAllTools(b),
    ]);

    for (const results of [aResults, bResults]) {
      results.forEach((result, i) => {
        const { name } = TOOL_CALLS[i];
        expect(result.ok, `${name}: ${JSON.stringify(result)}`).toBe(true);
        expect(Object.keys(result).sort(), name).toEqual(
          Object.keys(loneResults[i]).sort(),
        );
      });
    }

    await a.client.close();
    await b.client.close();
  }, 180_000);
});
