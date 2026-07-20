// Unit tests for the compliance-trend diff — pure functions over VPAT data objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffVpat, renderTrendMd, pushHistory } from "../../src/report/trend.mjs";

const data = (criteria, summary) => ({ format: "VPAT-2", summary, criteria });
const crit = (sc, conformance, name = sc, level = "A") => ({ sc, name, level, conformance, remarks: "" });

test("diffVpat: classifies regressions, fixes, and coverage changes by conformance rank", () => {
  const prev = data([
    crit("1.1.1", "Supports"),
    crit("1.4.3", "Supports"),
    crit("2.1.2", "Partially Supports"),
    crit("2.4.2", "Not Evaluated"),
    crit("3.3.1", "Does Not Support"),
  ], { supports: 2, partiallySupports: 1, doesNotSupport: 1, notEvaluated: 1, total: 5 });
  const curr = data([
    crit("1.1.1", "Supports"),            // unchanged
    crit("1.4.3", "Partially Supports"),  // regression (Supports -> Partially)
    crit("2.1.2", "Does Not Support"),    // regression (Partially -> Does Not)
    crit("2.4.2", "Supports"),            // coverage change (Not Evaluated -> Supports)
    crit("3.3.1", "Partially Supports"),  // fix (Does Not -> Partially)
  ], { supports: 3, partiallySupports: 2, doesNotSupport: 1, notEvaluated: 0, total: 5 });

  const d = diffVpat(prev, curr);
  assert.equal(d.hasPrev, true);
  assert.deepEqual(d.regressed.map(r => r.sc), ["1.4.3", "2.1.2"]);
  assert.deepEqual(d.fixed.map(r => r.sc), ["3.3.1"]);
  assert.deepEqual(d.coverageChanged.map(r => r.sc), ["2.4.2"]);
  assert.equal(d.changed, 4);
  // summary delta = curr - prev
  assert.deepEqual(d.delta, { supports: 1, partiallySupports: 1, doesNotSupport: 0, notEvaluated: -1 });
});

test("diffVpat: no previous report -> hasPrev false, nothing changed", () => {
  const curr = data([crit("1.1.1", "Supports")], { supports: 1, partiallySupports: 0, doesNotSupport: 0, notEvaluated: 0, total: 1 });
  const d = diffVpat(null, curr);
  assert.equal(d.hasPrev, false);
  assert.equal(d.changed, 0);
  assert.deepEqual(d.delta, { supports: 1, partiallySupports: 0, doesNotSupport: 0, notEvaluated: 0 });
});

test("diffVpat: identical runs report no changes", () => {
  const x = data([crit("1.1.1", "Supports"), crit("1.4.3", "Partially Supports")],
    { supports: 1, partiallySupports: 1, doesNotSupport: 0, notEvaluated: 0, total: 2 });
  const d = diffVpat(x, x);
  assert.equal(d.changed, 0);
  assert.deepEqual(d.delta, { supports: 0, partiallySupports: 0, doesNotSupport: 0, notEvaluated: 0 });
});

test("renderTrendMd: first run has no comparison; a diff renders regression + fix tables", () => {
  const first = renderTrendMd(diffVpat(null, data([crit("1.1.1", "Supports")], { supports: 1, partiallySupports: 0, doesNotSupport: 0, notEvaluated: 0 })),
    { name: "Acme", date: "2026-07-20" });
  assert.match(first, /First VPAT run/);

  const d = diffVpat(
    data([crit("1.4.3", "Supports", "Contrast (Minimum)", "AA"), crit("3.3.1", "Does Not Support", "Error Identification")],
      { supports: 1, partiallySupports: 0, doesNotSupport: 1, notEvaluated: 0 }),
    data([crit("1.4.3", "Partially Supports", "Contrast (Minimum)", "AA"), crit("3.3.1", "Partially Supports", "Error Identification")],
      { supports: 0, partiallySupports: 2, doesNotSupport: 0, notEvaluated: 0 }));
  const md = renderTrendMd(d, { name: "Acme", date: "2026-07-20", prevDate: "2026-07-13" });
  assert.match(md, /Comparing against the previous run \(2026-07-13\)/);
  assert.match(md, /Regressions \(1\)/);
  assert.match(md, /\| 1\.4\.3 Contrast \(Minimum\) \| Supports \| Partially Supports \|/);
  assert.match(md, /Fixes \(1\)/);
  assert.match(md, /\| 3\.3\.1 Error Identification \| Does Not Support \| Partially Supports \|/);
  assert.match(md, /Supports -1 · Partially Supports \+2/);
});

test("renderTrendMd: unchanged run states it plainly", () => {
  const x = data([crit("1.1.1", "Supports")], { supports: 1, partiallySupports: 0, doesNotSupport: 0, notEvaluated: 0 });
  assert.match(renderTrendMd(diffVpat(x, x), { name: "Acme" }), /No conformance changes since the previous run/);
});

test("pushHistory: appends without mutating and caps to the most-recent entries", () => {
  const h0 = [];
  const h1 = pushHistory(h0, { date: "2026-07-01", summary: { supports: 1 } });
  assert.equal(h0.length, 0, "input not mutated");
  assert.equal(h1.length, 1);
  // cap keeps the newest
  let h = [];
  for (let i = 0; i < 5; i++) h = pushHistory(h, { date: `d${i}` }, 3);
  assert.deepEqual(h.map(p => p.date), ["d2", "d3", "d4"]);
});
