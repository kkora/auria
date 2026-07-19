// Unit tests for the narration planner — pure function of the analysis object.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNarration } from "../../src/narrate/plan.mjs";

const viewports = [
  { label: "Desktop", w: 1280, h: 900 },
  { label: "Phone", w: 375, h: 812 },
];

// A page with one axe violation at Desktop, none at Phone, an <h2> but no <h1>,
// two tab stops, no viewport meta, a 320px reflow overflow, and no keyboard trap.
const analysis = {
  url: "https://x.gov/pay",
  title: "Pay Page",
  nvdaUsed: false,
  axe: {
    Desktop: [{ id: "image-alt", impact: "critical", help: "Images must have alternate text", wcag: [], nodes: ["img"] }],
    Phone: [],
  },
  headings: [{ level: 2, text: "Section without a top-level heading" }],
  tabStops: [{ name: "Submit", role: "button" }, { name: "", role: "link" }],
  viewportMeta: null,
  strict: { reflow320: 12, zoom200: 0 },
  keyboardTrap: { status: "pass", stops: 3 },
  layout: {
    Desktop: { overflowPx: 0, smallTargets: [], tinyText: [] },
    Phone: { overflowPx: 2000, smallTargets: [{ el: "button.small-btn", size: "16×16" }], tinyText: [] },
  },
};

test("buildNarration: intro line uses the title and pads 800", () => {
  const plan = buildNarration(analysis, { viewports, host: "x.gov" });
  assert.match(plan[0].text, /^Accessibility and layout review of Pay Page/);
  assert.equal(plan[0].pad, 800);
  assert.equal(plan[0].action, null);
});

test("buildNarration: intro falls back to host when title is empty", () => {
  const plan = buildNarration({ ...analysis, title: "" }, { viewports, host: "x.gov" });
  assert.match(plan[0].text, /review of x\.gov/);
});

test("buildNarration: per-viewport axe lines (populated + empty)", () => {
  const plan = buildNarration(analysis, { viewports, host: "x.gov" });
  const texts = plan.map(p => p.text);
  assert.ok(texts.some(t => /axe scan at Desktop width found 1 violation: image alt/.test(t)));
  assert.ok(texts.some(t => /axe scan at Phone width found zero violations/.test(t)));
});

test("buildNarration: reports no level-one heading when h1 is absent", () => {
  const plan = buildNarration(analysis, { viewports, host: "x.gov" });
  assert.ok(plan.some(p => /no level-one heading/.test(p.text)));
});

test("buildNarration: one tab action per tab stop", () => {
  const plan = buildNarration(analysis, { viewports, host: "x.gov" });
  const tabs = plan.filter(p => p.action?.type === "tab");
  assert.equal(tabs.length, analysis.tabStops.length);
  assert.ok(tabs.some(p => /unnamed control is a WCAG 4\.1\.2 failure/.test(p.text))); // the nameless link
});

test("buildNarration: warns on missing viewport meta", () => {
  const plan = buildNarration(analysis, { viewports, host: "x.gov" });
  assert.ok(plan.some(p => /no viewport meta tag/.test(p.text)));
});

test("buildNarration: one layout action per viewport, padded scrollMs", () => {
  const plan = buildNarration(analysis, { viewports, host: "x.gov", scrollMs: 5000 });
  const layouts = plan.filter(p => p.action?.type === "layout");
  assert.equal(layouts.length, viewports.length);
  assert.ok(layouts.every(p => p.pad === 5000));
  assert.equal(layouts[0].action.vp.label, "Desktop");
});

test("buildNarration: closing line pads 1200 and is last", () => {
  const plan = buildNarration(analysis, { viewports, host: "x.gov" });
  const last = plan[plan.length - 1];
  assert.match(last.text, /^End of review/);
  assert.equal(last.pad, 1200);
});

test("buildNarration: baseline line only when a diff is passed", () => {
  const noDiff = buildNarration(analysis, { viewports, host: "x.gov" });
  assert.ok(!noDiff.some(p => /Compared with the baseline/.test(p.text)));
  const withDiff = buildNarration(analysis, {
    viewports, host: "x.gov",
    diff: { baselineDate: "2026-07-01", added: [{}], fixed: [], unchanged: 4 },
  });
  assert.ok(withDiff.some(p => /Compared with the baseline from 2026-07-01: 1 new violation/.test(p.text)));
});
