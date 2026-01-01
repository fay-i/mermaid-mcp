/**
 * Puppeteer browser lifecycle management for Mermaid rendering.
 */

import puppeteer, { type Browser } from "puppeteer";

/**
 * Launch a headless browser instance for Mermaid rendering.
 * Uses 'shell' mode for faster startup.
 * Disables sandbox in CI environments where it's not available.
 */
export async function launchBrowser(): Promise<Browser> {
  const args: string[] = [];

  // Disable sandbox in CI environments (GitHub Actions, etc.)
  if (process.env.CI) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  return puppeteer.launch({
    headless: "shell",
    args: args.length > 0 ? args : undefined,
  });
}

/**
 * Gracefully close a browser instance.
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}
