// Browser lifecycle for integration tests only. Drives the installed Edge/Chrome,
// falling back to Playwright's bundled Chromium (so CI, after `playwright install
// chromium`, actually runs these suites). Returns null only when nothing launches, so
// suites self-skip instead of failing on a truly browserless machine.
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
  try { return await chromium.launch(); } catch {}   // bundled Chromium (CI)
  return null;
}

export async function openFixture(browser, fileUrl) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(fileUrl, { waitUntil: "load" });
  return page;
}
