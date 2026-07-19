#!/usr/bin/env node
// Auria CLI entry point.
//
// Responsibility: parse argv / --config into a normalized job list, then hand off
// to the engine. NO audit logic lives here — that belongs in src/.
//
// TODO(port): move the arg-parsing block from the original monolith
//   (tools/a11y-video-audit.mjs, the "CLI" + "Build the job list" sections) into
//   src/config.mjs, then call:
//
//     import { parseCli } from "../src/config.mjs";
//     import { runJobs } from "../src/index.mjs";
//     const jobs = await parseCli(process.argv.slice(2));
//     process.exit(await runJobs(jobs));

console.error("auria: scaffold only — not yet wired up. See docs/PLAN.md.");
process.exit(1);
