import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, slugFromUrl } from "../../src/config.mjs";

test("slugify: root/empty path becomes 'home'", () => {
  assert.equal(slugify("/"), "home");
  assert.equal(slugify(""), "home");
});

test("slugify: strips extension and lowercases", () => {
  assert.equal(slugify("/Checkout.HTML"), "checkout");
});

test("slugify: collapses non-alphanumerics to single dashes", () => {
  assert.equal(slugify("/pay/step 2"), "pay-step-2");
});

test("slugFromUrl: no query -> pathname slug", () => {
  assert.equal(slugFromUrl("https://x.gov/forms/apply"), "forms-apply");
});

test("slugFromUrl: query string disambiguates so pages don't collide", () => {
  const a = slugFromUrl("https://x.gov/list?id=1");
  const b = slugFromUrl("https://x.gov/list?id=2");
  assert.notEqual(a, b, "different queries must map to different folders");
  assert.equal(a, slugFromUrl("https://x.gov/list?id=1"), "same URL is stable (for baselines)");
  assert.match(a, /^list-[0-9a-f]{8}$/);
});

import { normalizeAuth } from "../../src/config.mjs";

test("normalizeAuth: undefined auth yields empty structures", () => {
  assert.deepEqual(normalizeAuth(undefined, "https://x.gov/"), { cookies: [], headers: {} });
});

test("normalizeAuth: string cookies split into scoped objects", () => {
  const { cookies } = normalizeAuth({ cookies: "a=1; b=2" }, "https://x.gov/");
  assert.deepEqual(cookies, [
    { name: "a", value: "1", url: "https://x.gov/" },
    { name: "b", value: "2", url: "https://x.gov/" },
  ]);
});

test("normalizeAuth: array cookies get url only when domain/url absent", () => {
  const { cookies } = normalizeAuth({
    cookies: [
      { name: "s", value: "x" },
      { name: "d", value: "y", domain: ".x.gov" },
    ],
  }, "https://x.gov/");
  assert.deepEqual(cookies, [
    { name: "s", value: "x", url: "https://x.gov/" },
    { name: "d", value: "y", domain: ".x.gov" },
  ]);
});

test("normalizeAuth: headers pass through, default empty", () => {
  assert.deepEqual(normalizeAuth({ headers: { A: "b" } }, "https://x.gov/").headers, { A: "b" });
  assert.deepEqual(normalizeAuth({ cookies: "a=1" }, "https://x.gov/").headers, {});
});

import { parseConfigFile } from "../../src/config.mjs";
import { readFile } from "node:fs/promises";

test("parseConfigFile: per-page value overrides config default", () => {
  const { jobs } = parseConfigFile({
    tabs: 10,
    pages: [{ url: "https://x.gov/a", tabs: 14 }, { url: "https://x.gov/b" }],
  });
  assert.equal(jobs[0].tabs, 14); // per-page wins
  assert.equal(jobs[1].tabs, 10); // falls back to config
});

test("parseConfigFile: out honors per-page override, then top-level config", () => {
  const { jobs } = parseConfigFile({
    out: "top", pages: [{ url: "https://x.gov/a", out: "per-page" }, { url: "https://x.gov/b" }],
  });
  assert.equal(jobs[0].out, "per-page"); // per-page wins
  assert.equal(jobs[1].out, "top");      // falls back to config
});

test("parseConfigFile: passes crawl through, defaults to null", () => {
  assert.equal(parseConfigFile({ pages: [{ url: "https://x.gov/" }] }).crawl, null);
  assert.deepEqual(
    parseConfigFile({ crawl: { maxPages: 5 }, pages: [{ url: "https://x.gov/" }] }).crawl,
    { maxPages: 5 }
  );
});

test("parseConfigFile: throws usageError on empty pages", () => {
  assert.throws(() => parseConfigFile({ pages: [] }), e => e.usage === true);
});

test("parseConfigFile: throws usageError when a page lacks url", () => {
  assert.throws(() => parseConfigFile({ pages: [{ name: "x" }] }), e => e.usage === true);
});

test("parseConfigFile: the committed sample config parses", async () => {
  const cfg = JSON.parse(await readFile(new URL("../../examples/pages.sample.json", import.meta.url), "utf8"));
  const { jobs } = parseConfigFile(cfg);
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].name, "payment-page");
  assert.equal(jobs[0].tabs, 14); // per-page override
  assert.equal(jobs[1].tabs, 10); // config default
});

import { parseCli } from "../../src/config.mjs";

test("parseCli: --config returns the path without reading it", () => {
  const r = parseCli(["--config", "pages.json"]);
  assert.equal(r.configPath, "pages.json");
  assert.deepEqual(r.jobs, []);
});

test("parseCli: a flag value is not mistaken for the URL", () => {
  const { jobs } = parseCli(["--out", "audits", "https://x.gov/pay"]);
  assert.equal(jobs[0].url, "https://x.gov/pay"); // not "audits"
  assert.equal(jobs[0].out, "audits");
});

test("parseCli: --no-video / --md booleans", () => {
  const { jobs } = parseCli(["https://x.gov/", "--no-video", "--md"]);
  assert.equal(jobs[0].video, false);
  assert.equal(jobs[0].md, true);
});

test("parseCli: --vpat and --fail-on-regression are surfaced as booleans", () => {
  const { jobs } = parseCli(["https://x.gov/", "--vpat", "--fail-on-regression"]);
  assert.equal(jobs[0].vpat, true);
  assert.equal(jobs[0].failOnRegression, true);
});

test("parseCli: repeated cookies join and header splits on first colon", () => {
  const { jobs } = parseCli([
    "https://x.gov/", "--cookie", "a=1", "--cookie", "b=2", "--header", "Authorization: Bearer z",
  ]);
  assert.equal(jobs[0].auth.cookies, "a=1; b=2");
  assert.deepEqual(jobs[0].auth.headers, { Authorization: "Bearer z" });
});

test("parseCli: --crawl surfaces both crawl bounds", () => {
  const { crawlOpts } = parseCli(["https://x.gov/", "--crawl", "--max-pages", "5", "--max-depth", "4"]);
  assert.equal(crawlOpts.maxPages, "5");
  assert.equal(crawlOpts.maxDepth, "4");
});

test("parseCli: no URL throws usageError", () => {
  assert.throws(() => parseCli([]), e => e.usage === true);
});
