/**
 * B019: Clients still configured for the removed SSE transport get a clear
 * 410 refusal naming the new transport and path; the server keeps serving.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  connectClient,
  postInitialize,
  startTestServer,
  type TestServer,
} from "./helpers.js";

describe("refusing old SSE clients", () => {
  let server: TestServer;
  let base: string;

  beforeEach(async () => {
    server = await startTestServer();
    base = `http://127.0.0.1:${server.running.port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it.each([
    ["GET", "/sse"],
    ["POST", "/message?sessionId=x"],
  ])("answers %s %s with 410 and a hint", async (method, path) => {
    const response = await fetch(`${base}${path}`, { method });

    expect(response.status).toBe(410);
    const body = await response.text();
    expect(body).toContain("--transport http");
    expect(body).toContain(`${base}/mcp`);

    expect((await postInitialize(server.running.port)).status).toBe(200);
  });

  it("answers any other unknown path with 404", async () => {
    const response = await fetch(`${base}/nope`);
    expect(response.status).toBe(404);
  });

  it("makes an SSE-transport client fail while HTTP clients still connect", async () => {
    const legacy = new Client({ name: "legacy", version: "1.0.0" });
    await expect(
      legacy.connect(new SSEClientTransport(new URL(`${base}/sse`))),
    ).rejects.toThrow();

    const { client } = await connectClient(server.url);
    await expect(client.listTools()).resolves.toBeDefined();
    await client.close();
  });
});
