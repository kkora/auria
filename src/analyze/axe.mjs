// Analyzer: axe-core scan.
//
// runAxe(page, viewports) -> { [viewportLabel]: violation[] }
// Runs axe at the widest and narrowest audited viewport. Each violation is reduced
// to { id, impact, help, wcag[], nodes[] }. A CSP that blocks the scan is reported as
// a single "scan-failed" pseudo-violation, never a throw.
//
// Pure inspector: takes a Playwright page, returns data. The bundled axe-core source
// is read once (memoized) — a dependency asset, not an artifact write.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

let axeSourcePromise = null;
function loadAxeSource() {
  if (!axeSourcePromise) {
    const require = createRequire(import.meta.url);
    axeSourcePromise = readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  }
  return axeSourcePromise;
}

export async function runAxe(page, viewports) {
  const axeSource = await loadAxeSource();
  const out = {};
  // axe at the widest and narrowest audited widths
  for (const vp of [viewports[0], viewports[viewports.length - 1]]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(400);
    try {
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async () => await axe.run(document, { resultTypes: ["violations"] }));
      out[vp.label] = res.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help,
        wcag: v.tags.filter(t => /^wcag\d/.test(t)),
        nodes: v.nodes.map(n => n.target.join(" ")).slice(0, 10),
      }));
    } catch (e) {
      out[vp.label] = [{ id: "scan-failed", impact: "unknown", help: `axe could not run (likely CSP): ${e.message}`, wcag: [], nodes: [] }];
    }
  }
  return out;
}
