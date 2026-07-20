// Browser lifecycle + setup steps for the audit engine.
//
// Drives the installed Edge/Chrome via playwright-core (channel msedge, then chrome).
// No browser download. This is the production launcher; the test helper is separate.
import { chromium } from "playwright-core";

// Launch the installed Edge (preferred) or Chrome, falling back to Playwright's
// bundled Chromium (e.g. CI or a machine without Edge/Chrome, once
// `npx playwright install chromium` has run). Throws with the real cause if none work.
// `headless` defaults to Playwright's default; pass false for headed (e.g. NVDA).
export async function launchBrowser({ headless } = {}) {
  let lastErr;
  for (const channel of ["msedge", "chrome"]) {
    try { return await chromium.launch({ channel, headless }); } catch (e) { lastErr = e; }
  }
  try { return await chromium.launch({ headless }); } catch (e) { lastErr = e; }
  throw new Error(`Could not launch a browser (tried Edge, Chrome, bundled Chromium): ${lastErr?.message || "unknown error"}`);
}

// Apply config setup steps to put the page into the state to audit. One action key per
// step (click / fill / select / focus / press) plus optional wait. A failing step is
// logged and skipped — it never aborts the audit.
export async function applySteps(page, steps) {
  for (const s of steps || []) {
    try {
      if (s.click) await page.click(s.click, { timeout: 5000 });
      else if (s.fill) await page.fill(s.fill, s.value ?? "", { timeout: 5000 });
      else if (s.select) await page.selectOption(s.select, s.value ?? "", { timeout: 5000 });
      else if (s.focus) await page.focus(s.focus, { timeout: 5000 });
      else if (s.press) await page.keyboard.press(s.press);
      if (s.wait) await page.waitForTimeout(s.wait);
    } catch (e) { console.error(`  setup step failed ${JSON.stringify(s)}: ${e.message}`); }
  }
  if (steps?.length) await page.waitForTimeout(400);
}
