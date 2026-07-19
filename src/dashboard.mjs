// Dashboards: scan the out-base tree -> global + per-host index.html.
//
// writeDashboards(base) -> writtenPaths[]
//   collectRows(base)     : read every <host>/<page>/*-axe.json into rows with
//                           axe + layout issue counts and the artifacts that exist.
//   renderDashboard(rows, hrefFor, showHost) : rows -> HTML (pass/fail chips + links).
//   Writes index.html at the out-base (all hosts) and inside each host folder.
//
// Regenerated at the end of every run, so dashboards accumulate across runs.
// Reads files + writes HTML; no browser.

// TODO(port): move collectRows, renderDashboard, writeDashboards here.

export async function writeDashboards(/* base */) {
  throw new Error("not implemented — scaffold");
}
