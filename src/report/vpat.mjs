// Report: analysis data -> VPAT® 2 / ACR (Accessibility Conformance Report).
//
// buildVpat(analysis, { url, title, date, product, standard }) -> markdown
//
// Produces an ITI VPAT® 2-style WCAG 2.2 Level A/AA conformance report. It is an
// AUTO-GENERATED DRAFT: automated testing (axe-core + Auria's layout/keyboard/reflow
// checks) can detect failures but cannot prove full conformance, so criteria Auria does
// not evaluate are marked "Not Evaluated" for a human reviewer to complete.
//
// Pure function: no browser, no file writes. Auth values are never included.

// WCAG 2.2 Level A + AA success criteria (the Section 508 / EN 301 549 baseline).
const WCAG = [
  ["1.1.1", "Non-text Content", "A"],
  ["1.2.1", "Audio-only and Video-only (Prerecorded)", "A"],
  ["1.2.2", "Captions (Prerecorded)", "A"],
  ["1.2.3", "Audio Description or Media Alternative (Prerecorded)", "A"],
  ["1.3.1", "Info and Relationships", "A"],
  ["1.3.2", "Meaningful Sequence", "A"],
  ["1.3.3", "Sensory Characteristics", "A"],
  ["1.4.1", "Use of Color", "A"],
  ["1.4.2", "Audio Control", "A"],
  ["2.1.1", "Keyboard", "A"],
  ["2.1.2", "No Keyboard Trap", "A"],
  ["2.1.4", "Character Key Shortcuts", "A"],
  ["2.2.1", "Timing Adjustable", "A"],
  ["2.2.2", "Pause, Stop, Hide", "A"],
  ["2.3.1", "Three Flashes or Below Threshold", "A"],
  ["2.4.1", "Bypass Blocks", "A"],
  ["2.4.2", "Page Titled", "A"],
  ["2.4.3", "Focus Order", "A"],
  ["2.4.4", "Link Purpose (In Context)", "A"],
  ["2.5.1", "Pointer Gestures", "A"],
  ["2.5.2", "Pointer Cancellation", "A"],
  ["2.5.3", "Label in Name", "A"],
  ["2.5.4", "Motion Actuation", "A"],
  ["3.1.1", "Language of Page", "A"],
  ["3.2.1", "On Focus", "A"],
  ["3.2.2", "On Input", "A"],
  ["3.2.6", "Consistent Help", "A"],
  ["3.3.1", "Error Identification", "A"],
  ["3.3.2", "Labels or Instructions", "A"],
  ["3.3.7", "Redundant Entry", "A"],
  ["4.1.2", "Name, Role, Value", "A"],
  ["1.2.4", "Captions (Live)", "AA"],
  ["1.2.5", "Audio Description (Prerecorded)", "AA"],
  ["1.3.4", "Orientation", "AA"],
  ["1.3.5", "Identify Input Purpose", "AA"],
  ["1.4.3", "Contrast (Minimum)", "AA"],
  ["1.4.4", "Resize Text", "AA"],
  ["1.4.5", "Images of Text", "AA"],
  ["1.4.10", "Reflow", "AA"],
  ["1.4.11", "Non-text Contrast", "AA"],
  ["1.4.12", "Text Spacing", "AA"],
  ["1.4.13", "Content on Hover or Focus", "AA"],
  ["2.4.5", "Multiple Ways", "AA"],
  ["2.4.6", "Headings and Labels", "AA"],
  ["2.4.7", "Focus Visible", "AA"],
  ["2.4.11", "Focus Not Obscured (Minimum)", "AA"],
  ["2.5.7", "Dragging Movements", "AA"],
  ["2.5.8", "Target Size (Minimum)", "AA"],
  ["3.1.2", "Language of Parts", "AA"],
  ["3.2.3", "Consistent Navigation", "AA"],
  ["3.2.4", "Consistent Identification", "AA"],
  ["3.3.3", "Error Suggestion", "AA"],
  ["3.3.4", "Error Prevention (Legal, Financial, Data)", "AA"],
  ["3.3.8", "Accessible Authentication (Minimum)", "AA"],
  ["4.1.3", "Status Messages", "AA"],
];

// Criteria Auria evaluates directly — clean = "Supports", failing = "Partially Supports"
// (or "Does Not Support" for the hard failures handled below).
const AURIA_EVALUATES = new Set(["1.3.1", "1.4.4", "1.4.10", "2.1.2", "2.4.2", "2.4.3", "2.4.6", "2.5.8", "4.1.2"]);

const cell = s => String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

// Collect { sc -> [finding strings] } from the analysis: axe violations (mapped via
// their wcagNNN tags) plus Auria's own checks.
function collectFindings(analysis) {
  const f = {};
  const add = (sc, msg) => { (f[sc] ??= []).push(msg); };

  // axe: a "wcag143" tag -> SC "1.4.3"; one entry per (SC, rule), deduped.
  const seen = new Set();
  for (const list of Object.values(analysis.axe || {})) {
    for (const v of list) {
      if (v.id === "scan-failed") continue;
      for (const tag of v.wcag || []) {
        const m = /^wcag(\d)(\d)(\d+)$/.exec(tag);
        if (!m) continue;
        const sc = `${m[1]}.${m[2]}.${m[3]}`;
        const key = `${sc}|${v.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        add(sc, `axe: ${v.id} — ${v.help}`);
      }
    }
  }

  // Auria's own checks.
  const layout = Object.values(analysis.layout || {});
  if (analysis.viewportMeta === null) add("1.4.10", "No viewport meta tag — the page will not reflow on mobile.");
  if (analysis.strict?.reflow320 > 0) add("1.4.10", `Content overflows by ${analysis.strict.reflow320}px at 320 CSS px.`);
  if (layout.some(L => L.overflowPx > 1)) add("1.4.10", "Horizontal overflow at one or more viewports.");
  if (analysis.strict?.zoom200 > 0) add("1.4.4", `Content overflows by ${analysis.strict.zoom200}px at 200% zoom.`);
  const small = layout.reduce((n, L) => n + (L.smallTargets?.length || 0), 0);
  if (small) add("2.5.8", `${small} interactive target(s) smaller than the 24px minimum.`);
  if (analysis.keyboardTrap?.status === "trap") add("2.1.2", `Keyboard trap: focus stuck on ${analysis.keyboardTrap.at}.`);
  if (!analysis.title) add("2.4.2", "The page has no <title>.");
  const unnamed = (analysis.tabStops || []).filter(s => !s.name).length;
  if (unnamed) add("4.1.2", `${unnamed} focusable control(s) with no accessible name.`);
  if ((analysis.headings || []).length && !analysis.headings.some(h => h.level === 1))
    add("1.3.1", "No level-one heading (h1) — document structure is incomplete.");

  return f;
}

// Resolve one criterion to { level, remarks }.
function resolve(sc, findings) {
  const hits = findings[sc];
  if (hits) return { level: sc === "2.1.2" ? "Does Not Support" : "Partially Supports", remarks: hits.join(" ") };
  if (AURIA_EVALUATES.has(sc)) return { level: "Supports", remarks: "No issues detected by the automated checks covering this criterion." };
  return { level: "Not Evaluated", remarks: "Not covered by automated testing — requires manual review." };
}

export function buildVpat(analysis, { url, title, date, product, standard = "WCAG 2.2 Level AA" } = {}) {
  const findings = collectFindings(analysis);
  const name = product || title || analysis.title || url || "the evaluated page";

  const table = lvl => [
    "| Criteria | Conformance Level | Remarks and Explanations |",
    "| --- | --- | --- |",
    ...WCAG.filter(w => w[2] === lvl).map(([sc, scName]) => {
      const { level, remarks } = resolve(sc, findings);
      return `| ${sc} ${cell(scName)} | ${level} | ${cell(remarks)} |`;
    }),
  ].join("\n");

  const tally = {};
  for (const [sc] of WCAG) { const { level } = resolve(sc, findings); tally[level] = (tally[level] || 0) + 1; }

  const md = [];
  md.push(`# Accessibility Conformance Report (VPAT®) — ${name}`, "",
    `**Standard:** ${standard}  ·  **Report format:** VPAT® 2`, "",
    `- **Product / page:** ${name}`,
    `- **URL evaluated:** ${url || "—"}`,
    `- **Date:** ${date || analysis.date || ""}`,
    `- **Evaluation method:** Automated audit (Auria — axe-core plus layout, reflow, and keyboard checks).`,
    "",
    "> **This is an auto-generated draft.** Automated testing detects failures but cannot",
    "> prove full conformance. A qualified reviewer must evaluate every **Not Evaluated**",
    "> row (and confirm the automated results) before this report is published or relied on.",
    "",
    "## Conformance levels", "",
    "- **Supports** — no issues found by the automated checks that cover this criterion.",
    "- **Partially Supports** — the automated checks found some issues (see Remarks).",
    "- **Does Not Support** — a clear failure was detected.",
    "- **Not Evaluated** — not covered by automated testing; requires manual review.",
    "",
    "## Summary", "",
    `Supports: ${tally["Supports"] || 0} · Partially Supports: ${tally["Partially Supports"] || 0} · Does Not Support: ${tally["Does Not Support"] || 0} · Not Evaluated: ${tally["Not Evaluated"] || 0} (of ${WCAG.length} WCAG 2.2 A/AA criteria)`,
    "",
    "## WCAG 2.2 Report", "",
    "### Table 1: Success Criteria, Level A", "",
    table("A"), "",
    "### Table 2: Success Criteria, Level AA", "",
    table("AA"), "");
  return md.join("\n");
}
