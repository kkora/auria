// Unit tests for the canonical Markdown report — pure function of analysis + context.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarkdown } from "../../src/report/markdown.mjs";
import { buildNarration } from "../../src/narrate/plan.mjs";

const viewports = [
  { label: "Desktop", w: 1280, h: 900 },
  { label: "Phone", w: 375, h: 812 },
];

const analysis = {
  url: "https://x.gov/pay",
  date: "2026-07-19",
  title: "Pay Page",
  nvdaUsed: false,
  axe: {
    Desktop: [{ id: "image-alt", impact: "critical", help: "Images must have alternate text", wcag: ["wcag2a"], nodes: ["img"] }],
    Phone: [],
  },
  headings: [{ level: 2, text: "Section without a top-level heading" }],
  tabStops: [{ name: "Submit", role: "button" }, { name: "", role: "link" }],
  viewportMeta: null,
  strict: { reflow320: 12, zoom200: 0 },
  keyboardTrap: { status: "pass", stops: 3 },
  layout: {
    Desktop: { overflowPx: 0, overflowing: [], smallTargets: [], tinyText: [] },
    Phone: { overflowPx: 2000, overflowing: [{ el: "div.wide", px: 1625 }], smallTargets: [{ el: "button.small-btn", size: "16×16" }], tinyText: [] },
  },
};

function ctx(extra = {}) {
  const job = { url: analysis.url, ...extra.job };
  return { job, plan: buildNarration(analysis, { viewports, host: "x.gov" }), viewports, host: "x.gov", ...extra };
}

test("buildMarkdown: title header and metadata", () => {
  const md = buildMarkdown(analysis, ctx());
  assert.match(md, /^# Accessibility & Layout Audit — Pay Page/);
  assert.ok(md.includes("- **URL:** https://x.gov/pay"));
  assert.ok(md.includes("- **Date:** 2026-07-19"));
});

test("buildMarkdown: step-by-step script mirrors the narration plan", () => {
  const md = buildMarkdown(analysis, ctx());
  assert.ok(md.includes("## Step-by-step script"));
  assert.ok(/\*\*Press Tab\.\*\*/.test(md));       // tab actions annotated
  assert.ok(/\*\*Resize to 1280×900/.test(md));    // layout actions annotated
});

test("buildMarkdown: axe section — table for Desktop, None for Phone", () => {
  const md = buildMarkdown(analysis, ctx());
  assert.ok(md.includes("### Desktop width"));
  assert.ok(md.includes("image-alt — Images must have alternate text"));
  assert.ok(md.includes("### Phone width"));
  assert.ok(md.includes("None. ✅"));
});

test("buildMarkdown: layout + strict + missing viewport meta", () => {
  const md = buildMarkdown(analysis, ctx());
  assert.ok(md.includes("Viewport meta: **missing**"));
  assert.ok(/Reflow at exactly 320 CSS px.*❌ overflows by 12px/.test(md));
  assert.ok(md.includes("### Phone 375×812"));
});

test("buildMarkdown: headings, keyboard order, limitations", () => {
  const md = buildMarkdown(analysis, ctx());
  assert.ok(md.includes("## Headings"));
  assert.ok(md.includes("- h2: Section without a top-level heading"));
  assert.ok(md.includes("## Keyboard order"));
  assert.ok(md.includes("*(unnamed — WCAG 4.1.2 failure)*")); // the nameless link
  assert.ok(md.includes("## Limitations"));
});

test("buildMarkdown: SECURITY — auth values never appear, only counts", () => {
  const auth = { cookies: [{ name: "session", value: "SECRET-TOKEN-123", url: analysis.url }], headers: { Authorization: "Bearer SECRET-HEADER" } };
  const md = buildMarkdown(analysis, ctx({ auth }));
  assert.ok(md.includes("- **Auth:** 1 cookie(s), 1 custom header(s) applied (values not recorded)"));
  assert.ok(!md.includes("SECRET-TOKEN-123"), "cookie value must not leak into the report");
  assert.ok(!md.includes("SECRET-HEADER"), "header value must not leak into the report");
});

test("buildMarkdown: setup steps listed when present", () => {
  const md = buildMarkdown(analysis, ctx({ job: { steps: [{ click: "#pay" }, { fill: "#amount", value: "0" }] } }));
  assert.ok(md.includes("**Setup steps applied first:**"));
  assert.ok(md.includes("Click `#pay`"));
  assert.ok(md.includes('Fill `#amount` with "0"'));
});
