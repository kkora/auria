// End-to-end integration: runAudit against the local broken fixture produces all the
// analysis-only artifacts. Self-skips when no Edge/Chrome is available.
import { test } from "node:test";
import assert from "node:assert/strict";
import { access, rm, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchBrowser } from "../helpers/browser.mjs";
import { runAudit, runJobs } from "../../src/index.mjs";

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
      video: false, md: true, sarif: true, junit: true, vpat: true,
    });
    assert.ok(r.violations > 0, "broken fixture has axe violations");
    // file:// has no hostname -> host folder "site"
    const dir = path.join(out, "site", "broken");
    assert.equal(r.outDir, dir);
    for (const f of ["broken-axe.json", "broken-report.md", "broken-report.pdf", "broken.sarif", "broken-junit.xml"]) {
      assert.ok(await exists(path.join(dir, f)), `expected ${f}`);
    }
    // --vpat wiring: the draft conformance report is written
    assert.ok(await exists(path.join(dir, "broken-vpat.md")), "expected the VPAT report");
    const vpat = await readFile(path.join(dir, "broken-vpat.md"), "utf8");
    assert.match(vpat, /Accessibility Conformance Report/);
    assert.match(vpat, /1\.1\.1 Non-text Content \| Partially Supports/); // fixture <img> has no alt
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

test("runAudit: baseline:auto diffs against the previous run", opts, async () => {
  const out = path.join(os.tmpdir(), `auria-e2e-baseline-${process.pid}`);
  try {
    // First run writes the baseline axe.json.
    await runAudit({ url: FIXTURE, out, name: "broken", video: false, pdf: false });
    // Second run diffs against it; nothing changed, so all violations are "unchanged".
    await runAudit({ url: FIXTURE, out, name: "broken", video: false, pdf: false, md: true, baseline: "auto" });
    const md = await readFile(path.join(out, "site", "broken", "broken-report.md"), "utf8");
    assert.match(md, /## Baseline comparison/);
    assert.match(md, /\*\*0 new\*\*, \*\*0 fixed\*\*/);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("runJobs: --vpat across multiple pages writes one site-wide VPAT", opts, async () => {
  const out = path.join(os.tmpdir(), `auria-e2e-sitevpat-${process.pid}`);
  const crawlA = new URL("../fixtures/crawl-a.html", import.meta.url).href;
  try {
    const code = await runJobs([
      { url: FIXTURE, out, name: "p1", video: false, pdf: false, vpat: true },
      { url: crawlA, out, name: "p2", video: false, pdf: false, vpat: true },
    ]);
    assert.equal(code, 0);
    // both file:// pages share host "site" -> one aggregated report at <base>/site/
    const site = await readFile(path.join(out, "site", "site-vpat.md"), "utf8");
    assert.match(site, /Site-wide report.*aggregating \*\*2\*\*/);
    assert.match(site, /1\.1\.1 Non-text Content \| Partially Supports/); // broken fixture <img>
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("runJobs: exit code 0 when all pass, 2 on fail-on breach, 1 when all fail", opts, async () => {
  const out = path.join(os.tmpdir(), `auria-e2e-jobs-${process.pid}`);
  try {
    assert.equal(await runJobs([{ url: FIXTURE, out, name: "ok", video: false, pdf: false }]), 0);
    assert.equal(await runJobs([{ url: FIXTURE, out, name: "gate", video: false, pdf: false, failOn: "minor" }]), 2);
    // an unreachable URL makes the only job fail -> exit 1
    assert.equal(await runJobs([{ url: "file:///no/such/auria-missing.html", out, name: "bad", video: false, pdf: false }]), 1);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
