// Unit tests for contrastSummary — pure aggregation of axe's color-contrast rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastSummary } from "../../src/analyze/axe.mjs";

test("contrastSummary: null when there are no contrast failures", () => {
  assert.equal(contrastSummary([]), null);
  assert.equal(contrastSummary(), null);
});

test("contrastSummary: counts, worst ratio, and normal/large-text split", () => {
  const rows = [
    { target: "p.a", ratio: 2.1, required: 4.5, fg: "#999", bg: "#fff" },   // normal text
    { target: "h1.b", ratio: 1.6, required: 4.5, fg: "#bbb", bg: "#fff" },  // normal text (worst)
    { target: "span.c", ratio: 2.9, required: 3, fg: "#888", bg: "#fff" },  // large/bold text
  ];
  const s = contrastSummary(rows);
  assert.equal(s.count, 3);
  assert.equal(s.worstRatio, 1.6);
  assert.equal(s.normalText, 2);
  assert.equal(s.largeText, 1);
  // worst list is sorted ascending by ratio (most severe first)
  assert.deepEqual(s.worst.map(w => w.target), ["h1.b", "p.a", "span.c"]);
});

test("contrastSummary: caps the worst list at 8", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ target: `el${i}`, ratio: 2 + i * 0.1, required: 4.5 }));
  const s = contrastSummary(rows);
  assert.equal(s.count, 12);
  assert.equal(s.worst.length, 8);
});
