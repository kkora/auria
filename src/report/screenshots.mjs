// Report: annotated full-page screenshots.
//
// captureScreenshots(page, analysis, { viewports, outDir, name }) -> screenshot[]
//   One full-page PNG per viewport with every known offender (axe nodes + layout
//   findings) outlined in red, then the outline styling is removed again. Evidence
//   droppable straight into bug tickets. Opt-in (--screenshots).
//
// Uses a browser page for capture.

// TODO(port): move the "Annotated screenshots" block here.

export async function captureScreenshots(/* page, analysis, ctx */) {
  throw new Error("not implemented — scaffold");
}
