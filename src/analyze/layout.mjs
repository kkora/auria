// Analyzer: per-viewport layout / responsive checks.
//
// runLayout(page, viewports) -> { [label]: { overflowPx, overflowing[], smallTargets[], tinyText[] } }
// Per viewport: horizontal overflow (WCAG 1.4.10 Reflow), interactive targets under
// 24px (WCAG 2.5.8), text under 12px. SR-only (<=1x1) and display:none/visibility:hidden
// excluded; each list deduped by element and capped at 8.
//
// readViewportMeta(page) -> the <meta name="viewport"> content, or null.
//
// Pure inspector: takes a Playwright page, returns data. No file writes.

export async function readViewportMeta(page) {
  return page.evaluate(() =>
    document.querySelector('meta[name="viewport"]')?.getAttribute("content") || null);
}

export async function runLayout(page, viewports) {
  const layout = {};
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(500);
    layout[vp.label] = await page.evaluate(() => {
      const short = el => {
        const t = el.tagName.toLowerCase();
        if (el.id) return `${t}#${el.id}`;
        const c = [...el.classList][0];
        return c ? `${t}.${c}` : t;
      };
      const vw = document.documentElement.clientWidth;
      const overflowPx = Math.max(0, document.documentElement.scrollWidth - vw);
      const overflowing = [], smallTargets = [], tinyText = [];
      const els = [...document.querySelectorAll("body *")].slice(0, 4000);
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1) continue; // visually-hidden (SR-only) technique
        const st = getComputedStyle(el);
        if (st.visibility === "hidden" || st.display === "none") continue;
        if (r.right > vw + 1 || r.left < -1)
          overflowing.push({ el: short(el), px: Math.round(Math.max(r.right - vw, -r.left)) });
        if (el.matches("a,button,select,textarea,input:not([type=hidden]),[role=button],[role=link]")
            && (r.width < 24 || r.height < 24))
          smallTargets.push({ el: short(el), size: `${Math.round(r.width)}×${Math.round(r.height)}` });
        if (parseFloat(st.fontSize) < 12
            && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
          tinyText.push({ el: short(el), px: Math.round(parseFloat(st.fontSize)) });
      }
      const dedup = (arr, key) => [...new Map(arr.map(x => [x.el, x])).values()]
        .sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, 8);
      return {
        overflowPx,
        overflowing: dedup(overflowing, "px"),
        smallTargets: dedup(smallTargets, ""),
        tinyText: dedup(tinyText, ""),
      };
    });
  }
  return layout;
}
