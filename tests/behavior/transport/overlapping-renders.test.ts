/**
 * B012: Two clients starting renders of different diagrams at the same
 * moment each receive their own diagram, never the other's.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  callTool,
  connectClient,
  startTestServer,
  type TestServer,
} from "./helpers.js";

async function renderedSvg(result: Record<string, unknown>): Promise<string> {
  expect(result.ok).toBe(true);
  return readFile(fileURLToPath(String(result.download_url)), "utf8");
}

describe("overlapping renders", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("returns each client its own diagram", async () => {
    const a = await connectClient(server.url);
    const b = await connectClient(server.url);

    for (let round = 0; round < 3; round++) {
      const [aResult, bResult] = await Promise.all([
        callTool(a.client, "mermaid_to_svg", {
          code: `graph TD; AlphaStart${round}-->AlphaEnd${round}`,
        }),
        callTool(b.client, "mermaid_to_svg", {
          code: `graph TD; BravoStart${round}-->BravoEnd${round}`,
        }),
      ]);

      const aSvg = await renderedSvg(aResult);
      const bSvg = await renderedSvg(bResult);
      expect(aSvg).toContain(`AlphaStart${round}`);
      expect(aSvg).not.toContain("Bravo");
      expect(bSvg).toContain(`BravoStart${round}`);
      expect(bSvg).not.toContain("Alpha");
    }

    await a.client.close();
    await b.client.close();
  }, 120_000);
});
