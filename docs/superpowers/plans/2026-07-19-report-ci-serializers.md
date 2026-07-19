# CI Report Serializers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `buildSarif` into `src/report/sarif.mjs` and `buildJunit` into `src/report/junit.mjs` as pure serializers (analysis data → object/string, no file writes), with unit tests.

**Architecture:** Faithful extraction from `docs/_source-monolith.mjs.txt` (SARIF 861–892, JUnit 895–913), dropping the `if (job.sarif/junit)` gate and the file write — the functions return the object/string and the caller (`runAudit`, a later slice) persists them. Pure, browser-free, unit-testable.

**Tech Stack:** Node.js ≥ 20, ESM, `node:test` + `node:assert/strict`. No new dependencies.

## Global Constraints

- ESM only.
- `report/*` never open a browser. These two do NO file writes — they return values; the caller writes files.
- **Security invariant:** auth values never appear in a report. These serializers read only `analysis.*` findings and the page `url` — never cookies/headers.
- Port logic VERBATIM. Do NOT change: the impact→SARIF-level map, the `message.text` format `"<help> [<state> width]"`, the SARIF driver name/version strings, the empty-state `axe scan` testcase, the `failures` counting, or the `xmlEsc` escape set.
- The SARIF driver name `"a11y-video-audit"` and the JUnit testsuite `name` prefix `"a11y-video-audit"` are ported VERBATIM from the monolith. Rebranding to "auria" is intentionally a SEPARATE future change — do not change these strings in this slice (tests assert the verbatim value).
- Tests are pure unit tests — no browser, no fixture HTML, no file I/O.
- Test runner: `node --test test/unit/report.test.mjs`; full suite `npm run test:unit`.
- Write-safety hook intermittently blocks in-project writes over a `C:`/`c:` drive-letter case mismatch — retry with the opposite case if blocked.
- Commits must NOT include any `Co-Authored-By` trailer (repo policy: only kkora). Use `git -c commit.gpgsign=false commit` if signing prompts.

---

## File Structure

- `src/report/sarif.mjs` — MODIFY. Replace stub with `LEVEL` map + `buildSarif`.
- `src/report/junit.mjs` — MODIFY. Replace stub with `xmlEsc` + `buildJunit`.
- `test/unit/report.test.mjs` — CREATE. Shared `analysis` fixture + SARIF tests (Task 1), JUnit tests appended (Task 2).

---

### Task 1: SARIF serializer

**Files:**
- Modify: `src/report/sarif.mjs`
- Create: `test/unit/report.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildSarif(analysis, { url }) -> { $schema, version, runs:[{ tool:{driver:{name,version,rules}}, results }] }`. Reads `analysis.axe` (`{ [state]: Array<{id,impact,help,wcag,nodes}> }`).

- [ ] **Step 1: Write the failing test**

Create `test/unit/report.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSarif } from "../../src/report/sarif.mjs";

const URL = "https://x.gov/pay";

// Shared fixture: one critical + one minor axe violation at Desktop, an empty Phone
// state, a strict reflow overflow, and a passing keyboard trap. The minor's help text
// carries &, ", < to exercise escaping (used by the JUnit task).
const analysis = {
  axe: {
    Desktop: [
      { id: "image-alt", impact: "critical", help: "Images must have alternate text", wcag: ["wcag2a", "wcag111"], nodes: ["img", "div > img"] },
      { id: "color-contrast", impact: "minor", help: 'Contrast & "quotes" <tag>', wcag: ["wcag2aa"], nodes: ["p.tiny"] },
    ],
    Phone: [],
  },
  strict: { reflow320: 12, zoom200: 0 },
  keyboardTrap: { status: "pass", stops: 3 },
};

test("buildSarif: schema, version, deduped rules, level mapping, url location", () => {
  const s = buildSarif(analysis, { url: URL });
  assert.equal(s.version, "2.1.0");
  assert.equal(s.$schema, "https://json.schemastore.org/sarif-2.1.0.json");
  assert.equal(s.runs[0].tool.driver.name, "a11y-video-audit"); // verbatim, rebrand later
  const rules = s.runs[0].tool.driver.rules;
  assert.deepEqual(rules.map(r => r.id).sort(), ["color-contrast", "image-alt"]);
  const results = s.runs[0].results;
  const imageAlt = results.filter(r => r.ruleId === "image-alt");
  assert.equal(imageAlt.length, 2);                       // one result per node
  assert.ok(imageAlt.every(r => r.level === "error"));    // critical -> error
  assert.equal(results.find(r => r.ruleId === "color-contrast").level, "note"); // minor -> note
  assert.match(imageAlt[0].message.text, /\[Desktop width\]$/);
  assert.equal(imageAlt[0].locations[0].physicalLocation.artifactLocation.uri, URL);
  assert.equal(imageAlt[0].locations[0].logicalLocations[0].fullyQualifiedName, "img");
});
```

The `analysis` / `URL` consts are reused by the JUnit test that Task 2 appends to this same file — no export needed.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/unit/report.test.mjs`
Expected: FAIL — `buildSarif` throws `"not implemented — scaffold"`.

- [ ] **Step 3: Implement the SARIF serializer**

Replace the entire contents of `src/report/sarif.mjs` with:

```js
// Report: axe results -> SARIF 2.1.0.
//
// buildSarif(analysis, { url }) -> object   for GitHub / Azure DevOps code scanning.
// Impact maps to SARIF level (critical/serious -> error, moderate -> warning,
// minor -> note); each axe node becomes a result location.
// Pure serialization — no file writes, no browser.

const LEVEL = { critical: "error", serious: "error", moderate: "warning", minor: "note" };

export function buildSarif(analysis, { url }) {
  const rules = new Map();
  const results = [];
  for (const [state, list] of Object.entries(analysis.axe)) {
    for (const v of list) {
      if (!rules.has(v.id)) rules.set(v.id, {
        id: v.id,
        shortDescription: { text: v.help },
        properties: { wcag: v.wcag },
      });
      for (const node of v.nodes || []) {
        results.push({
          ruleId: v.id,
          level: LEVEL[v.impact] || "warning",
          message: { text: `${v.help} [${state} width]` },
          locations: [{
            physicalLocation: { artifactLocation: { uri: url } },
            logicalLocations: [{ fullyQualifiedName: node }],
          }],
        });
      }
    }
  }
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "a11y-video-audit", version: "1.0.0", rules: [...rules.values()] } },
      results,
    }],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/unit/report.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/report/sarif.mjs test/unit/report.test.mjs
git -c commit.gpgsign=false commit -m "feat(report): port SARIF 2.1.0 serializer"
```

---

### Task 2: JUnit serializer

**Files:**
- Modify: `src/report/junit.mjs`
- Modify: `test/unit/report.test.mjs`

**Interfaces:**
- Consumes: the `analysis` + `URL` fixture exported from `test/unit/report.test.mjs` (Task 1).
- Produces:
  - `buildJunit(analysis, { url }) -> string` — JUnit XML. Reads `analysis.axe`, `analysis.strict.{reflow320,zoom200}`, `analysis.keyboardTrap.{status,at}`.

- [ ] **Step 1: Add the failing JUnit test**

In `test/unit/report.test.mjs`, add this import beside the `buildSarif` import at the top:

```js
import { buildJunit } from "../../src/report/junit.mjs";
```

And add this test AFTER the existing SARIF test (and before the trailing `export { analysis, URL }` line — or after it; the export can stay at the very bottom):

```js
test("buildJunit: testsuite counts, failure counting, xml escaping", () => {
  const xml = buildJunit(analysis, { url: URL });
  // cases: 2 axe rules (Desktop) + 1 empty 'axe scan' (Phone) + reflow/zoom/keyboard = 6
  // failures: image-alt + color-contrast + reflow-320 (12>0) = 3 (zoom 0, trap pass = clean)
  assert.match(xml, /<testsuite name="a11y-video-audit https:\/\/x\.gov\/pay" tests="6" failures="3">/);
  assert.ok(xml.includes('<testcase classname="axe.Phone" name="axe scan"/>'));
  assert.ok(xml.includes('name="reflow-320px"'));
  assert.match(xml, /overflows by 12px/);
  assert.ok(xml.includes('<testcase classname="layout" name="zoom-200pct"/>'));   // pass -> self-closing
  assert.ok(xml.includes('<testcase classname="layout" name="keyboard-trap"/>')); // pass -> self-closing
  // XML escaping of the minor rule's help string (& " <)
  assert.ok(xml.includes("&amp;"));
  assert.ok(xml.includes("&quot;quotes&quot;"));
  assert.ok(xml.includes("&lt;tag&gt;"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/unit/report.test.mjs`
Expected: FAIL on the JUnit test — `buildJunit` throws `"not implemented — scaffold"`.

- [ ] **Step 3: Implement the JUnit serializer**

Replace the entire contents of `src/report/junit.mjs` with:

```js
// Report: axe + strict checks -> JUnit XML.
//
// buildJunit(analysis, { url }) -> string   axe rules, reflow-320, zoom-200, and the
// keyboard-trap result rendered as <testcase>/<failure> for CI test dashboards.
// Pure serialization — no file writes, no browser.

const xmlEsc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildJunit(analysis, { url }) {
  const cases = [];
  for (const [state, list] of Object.entries(analysis.axe)) {
    if (!list.length) cases.push(`  <testcase classname="axe.${xmlEsc(state)}" name="axe scan"/>`);
    list.forEach(v => cases.push(
      `  <testcase classname="axe.${xmlEsc(state)}" name="${xmlEsc(v.id)}">\n` +
      `    <failure message="${xmlEsc(v.help)} (${v.impact})">${xmlEsc((v.nodes || []).join("\n"))}</failure>\n` +
      `  </testcase>`));
  }
  const strictCase = (nm, bad, detail) => bad
    ? `  <testcase classname="layout" name="${nm}">\n    <failure message="${xmlEsc(detail)}"/>\n  </testcase>`
    : `  <testcase classname="layout" name="${nm}"/>`;
  cases.push(strictCase("reflow-320px", analysis.strict.reflow320 > 0, `overflows by ${analysis.strict.reflow320}px (WCAG 1.4.10)`));
  cases.push(strictCase("zoom-200pct", analysis.strict.zoom200 > 0, `overflows by ${analysis.strict.zoom200}px (WCAG 1.4.4)`));
  cases.push(strictCase("keyboard-trap", analysis.keyboardTrap.status === "trap", `focus stuck on ${analysis.keyboardTrap.at} (WCAG 2.1.2)`));
  const failures = (cases.join("\n").match(/<failure/g) || []).length;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="a11y-video-audit ${xmlEsc(url)}" tests="${cases.length}" failures="${failures}">\n${cases.join("\n")}\n</testsuite>\n`;
}
```

- [ ] **Step 4: Run the report file + full unit suite**

Run: `node --test test/unit/report.test.mjs`
Expected: PASS (2 tests).

Run: `npm run test:unit`
Expected: PASS — prior 23 unit tests + the 2 new report tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/report/junit.mjs test/unit/report.test.mjs
git -c commit.gpgsign=false commit -m "feat(report): port JUnit XML serializer"
```

---

## Done criteria

- `src/report/sarif.mjs` exports `buildSarif` (returns the SARIF 2.1.0 object); `src/report/junit.mjs` exports `buildJunit` (returns the XML string). Both pure — no file writes, no browser, no auth values.
- Ported verbatim — driver/testsuite name strings unchanged (`a11y-video-audit`).
- `test/unit/report.test.mjs` covers SARIF (schema, dedupe, level mapping, url location) and JUnit (counts, failure counting, escaping).
- `npm run test:unit` green; `npm run test:integration` unaffected.
- Markdown/PDF/screenshot reporters remain stubs (next slices, after headings + narration land).
