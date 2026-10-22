/**
 * B016: Concurrent clients' artifacts are stored by whichever storage mode
 * is configured, and each returned URL resolves to the rendered file.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { S3StorageBackend } from "../../../src/storage/s3-backend.js";
import {
  callTool,
  connectClient,
  startTestServer,
  type TestClient,
  type TestServer,
} from "./helpers.js";
import {
  startFakeObjectStore,
  type FakeObjectStore,
} from "./fake-object-store.js";

function renderSvg(session: TestClient, label: string) {
  return callTool(session.client, "mermaid_to_svg", {
    code: `graph TD; ${label}-->Done`,
  });
}

describe("storage modes under concurrent clients", () => {
  let server: TestServer;
  let objectStore: FakeObjectStore | undefined;

  afterEach(async () => {
    await server.stop();
    await objectStore?.close();
    objectStore = undefined;
    vi.restoreAllMocks();
  });

  it("local storage: each file:// URL holds that client's rendered bytes", async () => {
    server = await startTestServer();
    const a = await connectClient(server.url);
    const b = await connectClient(server.url);

    const [aResult, bResult] = await Promise.all([
      renderSvg(a, "LocalAlpha"),
      renderSvg(b, "LocalBravo"),
    ]);

    expect(
      await readFile(fileURLToPath(String(aResult.download_url)), "utf8"),
    ).toContain("LocalAlpha");
    expect(
      await readFile(fileURLToPath(String(bResult.download_url)), "utf8"),
    ).toContain("LocalBravo");

    await a.client.close();
    await b.client.close();
  }, 60_000);

  it("S3 storage: each object sits under its client's session and its URL resolves", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    objectStore = await startFakeObjectStore();
    server = await startTestServer({
      storage: new S3StorageBackend({
        endpoint: objectStore.endpoint,
        bucket: "mermaid",
        region: "us-east-1",
        accessKeyId: "test",
        secretAccessKey: "test",
        presignedUrlExpiry: 3600,
      }),
    });
    const a = await connectClient(server.url);
    const b = await connectClient(server.url);

    const [aResult, bResult] = await Promise.all([
      renderSvg(a, "CloudAlpha"),
      renderSvg(b, "CloudBravo"),
    ]);

    for (const [session, result, label] of [
      [a, aResult, "CloudAlpha"],
      [b, bResult, "CloudBravo"],
    ] as const) {
      expect(result.ok, JSON.stringify(result)).toBe(true);
      const key = `/mermaid/${session.sessionId}/${result.artifact_id}.svg`;
      expect(objectStore.objects.has(key), key).toBe(true);
      const fetched = await fetch(String(result.download_url));
      expect(fetched.status).toBe(200);
      expect(await fetched.text()).toContain(label);
    }

    await a.client.close();
    await b.client.close();
  }, 60_000);
});
