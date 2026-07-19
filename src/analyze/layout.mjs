// Analyzer: per-viewport layout / responsive checks.
//
// runLayout(page, viewports) -> { [label]: { overflowPx, overflowing[], smallTargets[], tinyText[] } }
// For each viewport: horizontal overflow (WCAG 1.4.10 Reflow), interactive targets
// smaller than 24px (WCAG 2.5.8), and text under 12px. SR-only (1x1) and
// display:none/visibility:hidden elements are excluded; results are deduped + capped.
//
// Also exposes readViewportMeta(page) for the <meta name="viewport"> check.
//
// Pure inspector: takes a Playwright page, returns data.

// TODO(port): move the "layout / responsive checks" evaluate block here.

export async function runLayout(/* page, viewports */) {
  throw new Error("not implemented — scaffold");
}
