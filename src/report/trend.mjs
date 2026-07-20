// Report: compliance trend — diff a VPAT against the previous run and track history.
//
// diffVpat(prev, curr)   -> { regressed, fixed, coverageChanged, delta, hasPrev, changed }
// renderTrendMd(diff, …) -> markdown "Conformance trend" report
// pushHistory(hist, pt)  -> rolling array of { date, url, summary } data points
//
// Pure functions over buildVpatData() output. No browser, no file I/O, no auth values.

// Rank the evaluated conformance levels so a run-over-run move reads as a regression or a fix.
// "Not Evaluated" is deliberately absent: a move to/from it is a change in *coverage*, not a
// real conformance regression, and is reported separately.
const RANK = { "Does Not Support": 0, "Partially Supports": 1, "Supports": 2 };

const SUMMARY_KEYS = ["supports", "partiallySupports", "doesNotSupport", "notEvaluated"];

function summaryDelta(prev, curr) {
  const d = {};
  for (const k of SUMMARY_KEYS) d[k] = (curr?.[k] || 0) - (prev?.[k] || 0);
  return d;
}

// Compare two VPAT data objects criterion-by-criterion (matched on `sc`).
export function diffVpat(prev, curr) {
  const prevBy = new Map((prev?.criteria || []).map(c => [c.sc, c]));
  const regressed = [], fixed = [], coverageChanged = [];
  for (const c of curr?.criteria || []) {
    const p = prevBy.get(c.sc);
    if (!p || p.conformance === c.conformance) continue;
    const mv = { sc: c.sc, name: c.name, level: c.level, from: p.conformance, to: c.conformance };
    const rf = RANK[p.conformance], rt = RANK[c.conformance];
    if (rf != null && rt != null) (rt < rf ? regressed : fixed).push(mv);
    else coverageChanged.push(mv); // one side is "Not Evaluated"
  }
  return {
    hasPrev: !!prev,
    regressed, fixed, coverageChanged,
    delta: summaryDelta(prev?.summary, curr?.summary),
    changed: regressed.length + fixed.length + coverageChanged.length,
  };
}

// Append a compact data point, keeping at most `cap` most-recent entries (so history files
// stay bounded on long-running CI). Pure: returns a new array, never mutates the input.
export function pushHistory(history, point, cap = 100) {
  const arr = (Array.isArray(history) ? history : []).concat([point]);
  return arr.slice(-cap);
}

const cell = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const sign = n => (n > 0 ? `+${n}` : `${n}`);

export function renderTrendMd(diff, { name, date, prevDate } = {}) {
  const out = [`# Conformance trend — ${name || "the evaluated page"}`, ""];
  if (date) out.push(`_Run date: ${date}_`, "");
  if (!diff.hasPrev) {
    out.push("First VPAT run for this page — no previous report to compare against.", "");
    return out.join("\n");
  }
  out.push(`Comparing against the previous run${prevDate ? ` (${prevDate})` : ""}.`, "");
  const d = diff.delta;
  out.push(`**Summary change:** Supports ${sign(d.supports)} · Partially Supports ${sign(d.partiallySupports)} · Does Not Support ${sign(d.doesNotSupport)} · Not Evaluated ${sign(d.notEvaluated)}`, "");

  const table = (title, rows) => rows.length
    ? [`## ${title}`, "", "| Criteria | From | To |", "| --- | --- | --- |",
       ...rows.map(r => `| ${r.sc} ${cell(r.name)} | ${r.from} | ${r.to} |`), ""]
    : [];
  out.push(...table(`⚠️ Regressions (${diff.regressed.length})`, diff.regressed));
  out.push(...table(`✅ Fixes (${diff.fixed.length})`, diff.fixed));
  out.push(...table(`Coverage changes (${diff.coverageChanged.length})`, diff.coverageChanged));
  if (!diff.changed) out.push("No conformance changes since the previous run.", "");
  return out.join("\n");
}
