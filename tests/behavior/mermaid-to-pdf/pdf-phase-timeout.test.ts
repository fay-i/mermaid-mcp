/**
 * The PDF phase's timeout covers page setup as well as printing. A slow or
 * hung setContent must end in RENDER_TIMEOUT within budget and must never
 * escape as an unhandled rejection, which would crash a long-lived server.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const page = {
  setContent: vi.fn<() => Promise<void>>(),
  pdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  close: vi.fn(async () => {}),
};

vi.mock("../../../src/renderer/index.js", () => ({
  launchBrowser: vi.fn(async () => ({ newPage: async () => page })),
  closeBrowser: vi.fn(async () => {}),
  render: vi.fn(async () => ({
    svg: '<svg width="10" height="10"></svg>',
    width: 10,
    height: 10,
  })),
}));

const { mermaidToPdf } = await import("../../../src/tools/mermaid-to-pdf.js");

// timeout_ms 1000 gives the PDF phase a 200ms budget.
const INPUT = { code: "graph TD; A-->B", timeout_ms: 1000 };

describe("PDF phase timeout", () => {
  const unhandled: unknown[] = [];
  const recordUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    unhandled.length = 0;
    process.on("unhandledRejection", recordUnhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", recordUnhandled);
    vi.clearAllMocks();
  });

  it("times out without an unhandled rejection when setContent outlasts the budget", async () => {
    page.setContent.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );

    const result = await mermaidToPdf(INPUT);
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe("RENDER_TIMEOUT");
    expect(unhandled).toEqual([]);
  });

  it("times out within budget when setContent never settles", async () => {
    page.setContent.mockImplementation(() => new Promise(() => {}));

    const startedAt = Date.now();
    const result = await mermaidToPdf(INPUT);

    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe("RENDER_TIMEOUT");
    expect(unhandled).toEqual([]);
  });
});
