// Auria engine — library entry point.
//
// Public interface (to be implemented during the port):
//   runAudit(job)  -> Promise<Result>   audit one page, emit its artifacts
//   runJobs(jobs)  -> Promise<exitCode>  run every job, write dashboards, aggregate
//
// runAudit orchestrates the phases in order:
//   1. crawl expansion (src/crawl.mjs) — done upstream in runJobs, per seed
//   2. analyze/*  — axe, layout, strict, keyboard  -> analysis object
//   3. narrate/plan  — analysis -> narration script
//   4. record        — narrate + record + mux (skipped with --no-video)
//   5. report/*      — markdown, pdf, sarif, junit, screenshots
//   6. dashboard     — regenerate global + per-host index.html (in runJobs)
//
// Keep this file thin: it wires modules together, it does not contain audit logic.

// TODO(port): implement runAudit / runJobs by composing the modules below.
export async function runAudit(/* job */) {
  throw new Error("not implemented — scaffold");
}

export async function runJobs(/* jobs */) {
  throw new Error("not implemented — scaffold");
}
