#!/usr/bin/env node
// Auria CLI entry point.
//
// Responsibility: parse argv / --config into a normalized job list, then hand off to
// the engine. NO audit logic lives here — it belongs in src/. Usage errors thrown by
// the parser (tagged `.usage`) print the message and exit 1; the engine's exit code
// (0 ok, 1 all failed, 2 fail-on breach) is propagated.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCli, parseConfigFile } from "../src/config.mjs";
import { runJobs } from "../src/index.mjs";

try {
  const { jobs: cliJobs, crawlOpts, configPath } = parseCli(process.argv.slice(2));

  let jobs = cliJobs;
  let crawl = crawlOpts;
  if (configPath) {
    let cfg;
    try { cfg = JSON.parse(await readFile(path.resolve(configPath), "utf8")); }
    catch (e) { console.error(`Cannot read config ${configPath}: ${e.message}`); process.exit(1); }
    ({ jobs, crawl } = parseConfigFile(cfg));
  }

  // Crawl expansion (discoverPages) is not wired yet — audit the given seed(s) only.
  if (crawl) console.error("Note: --crawl / config crawl is not available in this build yet — auditing the seed page(s) only.");

  process.exit(await runJobs(jobs));
} catch (e) {
  if (e && e.usage) { console.error(e.message); process.exit(1); }
  console.error(`auria: ${e?.message || e}`);
  process.exit(1);
}
