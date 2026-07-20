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

// Revised Section 508 — Chapter 3: Functional Performance Criteria (302.x). These are
// outcome-based and require human judgement, so automation reports them "Not Evaluated".
const FPC = [
  ["302.1", "Without Vision"],
  ["302.2", "With Limited Vision"],
  ["302.3", "Without Perception of Color"],
  ["302.4", "Without Hearing"],
  ["302.5", "With Limited Hearing"],
  ["302.6", "Without Speech"],
  ["302.7", "With Limited Manipulation"],
  ["302.8", "With Limited Reach and Strength"],
  ["302.9", "With Limited Language, Cognitive, and Learning Abilities"],
];

// Revised Section 508 — Chapter 6: Support Documentation and Services (also manual).
const SUPPORT_DOCS = [
  ["602.2", "Accessibility and Compatibility Features"],
  ["602.3", "Electronic Support Documentation"],
  ["602.4", "Alternate Formats for Non-Electronic Support Documentation"],
  ["603.2", "Information on Accessibility and Compatibility Features"],
  ["603.3", "Accommodation of Communication Needs"],
];

const cell = s => String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

// A fixed-conformance table for the manual-review chapters (508 Ch. 3 / Ch. 6).
const staticTable = (rows, level, remark) => [
  "| Criteria | Conformance Level | Remarks and Explanations |",
  "| --- | --- | --- |",
  ...rows.map(([id, nm]) => `| ${id} ${cell(nm)} | ${level} | ${cell(remark)} |`),
].join("\n");

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

// Resolve one criterion to { level, remarks }. `passedSc` is the set of criteria axe
// tested and passed (present only when the audit ran with { passes: true }).
function resolve(sc, findings, passedSc) {
  const hits = findings[sc];
  if (hits) return { level: sc === "2.1.2" ? "Does Not Support" : "Partially Supports", remarks: hits.join(" ") };
  if (AURIA_EVALUATES.has(sc)) return { level: "Supports", remarks: "No issues detected by the automated checks covering this criterion." };
  if (passedSc.has(sc)) return { level: "Supports", remarks: "Passed the automated axe-core checks for this criterion." };
  return { level: "Not Evaluated", remarks: "Not covered by automated testing — requires manual review." };
}

// Resolve every WCAG criterion to a structured row (shared by the markdown + JSON forms).
function criteriaFor(findings, passedSc) {
  return WCAG.map(([sc, name, level]) => {
    const { level: conformance, remarks } = resolve(sc, findings, passedSc);
    return { sc, name, level, conformance, remarks };
  });
}
function summaryOf(criteria) {
  const s = { Supports: 0, "Partially Supports": 0, "Does Not Support": 0, "Not Evaluated": 0 };
  for (const c of criteria) s[c.conformance] = (s[c.conformance] || 0) + 1;
  return s;
}

// Shared renderer: a resolved findings map + passed-criteria set -> the VPAT markdown.
function renderVpat(findings, passedSc, {
  url, date, product, version, vendor, contact, description, name, scopeNote,
  standard = "WCAG 2.2 Level AA",
} = {}) {
  const criteria = criteriaFor(findings, passedSc);
  const table = lvl => [
    "| Criteria | Conformance Level | Remarks and Explanations |",
    "| --- | --- | --- |",
    ...criteria.filter(c => c.level === lvl).map(c => `| ${c.sc} ${cell(c.name)} | ${c.conformance} | ${cell(c.remarks)} |`),
  ].join("\n");

  const tally = summaryOf(criteria);

  const meta = [
    `- **Name of Product:** ${product || name || "—"}`,
    ...(version ? [`- **Version:** ${version}`] : []),
    ...(vendor ? [`- **Vendor / Company:** ${vendor}`] : []),
    `- **URL evaluated:** ${url || "—"}`,
    `- **Report Date:** ${date || ""}`,
    ...(contact ? [`- **Contact:** ${contact}`] : []),
    ...(description ? [`- **Product Description:** ${description}`] : []),
    `- **Evaluation Methods Used:** Automated audit (Auria — axe-core plus layout, reflow, and keyboard checks). Manual review pending for the "Not Evaluated" rows.`,
    `- **Applicable Standards:** ${standard}; Revised Section 508 (Chapters 3–6); EN 301 549.`,
  ];

  const md = [];
  md.push(`# Accessibility Conformance Report (VPAT®) — ${name}`, "",
    `**Report format:** VPAT® 2  ·  **Primary standard:** ${standard}`, "",
    ...meta, "",
    ...(scopeNote ? [scopeNote, ""] : []),
    "> **This is an auto-generated draft.** Automated testing detects failures but cannot",
    "> prove full conformance. A qualified reviewer must evaluate every **Not Evaluated**",
    "> row (and confirm the automated results) before this report is published or relied on.",
    "",
    "## Conformance levels", "",
    "- **Supports** — no issues found by the automated checks that cover this criterion.",
    "- **Partially Supports** — the automated checks found some issues (see Remarks).",
    "- **Does Not Support** — a clear failure was detected.",
    "- **Not Evaluated** — not covered by automated testing; requires manual review.",
    "- **Not Applicable** — the criterion does not apply to this product.",
    "",
    "## Summary (WCAG 2.2 A/AA)", "",
    `Supports: ${tally["Supports"] || 0} · Partially Supports: ${tally["Partially Supports"] || 0} · Does Not Support: ${tally["Does Not Support"] || 0} · Not Evaluated: ${tally["Not Evaluated"] || 0} (of ${WCAG.length} criteria)`,
    "",
    "## Table 1: WCAG 2.2 Report", "",
    "### Level A", "",
    table("A"), "",
    "### Level AA", "",
    table("AA"), "",
    "## Table 2: Revised Section 508 Report", "",
    "### Chapter 3: Functional Performance Criteria (FPC)", "",
    "Outcome-based criteria that require manual, assistive-technology testing to assess.",
    "", staticTable(FPC, "Not Evaluated", "Requires manual review with assistive technology."), "",
    "### Chapter 4: Hardware", "",
    "Not applicable — Auria audits web content, not hardware.", "",
    "### Chapter 5: Software", "",
    "For web content, software requirements are met through the WCAG 2.2 Report (Table 1).", "",
    "### Chapter 6: Support Documentation and Services", "",
    staticTable(SUPPORT_DOCS, "Not Evaluated", "Requires manual review of the product's documentation and support."), "",
    "## Table 3: EN 301 549 Report", "",
    "EN 301 549 Chapter 9 (Web) incorporates the WCAG success criteria, so the WCAG 2.2",
    "Report (Table 1) applies. Chapters 11 (software), 12 (documentation), and the",
    "closed-functionality / interoperability clauses require separate manual review.", "");
  return md.join("\n");
}

// Single-page report.
export function buildVpat(analysis, ctx = {}) {
  const findings = collectFindings(analysis);
  const passedSc = new Set(analysis.axePassedSc || []);
  const name = ctx.product || ctx.title || analysis.title || ctx.url || "the evaluated page";
  return renderVpat(findings, passedSc, { ...ctx, name, date: ctx.date || analysis.date });
}

// Product-level report aggregating several pages: a criterion fails at the product level
// if it fails on ANY page; it counts as passed only if some page passed it (and none failed).
export function buildSiteVpat(analyses, ctx = {}) {
  const { findings, passedSc } = mergeSite(analyses);
  const name = ctx.product || ctx.title || "the evaluated site";
  const scopeNote = `> **Site-wide report** aggregating **${analyses.length}** audited page(s). A criterion is marked failing at the product level if it fails on any page.`;
  return renderVpat(findings, passedSc, { ...ctx, name, scopeNote });
}

// Merge several pages into one product-level findings/passed view (shared by md + json).
function mergeSite(analyses) {
  const merged = {};
  const passedSc = new Set();
  for (const a of analyses) {
    for (const [sc, msgs] of Object.entries(collectFindings(a))) {
      const set = (merged[sc] ??= new Set());
      for (const m of msgs) set.add(m);
    }
    for (const sc of a.axePassedSc || []) passedSc.add(sc);
  }
  const findings = {};
  for (const [sc, set] of Object.entries(merged)) {
    const arr = [...set];
    findings[sc] = arr.length > 4 ? [...arr.slice(0, 4), `…and ${arr.length - 4} more finding(s) across the site`] : arr;
  }
  return { findings, passedSc };
}

// Machine-readable form of the report (for tooling, dashboards, trend tracking).
function dataFrom(findings, passedSc, ctx = {}) {
  const criteria = criteriaFor(findings, passedSc);
  const s = summaryOf(criteria);
  return {
    format: "VPAT-2",
    standard: ctx.standard || "WCAG 2.2 Level AA",
    draft: true,
    product: ctx.product || ctx.name || null,
    version: ctx.version || null,
    vendor: ctx.vendor || null,
    url: ctx.url || null,
    date: ctx.date || null,
    ...(ctx.pages ? { pages: ctx.pages } : {}),
    summary: {
      supports: s["Supports"], partiallySupports: s["Partially Supports"],
      doesNotSupport: s["Does Not Support"], notEvaluated: s["Not Evaluated"], total: criteria.length,
    },
    criteria, // [{ sc, name, level, conformance, remarks }]
  };
}

export function buildVpatData(analysis, ctx = {}) {
  const name = ctx.product || ctx.title || analysis.title || ctx.url || null;
  return dataFrom(collectFindings(analysis), new Set(analysis.axePassedSc || []), { ...ctx, name, date: ctx.date || analysis.date });
}

export function buildSiteVpatData(analyses, ctx = {}) {
  const { findings, passedSc } = mergeSite(analyses);
  return dataFrom(findings, passedSc, { ...ctx, name: ctx.product || ctx.title || "the evaluated site", pages: analyses.length });
}
