// Browser lifecycle for integration tests only. Drives the installed Edge/Chrome
// via playwright-core (no download). launchBrowser() returns null when neither is
// available so suites can self-skip instead of failing on a browserless machine.
import { chromium } from "playwright-core";

export const VIEWPORTS = [
  { label: "Desktop", w: 1280, h: 900 },
  { label: "Tablet", w: 820, h: 1080 },
  { label: "Phone", w: 375, h: 812 },
];

export async function launchBrowser() {
  for (const channel of ["msedge", "chrome"]) {
    try { return await chromium.launch({ channel }); } catch {}
  }
  return null;
}

export async function openFixture(browser, fileUrl) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(fileUrl, { waitUntil: "load" });
  return page;
}
