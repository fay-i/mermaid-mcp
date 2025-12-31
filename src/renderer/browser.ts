/**
 * Puppeteer browser lifecycle management for Mermaid rendering.
 */

import puppeteer, { type Browser } from "puppeteer";

/**
 * Launch a headless browser instance for Mermaid rendering.
 * Uses 'shell' mode for faster startup.
 */
export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: "shell",
  });
}

/**
 * Gracefully close a browser instance.
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}
