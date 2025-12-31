/**
 * Determinism behavior tests for Mermaid renderer.
 * Verifies that the same input produces byte-identical output.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "puppeteer";
import {
  closeBrowser,
  launchBrowser,
  render,
} from "../../../src/renderer/index.js";

const FIXTURES_DIR = join(import.meta.dirname, "../../fixtures/mermaid");

describe("Renderer Determinism", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await closeBrowser(browser);
  });

  it("produces byte-identical SVG for the same input rendered twice", async () => {
    const flowchartCode = readFileSync(
      join(FIXTURES_DIR, "flowchart.mmd"),
      "utf-8",
    );

    const result1 = await render(browser, {
      code: flowchartCode,
      timeoutMs: 30000,
    });

    const result2 = await render(browser, {
      code: flowchartCode,
      timeoutMs: 30000,
    });

    expect(result1.svg).toBe(result2.svg);
    expect(result1.width).toBe(result2.width);
    expect(result1.height).toBe(result2.height);
  });

  it("produces valid SVG output", async () => {
    const flowchartCode = readFileSync(
      join(FIXTURES_DIR, "flowchart.mmd"),
      "utf-8",
    );

    const result = await render(browser, {
      code: flowchartCode,
      timeoutMs: 30000,
    });

    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});
