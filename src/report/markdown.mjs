// Report: analysis data -> canonical markdown.
//
// buildMarkdown(analysis, { job, plan, diff, emu, auth, outVideo, ... }) -> string
//
// The single source report: metadata, step-by-step script, baseline comparison,
// axe violations per viewport, layout/responsive tables, WCAG-strict checks,
// screenshots list, heading outline, keyboard-order table, and the Limitations
// section. The PDF renderer consumes this same string, so there is one report body.
//
// Auth values are NEVER included — counts only (hard invariant).
// Pure function: no browser, no file writes (caller decides whether to persist .md).

// TODO(port): move the "reports" markdown assembly (the md.push(...) block) here.

export function buildMarkdown(/* analysis, ctx */) {
  throw new Error("not implemented — scaffold");
}
