// Analyzer: axe-core scan.
//
// runAxe(page, viewports, { passes }) -> { byViewport: { [label]: violation[] }, passedSc }
// Runs axe at the widest and narrowest audited viewport. Each violation is reduced to
// { id, impact, help, wcag[], nodes[] }. A CSP that blocks the scan is reported as a
// single "scan-failed" pseudo-violation, never a throw.
//
// With { passes: true } it also collects the WCAG success criteria axe TESTED AND PASSED
// (`passedSc`, e.g. "1.4.3") — used by the VPAT generator to mark those criteria
// "Supports". This is opt-in because requesting axe's full pass set is heavier; a normal
// audit only needs violations, so passedSc is empty by default.
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

// "wcag143" -> "1.4.3"; ignores non-SC tags (wcag2a, best-practice, etc.).
const scFromTag = tag => {
  const m = /^wcag(\d)(\d)(\d+)$/.exec(tag);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
};

export async function runAxe(page, viewports, { passes = false } = {}) {
  const axeSource = await loadAxeSource();
  const byViewport = {};
  const passedSc = new Set();
  const resultTypes = passes ? ["violations", "passes"] : ["violations"];
  for (const vp of [viewports[0], viewports[viewports.length - 1]]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(400);
    try {
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async types => await axe.run(document, { resultTypes: types }), resultTypes);
      byViewport[vp.label] = res.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help,
        wcag: v.tags.filter(t => /^wcag\d/.test(t)),
        nodes: v.nodes.map(n => n.target.join(" ")).slice(0, 10),
      }));
      for (const p of res.passes || []) for (const t of p.tags || []) { const sc = scFromTag(t); if (sc) passedSc.add(sc); }
    } catch (e) {
      byViewport[vp.label] = [{ id: "scan-failed", impact: "unknown", help: `axe could not run (likely CSP): ${e.message}`, wcag: [], nodes: [] }];
    }
  }
  return { byViewport, passedSc: [...passedSc] };
}
