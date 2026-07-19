// Report: axe + strict checks -> JUnit XML.
//
// buildJunit(analysis, { url }) -> string   axe rules, reflow-320, zoom-200, and the
// keyboard-trap result rendered as <testcase>/<failure> for CI test dashboards.
// Pure serialization — no file writes, no browser.

const xmlEsc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildJunit(analysis, { url }) {
  const cases = [];
  for (const [state, list] of Object.entries(analysis.axe)) {
    if (!list.length) cases.push(`  <testcase classname="axe.${xmlEsc(state)}" name="axe scan"/>`);
    list.forEach(v => cases.push(
      `  <testcase classname="axe.${xmlEsc(state)}" name="${xmlEsc(v.id)}">\n` +
      `    <failure message="${xmlEsc(v.help)} (${v.impact})">${xmlEsc((v.nodes || []).join("\n"))}</failure>\n` +
      `  </testcase>`));
  }
  const strictCase = (nm, bad, detail) => bad
    ? `  <testcase classname="layout" name="${nm}">\n    <failure message="${xmlEsc(detail)}"/>\n  </testcase>`
    : `  <testcase classname="layout" name="${nm}"/>`;
  cases.push(strictCase("reflow-320px", analysis.strict.reflow320 > 0, `overflows by ${analysis.strict.reflow320}px (WCAG 1.4.10)`));
  cases.push(strictCase("zoom-200pct", analysis.strict.zoom200 > 0, `overflows by ${analysis.strict.zoom200}px (WCAG 1.4.4)`));
  cases.push(strictCase("keyboard-trap", analysis.keyboardTrap.status === "trap", `focus stuck on ${analysis.keyboardTrap.at} (WCAG 2.1.2)`));
  const failures = (cases.join("\n").match(/<failure/g) || []).length;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="auria ${xmlEsc(url)}" tests="${cases.length}" failures="${failures}">\n${cases.join("\n")}\n</testsuite>\n`;
}
