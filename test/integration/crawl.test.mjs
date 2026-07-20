// Integration test: discoverPages BFS over the local crawl fixtures.
// Self-skips when no Edge/Chrome is available.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../helpers/browser.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverPages, expandCrawl } from "../../src/crawl.mjs";

const A = new URL("../fixtures/crawl-a.html", import.meta.url).href;

// discoverPages launches its own browser; probe to decide whether to skip.
const probe = await launchBrowser();
if (probe) await probe.close();
const opts = probe ? {} : { skip: "no Edge/Chrome available" };

const basename = u => u.split("/").pop();

test("discoverPages: BFS finds all same-origin pages, skips mail/pdf", opts, async () => {
  const { pages, failed } = await discoverPages({ url: A }, { maxPages: 20, maxDepth: 3 });
  const names = pages.map(p => basename(p.url)).sort();
  assert.deepEqual(names, ["crawl-a.html", "crawl-b.html", "crawl-secret.html"]);
  assert.equal(failed.length, 0);
  // mailto: and the .pdf link were never queued (not in pages, not in failed).
});

test("discoverPages: maxDepth bounds the walk", opts, async () => {
  // depth 0 = A only, depth 1 adds B, depth 2 adds secret. Cap at depth 1.
  const { pages } = await discoverPages({ url: A }, { maxPages: 20, maxDepth: 1 });
  const names = pages.map(p => basename(p.url)).sort();
  assert.deepEqual(names, ["crawl-a.html", "crawl-b.html"]); // secret is depth 2, excluded
});

test("discoverPages: exclude filter prunes a branch", opts, async () => {
  const { pages } = await discoverPages({ url: A }, { maxPages: 20, maxDepth: 3, exclude: "secret" });
  const names = pages.map(p => basename(p.url)).sort();
  assert.deepEqual(names, ["crawl-a.html", "crawl-b.html"]); // secret excluded by regex
});

test("discoverPages: maxPages caps the total", opts, async () => {
  const { pages } = await discoverPages({ url: A }, { maxPages: 2, maxDepth: 3 });
  assert.equal(pages.length, 2);
});

test("discoverPages: include filter follows only matching links (seed always audited)", opts, async () => {
  // include only 'secret' -> from A, crawl-b (not matching) is not followed, so secret
  // (reachable only via b) is never found. A itself is the seed and always kept.
  const { pages } = await discoverPages({ url: A }, { maxPages: 20, maxDepth: 3, include: "secret" });
  const names = pages.map(p => basename(p.url)).sort();
  assert.deepEqual(names, ["crawl-a.html"]);
});

test("expandCrawl: writes crawl-map.json and one job per page inheriting the seed", opts, async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), "auria-expand-"));
  try {
    const { jobs, pages } = await expandCrawl({ url: A, out, video: false, tabs: 7 }, { maxPages: 20, maxDepth: 3 });
    assert.equal(jobs.length, pages.length);
    assert.ok(jobs.every(j => j.video === false && j.tabs === 7), "each job inherits the seed options");
    assert.ok(jobs.every(j => typeof j.name === "string" && j.name.length), "each job is named");
    const map = JSON.parse(await readFile(path.join(out, "site", "crawl-map.json"), "utf8"));
    assert.equal(map.start, A);
    assert.equal(map.pages.length, pages.length);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

after(() => {});
