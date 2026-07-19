// Analyzer: heading outline.
//
// readHeadings(page) -> [{ level, text }]  the visible h1-h6 outline in document order.
// Visually-hidden headings (offsetParent === null) are excluded; text is whitespace-
// normalized and capped at 80 chars. Feeds the report's heading section and the
// narration's "main heading / no h1" line.
//
// Pure inspector: takes a Playwright page, returns data. No file writes.

export async function readHeadings(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(h => h.offsetParent !== null)
      .map(h => ({ level: +h.tagName[1], text: h.textContent.trim().replace(/\s+/g, " ").slice(0, 80) })));
}
