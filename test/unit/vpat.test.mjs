// Unit tests for the VPAT/ACR generator — pure function of the analysis object.
import { test } from "node:test";
import assert from "node:assert/strict";
import axe from "axe-core";
import { buildVpat, buildSiteVpat, buildVpatData, buildSiteVpatData, scFromTag, WCAG_SC } from "../../src/report/vpat.mjs";

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

test("scFromTag: parses axe SC tags, including two-digit criteria; rejects non-SC tags", () => {
  assert.equal(scFromTag("wcag111"), "1.1.1");
  assert.equal(scFromTag("wcag143"), "1.4.3");
  assert.equal(scFromTag("wcag258"), "2.5.8");
  assert.equal(scFromTag("wcag1410"), "1.4.10");  // two-digit criterion
  assert.equal(scFromTag("wcag2411"), "2.4.11");  // two-digit criterion
  assert.equal(scFromTag("wcag412"), "4.1.2");
  // level / standard / best-practice tags are not success criteria
  for (const t of ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice", "cat.keyboard", "section508", "ACT", ""])
    assert.equal(scFromTag(t), null, `${t} is not an SC`);
});

test("WCAG_SC: the reported set is exactly the 55 A/AA criteria", () => {
  assert.equal(WCAG_SC.size, 55);
  assert.ok(WCAG_SC.has("1.1.1") && WCAG_SC.has("4.1.3"));
  assert.ok(!WCAG_SC.has("4.1.1"), "4.1.1 Parsing is obsolete in WCAG 2.2");
  assert.ok(!WCAG_SC.has("1.4.6"), "1.4.6 is Level AAA, out of scope");
});

// Expert-review-as-a-test: guards the axe-rule -> SC mapping against axe-core drift. If a
// future axe-core bump adds an A/AA rule for a success criterion we don't list, this fails
// (a silent gap in the VPAT). AAA criteria that A-level rules also tag are the only allowed
// escapes (currently just 2.1.3, carried by scrollable-region-focusable alongside 2.1.1).
test("axe coverage: every A/AA axe rule maps to a reported SC (no silent gaps)", () => {
  const AA_LEVEL = new Set(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]);
  // AAA criteria that dual-level A/AA rules also tag — intentionally out of an A/AA report.
  const ALLOWED_AAA = new Set(["2.1.3"]);
  const gaps = [];
  for (const rule of axe.getRules()) {
    const tags = rule.tags || [];
    if (!tags.some(t => AA_LEVEL.has(t))) continue;   // only rules axe classifies as A/AA
    for (const t of tags) {
      const sc = scFromTag(t);
      if (sc && !WCAG_SC.has(sc) && !ALLOWED_AAA.has(sc)) gaps.push(`${rule.ruleId} -> ${sc} (${t})`);
    }
  }
  assert.deepEqual(gaps, [], `axe A/AA rules mapping to SCs absent from the VPAT: ${gaps.join(", ")}`);
});

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

test("buildVpat: axe-passed criteria become Supports (from analysis.axePassedSc)", () => {
  // 1.4.1 Use of Color has no finding and Auria doesn't check it -> normally Not Evaluated,
  // but if axe tested and passed it, it becomes Supports.
  const withPasses = { ...analysis, axePassedSc: ["1.4.1", "1.1.1"] };
  const md = buildVpat(withPasses, { url: analysis.url });
  assert.match(md, /\| 1\.4\.1 Use of Color \| Supports \|.*axe/);
  // 1.1.1 has a violation, so a "pass" elsewhere must NOT override it to Supports
  assert.match(md, /\| 1\.1\.1 Non-text Content \| Partially Supports \|/);
});

test("buildVpatData: structured object with criteria + summary", () => {
  const d = buildVpatData(analysis, { url: analysis.url, product: "Acme Portal", version: "3.2" });
  assert.equal(d.format, "VPAT-2");
  assert.equal(d.standard, "WCAG 2.2 Level AA");
  assert.equal(d.draft, true);
  assert.equal(d.product, "Acme Portal");
  assert.equal(d.version, "3.2");
  assert.equal(d.criteria.length, 55);
  assert.equal(d.summary.total, 55);
  assert.equal(d.summary.supports + d.summary.partiallySupports + d.summary.doesNotSupport + d.summary.notEvaluated, 55);
  const c111 = d.criteria.find(c => c.sc === "1.1.1");
  assert.deepEqual({ level: c111.level, conformance: c111.conformance }, { level: "A", conformance: "Partially Supports" });
  assert.match(c111.remarks, /image-alt/);
});

test("buildSiteVpatData: aggregates and reports the page count", () => {
  const clean = { ...analysis, axe: { Desktop: [] }, headings: [{ level: 1, text: "H" }], viewportMeta: "width=device-width",
    strict: { reflow320: 0, zoom200: 0 }, tabStops: [{ name: "x", role: "link" }],
    layout: { Desktop: { overflowPx: 0, smallTargets: [], tinyText: [] } }, axePassedSc: [] };
  const d = buildSiteVpatData([analysis, clean], { product: "Acme" });
  assert.equal(d.pages, 2);
  assert.equal(d.criteria.length, 55);
  assert.equal(d.criteria.find(c => c.sc === "1.1.1").conformance, "Partially Supports"); // fails on page 1
});

test("buildVpat: SECURITY — never emits auth values", () => {
  const withAuth = { ...analysis, url: "https://x.gov/pay?token=SECRET" };
  // buildVpat only receives analysis + a url; there is no auth channel, but assert the
  // known-secret string can't appear from the analysis object it's given.
  const md = buildVpat(withAuth, { url: "https://x.gov/pay" });
  assert.ok(!md.includes("SECRET"));
});

test("buildSiteVpat: aggregates findings across pages (fail on any page fails the product)", () => {
  const pageA = { ...analysis, axe: { Desktop: [{ id: "image-alt", help: "Images must have alternate text", wcag: ["wcag111"], nodes: ["img"] }] }, axePassedSc: [] };
  const pageB = { ...analysis, axe: { Desktop: [] }, headings: [{ level: 1, text: "Home" }], viewportMeta: "width=device-width",
    strict: { reflow320: 0, zoom200: 0 }, tabStops: [{ name: "Home", role: "link" }],
    layout: { Desktop: { overflowPx: 0, smallTargets: [], tinyText: [] } }, axePassedSc: ["1.4.1"] };
  const md = buildSiteVpat([pageA, pageB], { product: "Acme Site" });
  assert.match(md, /Site-wide report.*aggregating \*\*2\*\*/);
  assert.match(md, /VPAT®\) — Acme Site/);
  // 1.1.1 fails on page A -> product Partially Supports even though page B is clean
  assert.match(md, /\| 1\.1\.1 Non-text Content \| Partially Supports \|/);
  // 1.4.1 passed on page B (axe) and no page failed it -> Supports
  assert.match(md, /\| 1\.4\.1 Use of Color \| Supports \|/);
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
