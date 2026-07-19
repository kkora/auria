// End-to-end integration: runAudit against the local broken fixture produces all the
// analysis-only artifacts. Self-skips when no Edge/Chrome is available.
import { test } from "node:test";
import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchBrowser } from "../helpers/browser.mjs";
import { runAudit } from "../../src/index.mjs";

const FIXTURE = new URL("../fixtures/broken-page.html", import.meta.url).href;

// Probe for a browser (runAudit launches its own); skip the whole suite if none.
const probe = await launchBrowser();
if (probe) await probe.close();
const opts = probe ? {} : { skip: "no Edge/Chrome available" };

const exists = async p => { try { await access(p); return true; } catch { return false; } };

test("runAudit: analysis-only run emits axe.json, md, pdf, sarif, junit", opts, async () => {
  const out = path.join(os.tmpdir(), `auria-e2e-${process.pid}`);
  try {
    const r = await runAudit({
      url: FIXTURE, out, name: "broken",
      video: false, md: true, sarif: true, junit: true,
    });
    assert.ok(r.violations > 0, "broken fixture has axe violations");
    // file:// has no hostname -> host folder "site"
    const dir = path.join(out, "site", "broken");
    assert.equal(r.outDir, dir);
    for (const f of ["broken-axe.json", "broken-report.md", "broken-report.pdf", "broken.sarif", "broken-junit.xml"]) {
      assert.ok(await exists(path.join(dir, f)), `expected ${f}`);
    }
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("runAudit: fail-on breaches when violations exist on the broken fixture", opts, async () => {
  const out = path.join(os.tmpdir(), `auria-e2e-failon-${process.pid}`);
  try {
    const r = await runAudit({ url: FIXTURE, out, name: "broken", video: false, pdf: false, failOn: "minor" });
    assert.equal(r.failOnBreached, true, "any violation is >= minor -> breach");
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("runAudit: --nvda surfaces install guidance when NVDA is unavailable", opts, async () => {
  const out = path.join(os.tmpdir(), `auria-e2e-nvda-${process.pid}`);
  const prev = process.env.GUIDEPUP_NVDA_UNAVAILABLE;
  process.env.GUIDEPUP_NVDA_UNAVAILABLE = "1";
  try {
    await assert.rejects(
      () => runAudit({ url: FIXTURE, out, name: "broken", video: false, pdf: false, nvda: true }),
      e => /NVDA mode requested but not available/.test(e.message) && /npx @guidepup\/setup/.test(e.message),
    );
  } finally {
    if (prev === undefined) delete process.env.GUIDEPUP_NVDA_UNAVAILABLE;
    else process.env.GUIDEPUP_NVDA_UNAVAILABLE = prev;
    await rm(out, { recursive: true, force: true });
  }
});
