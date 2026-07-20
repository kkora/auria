// Unit tests for landmarkFindings — pure structure-quality checks over a landmark list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { landmarkFindings } from "../../src/analyze/landmarks.mjs";

const lm = (role, label = null, tag = role) => ({ role, label, tag });

test("landmarkFindings: a clean page (banner/nav/main/contentinfo) has no issues", () => {
  const { counts, issues } = landmarkFindings([
    lm("banner", null, "header"), lm("navigation", "Primary", "nav"), lm("main"), lm("contentinfo", null, "footer"),
  ]);
  assert.equal(counts.main, 1);
  assert.equal(counts.banner, 1);
  assert.deepEqual(issues, []);
});

test("landmarkFindings: no main landmark is a serious issue (WCAG 2.4.1)", () => {
  const { counts, issues } = landmarkFindings([lm("banner", null, "header"), lm("navigation", "Primary", "nav")]);
  assert.equal(counts.main, 0);
  assert.ok(issues.some(i => i.level === "serious" && /No main landmark/.test(i.msg)));
});

test("landmarkFindings: more than one main or banner is flagged", () => {
  const dupMain = landmarkFindings([lm("main"), lm("main")]);
  assert.ok(dupMain.issues.some(i => i.level === "serious" && /2 main landmarks/.test(i.msg)));
  const dupBanner = landmarkFindings([lm("main"), lm("banner", null, "header"), lm("banner", null, "header")]);
  assert.ok(dupBanner.issues.some(i => /2 banner landmarks/.test(i.msg)));
});

test("landmarkFindings: repeated same-role landmarks need distinguishing labels (WCAG 1.3.1)", () => {
  // two navs, both unlabeled -> can't be told apart
  const bad = landmarkFindings([lm("main"), lm("navigation", null, "nav"), lm("navigation", null, "nav")]);
  assert.ok(bad.issues.some(i => i.msg.includes("1.3.1") && /2 navigation landmarks/.test(i.msg)));
  // two navs with distinct labels -> fine
  const good = landmarkFindings([lm("main"), lm("navigation", "Primary", "nav"), lm("navigation", "Footer", "nav")]);
  assert.ok(!good.issues.some(i => /navigation landmarks/.test(i.msg)));
});

test("landmarkFindings: an empty page reports the missing main", () => {
  const { counts, issues } = landmarkFindings([]);
  assert.equal(counts.main, 0);
  assert.ok(issues.some(i => /No main landmark/.test(i.msg)));
});
