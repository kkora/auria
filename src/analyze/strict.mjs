// Analyzer: strict WCAG passes.
//
// runStrict(page) -> { reflow320, zoom200 }
//   reflow320 : horizontal overflow (px) at exactly 320 CSS px  (WCAG 1.4.10, exact)
//   zoom200   : horizontal overflow (px) at document zoom 2x     (WCAG 1.4.4 approx)
//
// These are the spec-exact checks the looser per-viewport pass approximates.
//
// Pure inspector: takes a Playwright page, returns data.

// TODO(port): move the "WCAG-strict checks" block here.

export async function runStrict(/* page */) {
  throw new Error("not implemented — scaffold");
}
