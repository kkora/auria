// Tests for the dashboard: pure renderer + tree scan/write (fs only, no browser).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { collectRows, renderDashboard, writeDashboards } from "../../src/dashboard.mjs";

const rows = [
  { host: "example.com", page: "pay", date: "2026-07-19", url: "https://example.com/pay", viol: 3, layoutIssues: 0,
    vpat: { supports: 9, partiallySupports: 4, doesNotSupport: 1, notEvaluated: 41 }, artifacts: ["pay-report.pdf", "pay-vpat.pdf"] },
  { host: "example.com", page: "home", date: "2026-07-19", url: "https://example.com/", viol: 0, layoutIssues: 2, vpat: null, artifacts: [] },
];

test("renderDashboard: chips reflect counts, links + host shown, date injected", () => {
  const html = renderDashboard(rows, (r, f) => `${r.page}/${f}`, true, "2026-07-19");
  assert.ok(html.includes("Generated 2026-07-19 · 2 pages audited"));
  assert.ok(html.includes('<span class="chip bad">3 violations</span>'));   // pay has violations
  assert.ok(html.includes('<span class="chip ok">0 issues</span>'));        // pay has no layout issues
  assert.ok(html.includes('<span class="chip bad">2 issues</span>'));       // home has layout issues
  assert.ok(html.includes('<a href="pay/pay-report.pdf">pdf</a>'));         // artifact link + label
  assert.ok(html.includes('<a href="pay/pay-vpat.pdf">vpat</a>'));          // vpat link disambiguated from report pdf
  assert.ok(html.includes('<div class="host">example.com</div>'));          // showHost subtitle
  assert.ok(html.includes(">—<"), "a page with no artifacts shows a dash");
  // Conformance column: failing = partial (4) + does-not-support (1) = 5; muted line notes not-evaluated
  assert.ok(html.includes('<span class="chip bad">5 failing</span>'));
  assert.ok(html.includes('<div class="muted">41 not evaluated</div>'));
  assert.equal((html.match(/<th>Conformance<\/th>/g) || []).length, 1);
});

test("renderDashboard: escapes html in fields", () => {
  const html = renderDashboard(
    [{ host: "h", page: "<x>", date: "", url: 'a"b', viol: 0, layoutIssues: 0, artifacts: [] }],
    () => "#", false, "2026-07-19");
  assert.ok(html.includes("&lt;x&gt;"));
  assert.ok(html.includes("a&quot;b"));
});

test("collectRows + writeDashboards: scans an output tree and writes indexes", async () => {
  const base = path.join(os.tmpdir(), `auria-dash-${process.pid}`);
  const dir = path.join(base, "example.com", "pay");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "pay-axe.json"), JSON.stringify({
    url: "https://example.com/pay", date: "2026-07-19",
    axe: { Desktop: [{ id: "image-alt" }], Phone: [] },
    layout: { Phone: { overflowPx: 2000, smallTargets: [{}], tinyText: [] } },
  }));
  await writeFile(path.join(dir, "pay-report.pdf"), "%PDF-stub");
  await writeFile(path.join(dir, "pay-vpat.json"), JSON.stringify({
    format: "VPAT-2", summary: { supports: 9, partiallySupports: 4, doesNotSupport: 1, notEvaluated: 41, total: 55 },
  }));
  await writeFile(path.join(dir, "pay-vpat.pdf"), "%PDF-vpat-stub");
  try {
    const rowsFound = await collectRows(base);
    assert.equal(rowsFound.length, 1);
    assert.equal(rowsFound[0].viol, 1);           // one axe violation
    assert.equal(rowsFound[0].layoutIssues, 2);   // overflow (1) + one small target (1)
    assert.deepEqual(rowsFound[0].vpat, { supports: 9, partiallySupports: 4, doesNotSupport: 1, notEvaluated: 41, total: 55 });
    assert.deepEqual(rowsFound[0].artifacts, ["pay-report.pdf", "pay-vpat.pdf"]);

    const written = await writeDashboards(base);
    assert.equal(written.length, 2);              // global + one per-host
    const global = await readFile(path.join(base, "index.html"), "utf8");
    assert.ok(global.includes("example.com/pay/pay-report.pdf")); // global links reach down
    const perHost = await readFile(path.join(base, "example.com", "index.html"), "utf8");
    assert.ok(perHost.includes("pay/pay-report.pdf"));            // per-host links are shallower
    assert.ok(!perHost.includes('<div class="host">'));          // host subtitle hidden per-host
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("writeDashboards: returns null for an empty/absent tree", async () => {
  const empty = path.join(os.tmpdir(), `auria-dash-empty-${process.pid}`);
  assert.equal(await writeDashboards(empty), null);
});
