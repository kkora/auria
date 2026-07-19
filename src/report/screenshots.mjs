// Report: annotated full-page screenshots.
//
// captureScreenshots(page, analysis, { viewports, outDir, name }) -> screenshot[]
//   One full-page PNG per viewport with every known offender (axe nodes + layout
//   findings) outlined in red, then the outline styling is removed again. Evidence
//   droppable straight into bug tickets. Opt-in (--screenshots) — the caller gates it.
//
// Uses a browser page for capture; writes PNG files to outDir.
import path from "node:path";

export async function captureScreenshots(page, analysis, { viewports, outDir, name }) {
  const screenshots = [];
  const axeSelectors = Object.values(analysis.axe).flat().flatMap(v => v.nodes || []);
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(400);
    const L = analysis.layout[vp.label] || {};
    const selectors = [...new Set([
      ...axeSelectors,
      ...(L.overflowing || []).map(o => o.el),
      ...(L.smallTargets || []).map(s => s.el),
      ...(L.tinyText || []).map(t => t.el),
    ])];
    const marked = await page.evaluate(sels => {
      const style = document.createElement("style");
      style.id = "__audit_mark_style";
      style.textContent = ".__audit_mark{outline:3px solid #E4002B !important;outline-offset:2px !important}";
      document.head.appendChild(style);
      let n = 0;
      for (const s of sels) {
        try { document.querySelectorAll(s).forEach(el => { el.classList.add("__audit_mark"); n++; }); } catch {}
      }
      return n;
    }, selectors);
    const shotFile = `${name}-${vp.label.replace(/[^a-z0-9]+/gi, "-")}.png`;
    await page.screenshot({ path: path.join(outDir, shotFile), fullPage: true });
    await page.evaluate(() => {
      document.getElementById("__audit_mark_style")?.remove();
      document.querySelectorAll(".__audit_mark").forEach(el => el.classList.remove("__audit_mark"));
    });
    screenshots.push({ file: shotFile, viewport: vp.label, marked });
  }
  return screenshots;
}
