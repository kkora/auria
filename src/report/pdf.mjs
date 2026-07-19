// Report: markdown -> print-styled A4 PDF.
//
// renderPdf(browser, markdown, outPath) -> void
//   Converts the canonical markdown (src/report/markdown.mjs) to HTML with a small
//   built-in markdown subset (headings, tables, lists, inline code/bold), applies a
//   print stylesheet, and prints A4 via Playwright's page.pdf. PDF is on by default;
//   a failure here logs a warning and never aborts the audit.
//
// Uses a browser page only for the PDF print step.

// TODO(port): move the "PDF (default on)" section here (esc/inline helpers + the
// html-from-markdown loop + page.pdf call).

export async function renderPdf(/* browser, markdown, outPath */) {
  throw new Error("not implemented — scaffold");
}
