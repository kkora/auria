// Report: markdown -> print-styled A4 PDF.
//
// markdownToHtml(markdown) -> string   pure converter for our markdown subset
//   (headings, tables, lists, inline code/bold/<br>) with the print stylesheet.
// renderPdf(browser, markdown, outPath) -> void   prints A4 via Playwright's page.pdf.
//   PDF is on by default; a failure here logs a warning and never aborts the audit.
//
// Uses a browser page only for the PDF print step.

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = s => esc(s).replace(/&lt;br&gt;/g, "<br>")
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>");

// Convert the canonical markdown (src/report/markdown.mjs) to a print-styled HTML
// document. Pure — the same subset the monolith emitted (headings h1-h3, pipe tables,
// ordered/unordered lists, inline **bold** / `code` / <br>).
export function markdownToHtml(markdown) {
  const out = []; let list = null; let tableRows = 0;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of markdown.split("\n")) {
    const h = line.match(/^(#{1,3}) (.+)/);
    if (h) { closeList(); tableRows = 0; out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (/^\|/.test(line)) {
      if (/^\|[\s|:-]+\|$/.test(line)) continue;
      const cells = line.slice(1, -1).split("|").map(c => inline(c.trim()));
      const tag = tableRows === 0 ? "th" : "td";
      if (tableRows === 0) { closeList(); out.push("<table>"); }
      out.push(`<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join("")}</tr>`);
      tableRows++; continue;
    }
    if (tableRows) { out.push("</table>"); tableRows = 0; }
    const li = line.match(/^\s*(?:[-*]|\d+\.) (.+)/);
    if (li) {
      const want = /^\s*\d+\./.test(line) ? "ol" : "ul";
      if (list !== want) { closeList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline(li[1])}</li>`); continue;
    }
    closeList();
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  closeList(); if (tableRows) out.push("</table>");
  return `<!doctype html><meta charset="utf-8"><style>
        body{font:11pt/1.5 "Segoe UI",system-ui,sans-serif;color:#1a2433;margin:0}
        h1{font-size:19pt;margin:0 0 .4em;color:#06214A} h2{font-size:14pt;margin:1.2em 0 .4em;color:#06214A;border-bottom:1px solid #d3dbe5;padding-bottom:.15em}
        h3{font-size:12pt;margin:1em 0 .3em} p,li{margin:.25em 0}
        table{border-collapse:collapse;width:100%;margin:.5em 0;font-size:9.5pt}
        th,td{border:1px solid #c9d0d9;padding:5px 8px;text-align:left;vertical-align:top}
        th{background:#edf1f6} code{background:#edf1f6;padding:1px 4px;border-radius:3px;font:9pt Consolas,monospace}
        ol li{margin:.35em 0}</style><body>${out.join("\n")}</body>`;
}

// Print the markdown to an A4 PDF at outPath. A failure logs a warning and does not
// throw — the caller's markdown report is still written.
export async function renderPdf(browser, markdown, outPath) {
  const html = markdownToHtml(markdown);
  try {
    const pdfPage = await browser.newPage();
    await pdfPage.setContent(html, { waitUntil: "load" });
    await pdfPage.pdf({
      path: outPath, format: "A4", printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "15mm", right: "15mm" },
    });
    await pdfPage.close();
  } catch (e) {
    console.error(`  PDF generation failed (markdown report still written): ${e.message}`);
  }
}
