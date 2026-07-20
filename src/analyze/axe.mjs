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
  const contrastByTarget = new Map(); // deduped across viewports; keeps the worst ratio seen
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
      // Pull the measured ratios out of the color-contrast rule (axe attaches them to the
      // check's `data`), so the report can summarize contrast beyond a bare violation count.
      for (const n of res.violations.find(v => v.id === "color-contrast")?.nodes || []) {
        const d = [...(n.any || []), ...(n.all || []), ...(n.none || [])].find(c => c.data && c.data.contrastRatio != null)?.data;
        if (!d) continue;
        const target = n.target.join(" ");
        // axe gives contrastRatio as a number but expectedContrastRatio as "4.5:1" — normalize.
        const row = { target, ratio: d.contrastRatio, required: parseFloat(d.expectedContrastRatio),
          fg: d.fgColor, bg: d.bgColor, fontSize: d.fontSize, fontWeight: d.fontWeight };
        const prev = contrastByTarget.get(target);
        if (!prev || row.ratio < prev.ratio) contrastByTarget.set(target, row); // keep the worst
      }
    } catch (e) {
      byViewport[vp.label] = [{ id: "scan-failed", impact: "unknown", help: `axe could not run (likely CSP): ${e.message}`, wcag: [], nodes: [] }];
    }
  }
  return { byViewport, passedSc: [...passedSc], contrast: [...contrastByTarget.values()] };
}

// Pure: summarize the color-contrast rows (WCAG 1.4.3). Returns null when there were no
// contrast failures, else the count, the worst measured ratio, a normal/large-text split
// (normal text needs 4.5:1, large or bold text 3:1), and the worst offenders for the report.
export function contrastSummary(contrast = []) {
  if (!contrast.length) return null;
  const sorted = [...contrast].sort((a, b) => a.ratio - b.ratio);
  const normalText = contrast.filter(c => (c.required || 0) >= 4.5).length;
  return {
    count: contrast.length,
    worstRatio: sorted[0].ratio,
    normalText,                          // failures held to the 4.5:1 threshold
    largeText: contrast.length - normalText, // failures at the 3:1 (large/bold) threshold
    worst: sorted.slice(0, 8),
  };
}
