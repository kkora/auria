// Integration tests: run the analyzers against test/fixtures/broken-page.html and
// assert each intended defect is caught. Requires a Playwright browser (Edge/Chrome).
//
// Written against the target module interfaces; skipped until the analyzers are
// ported. Remove the `{ skip }` options as each module lands.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = pathToFileURL(path.join(HERE, "..", "fixtures", "broken-page.html")).href;

const PENDING = { skip: "analyzers not yet ported (scaffold)" };

// import { chromium } from "playwright-core";
// import { runLayout } from "../../src/analyze/layout.mjs";
// import { runStrict } from "../../src/analyze/strict.mjs";

test("layout: detects horizontal overflow on the broken fixture", PENDING, async () => {
  // const page = await openFixture(FIXTURE);
  // const layout = await runLayout(page, VIEWPORTS);
  // assert.ok(layout.Phone.overflowPx > 1, "expected phone-width overflow");
  assert.ok(FIXTURE);
});

test("strict: reflow320 reports overflow on the broken fixture", PENDING, async () => {
  // const page = await openFixture(FIXTURE);
  // const strict = await runStrict(page);
  // assert.ok(strict.reflow320 > 0);
  assert.ok(true);
});
