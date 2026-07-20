// Unit tests for the VPAT/ACR generator — pure function of the analysis object.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVpat } from "../../src/report/vpat.mjs";

const analysis = {
  url: "https://x.gov/pay",
  date: "2026-07-20",
  title: "Pay Page",
  axe: {
    Desktop: [
      { id: "image-alt", impact: "critical", help: "Images must have alternate text", wcag: ["wcag2a", "wcag111"], nodes: ["img"] },
      { id: "color-contrast", impact: "serious", help: "Elements must meet contrast", wcag: ["wcag2aa", "wcag143"], nodes: ["p"] },
    ],
    Phone: [{ id: "image-alt", impact: "critical", help: "Images must have alternate text", wcag: ["wcag111"], nodes: ["img"] }],
  },
  headings: [{ level: 2, text: "Section" }], // no h1 -> 1.3.1
  tabStops: [{ name: "Submit", role: "button" }, { name: "", role: "link" }], // one unnamed -> 4.1.2
  viewportMeta: null, // -> 1.4.10
  strict: { reflow320: 12, zoom200: 8 }, // -> 1.4.10, 1.4.4
  keyboardTrap: { status: "pass", stops: 3 },
  layout: { Desktop: { overflowPx: 0, smallTargets: [], tinyText: [] }, Phone: { overflowPx: 2000, smallTargets: [{ el: "button" }], tinyText: [] } },
};

test("buildVpat: header, standard, and draft disclaimer", () => {
  const md = buildVpat(analysis, { url: analysis.url });
  assert.match(md, /Accessibility Conformance Report \(VPAT/);
  assert.match(md, /WCAG 2\.2 Level AA/);
  assert.match(md, /auto-generated draft/i);
  assert.ok(md.includes("## Table 1: WCAG 2.2 Report"));
  assert.ok(md.includes("### Level A"));
  assert.ok(md.includes("### Level AA"));
});

test("buildVpat: renders product metadata when provided", () => {
  const md = buildVpat(analysis, {
    url: analysis.url, product: "Acme Portal", version: "3.2", vendor: "Acme Inc.",
    contact: "a11y@acme.example", description: "Citizen services portal",
  });
  assert.match(md, /\*\*Name of Product:\*\* Acme Portal/);
  assert.match(md, /\*\*Version:\*\* 3\.2/);
  assert.match(md, /\*\*Vendor \/ Company:\*\* Acme Inc\./);
  assert.match(md, /\*\*Contact:\*\* a11y@acme\.example/);
  assert.match(md, /Citizen services portal/);
});

test("buildVpat: includes the Section 508 and EN 301 549 chapters", () => {
  const md = buildVpat(analysis, { url: analysis.url });
  assert.ok(md.includes("## Table 2: Revised Section 508 Report"));
  assert.match(md, /Chapter 3: Functional Performance Criteria/);
  assert.match(md, /\| 302\.1 Without Vision \| Not Evaluated \|/);
  assert.match(md, /Chapter 4: Hardware/);
  assert.match(md, /Chapter 6: Support Documentation and Services/);
  assert.match(md, /\| 602\.2 .* \| Not Evaluated \|/);
  assert.ok(md.includes("## Table 3: EN 301 549 Report"));
});

test("buildVpat: axe wcag tags map to their SC rows as Partially Supports", () => {
  const md = buildVpat(analysis, { url: analysis.url });
  // 1.1.1 (image-alt, wcag111) and 1.4.3 (color-contrast, wcag143)
  assert.match(md, /\| 1\.1\.1 Non-text Content \| Partially Supports \| .*image-alt/);
  assert.match(md, /\| 1\.4\.3 Contrast \(Minimum\) \| Partially Supports \| .*color-contrast/);
  // deduped: image-alt appears at both viewports but the remark lists the rule once
  const line111 = md.split("\n").find(l => l.startsWith("| 1.1.1"));
  assert.equal((line111.match(/image-alt/g) || []).length, 1);
});

test("buildVpat: Auria's own checks drive their criteria", () => {
  const md = buildVpat(analysis, { url: analysis.url });
  assert.match(md, /\| 1\.4\.10 Reflow \| Partially Supports \|.*(viewport meta|overflow)/i); // reflow/overflow/no-meta
  assert.match(md, /\| 1\.4\.4 Resize Text \| Partially Supports \|.*200% zoom/);
  assert.match(md, /\| 2\.5\.8 Target Size \(Minimum\) \| Partially Supports \|.*24px/);
  assert.match(md, /\| 4\.1\.2 Name, Role, Value \| Partially Supports \|.*accessible name/);
  assert.match(md, /\| 1\.3\.1 Info and Relationships \| Partially Supports \|.*h1/);
});

test("buildVpat: a keyboard trap is Does Not Support; a clean evaluated SC is Supports", () => {
  const trapped = { ...analysis, keyboardTrap: { status: "trap", at: "input#x", stops: 5 } };
  const md = buildVpat(trapped, { url: analysis.url });
  assert.match(md, /\| 2\.1\.2 No Keyboard Trap \| Does Not Support \|.*stuck/);
  // 2.4.2 Page Titled: the page has a title and Auria evaluates it -> Supports
  assert.match(md, /\| 2\.4\.2 Page Titled \| Supports \|/);
});

test("buildVpat: criteria Auria doesn't cover are Not Evaluated", () => {
  const md = buildVpat(analysis, { url: analysis.url });
  assert.match(md, /\| 2\.2\.1 Timing Adjustable \| Not Evaluated \|.*manual/);
  assert.match(md, /\| 1\.4\.13 Content on Hover or Focus \| Not Evaluated \|/);
});

test("buildVpat: SECURITY — never emits auth values", () => {
  const withAuth = { ...analysis, url: "https://x.gov/pay?token=SECRET" };
  // buildVpat only receives analysis + a url; there is no auth channel, but assert the
  // known-secret string can't appear from the analysis object it's given.
  const md = buildVpat(withAuth, { url: "https://x.gov/pay" });
  assert.ok(!md.includes("SECRET"));
});

test("buildVpat: summary tallies all 55 WCAG 2.2 A/AA criteria", () => {
  const md = buildVpat(analysis, { url: analysis.url });
  const m = /Supports: (\d+) · Partially Supports: (\d+) · Does Not Support: (\d+) · Not Evaluated: (\d+) \(of (\d+)/.exec(md);
  assert.ok(m, "summary line present");
  const [, sup, partial, dns, notEval, total] = m.map(Number);
  assert.equal(total, 55); // WCAG 2.2 A/AA = 31 Level A + 24 Level AA
  assert.equal(sup + partial + dns + notEval, 55);
  assert.ok(partial > 0, "the fixture has violations");
});
