// Analyzer: axe-core scan.
//
// runAxe(page, viewports) -> { [viewportLabel]: violation[] }
// Runs axe at the widest and narrowest audited viewports. Each violation is
// reduced to { id, impact, help, wcag[], nodes[] }. A CSP that blocks the scan is
// reported as a single "scan-failed" pseudo-violation, never a throw.
//
// Pure inspector: takes a Playwright page, returns data. No file writes.

// TODO(port): move the axe injection + evaluate block from the monolith's
// "phase A: analyze" here. axe.min.js is read from node_modules/axe-core.

export async function runAxe(/* page, viewports */) {
  throw new Error("not implemented — scaffold");
}
