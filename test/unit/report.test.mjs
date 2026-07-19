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
