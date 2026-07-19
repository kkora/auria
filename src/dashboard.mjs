// Dashboards: scan the out-base tree -> global + per-host index.html.
//
// writeDashboards(base) -> writtenPaths[] | null
//   collectRows(base)     : read every <host>/<page>/*-axe.json into rows with
//                           axe + layout issue counts and the artifacts that exist.
//   renderDashboard(rows, hrefFor, showHost, date) : rows -> HTML (chips + links).
//   Writes index.html at the out-base (all hosts) and inside each host folder.
//
// Regenerated at the end of every run, so dashboards accumulate across runs.
// Reads files + writes HTML; no browser.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const escapeHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Scan <base>/<host>/<page>/ into dashboard rows. Each row keeps the raw artifact
// filenames so links can be built with the right relative prefix per dashboard.
export async function collectRows(base) {
  let hosts;
  try { hosts = (await readdir(base, { withFileTypes: true })).filter(d => d.isDirectory()); } catch { return []; }
  const rows = [];
  for (const h of hosts) {
    let pages;
    try { pages = (await readdir(path.join(base, h.name), { withFileTypes: true })).filter(d => d.isDirectory()); } catch { continue; }
    for (const p of pages) {
      const dir = path.join(base, h.name, p.name);
      let files;
      try { files = await readdir(dir); } catch { continue; }
      const axeFile = files.find(f => f.endsWith("-axe.json"));
      if (!axeFile) continue;
      let a;
      try { a = JSON.parse(await readFile(path.join(dir, axeFile), "utf8")); } catch { continue; }
      const viol = Object.values(a.axe || {}).reduce((n, v) => n + v.length, 0);
      const layoutIssues = Object.values(a.layout || {}).reduce((n, L) =>
        n + (L.overflowPx > 1 ? 1 : 0) + (L.smallTargets?.length || 0) + (L.tinyText?.length || 0), 0);
      rows.push({
        host: h.name, page: p.name, date: a.date || "", url: a.url || "", viol, layoutIssues,
        // Only artifacts that actually exist, so the Artifacts column never shows an orphan "—".
        artifacts: [files.find(f => /\.(mp4|webm)$/.test(f)), files.find(f => f.endsWith("-report.md")),
                    files.find(f => f.endsWith("-report.pdf"))].filter(Boolean),
      });
    }
  }
  rows.sort((x, y) => x.host.localeCompare(y.host) || x.page.localeCompare(y.page));
  return rows;
}

// Render rows to dashboard HTML. `hrefFor(row, file)` builds each artifact URL relative
// to where this file lives; `showHost` adds the hostname subtitle (hidden per-host).
export function renderDashboard(rows, hrefFor, showHost, date = new Date().toISOString().slice(0, 10)) {
  const chip = (n, label) => n
    ? `<span class="chip bad">${n} ${label}</span>`
    : `<span class="chip ok">0 ${label}</span>`;
  const links = r => r.artifacts.length
    ? r.artifacts.map(f => `<a href="${hrefFor(r, f)}">${f.split(".").pop()}</a>`).join(" · ")
    : "—";
  return `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility Audit Dashboard</title>
<style>
  body{font:15px/1.5 "Segoe UI",system-ui,sans-serif;color:#0B1B33;background:#F4F6F9;margin:0;padding:2rem}
  h1{font-size:1.5rem;color:#06214A;margin:0 0 .25rem} .sub{color:#4A5A70;margin:0 0 1.5rem}
  table{border-collapse:collapse;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 2px rgb(11 27 51/.06)}
  th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #E4E9F0;vertical-align:top}
  th{background:#EDF1F6;font-size:.85rem;text-transform:uppercase;letter-spacing:.04em}
  tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8rem;font-weight:600}
  .ok{background:#E6F4EC;color:#0F6B45}.bad{background:#FDECEA;color:#B3261E}
  .host{color:#4A5A70;font-size:.85rem} a{color:#1F5FD0}
</style>
<h1>Accessibility Audit Dashboard</h1>
<p class="sub">Generated ${date} · ${rows.length} page${rows.length > 1 ? "s" : ""} audited</p>
<table>
<tr><th>Page</th><th>URL</th><th>Date</th><th>axe</th><th>Layout</th><th>Artifacts</th></tr>
${rows.map(r => `<tr>
  <td><strong>${escapeHtml(r.page)}</strong>${showHost ? `<div class="host">${escapeHtml(r.host)}</div>` : ""}</td>
  <td><a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a></td>
  <td>${escapeHtml(r.date)}</td>
  <td>${chip(r.viol, "violations")}</td>
  <td>${chip(r.layoutIssues, "issues")}</td>
  <td>${links(r)}</td>
</tr>`).join("\n")}
</table></html>`;
}

// Write the global dashboard at <base> and a per-host one inside each host folder.
export async function writeDashboards(base) {
  const rows = await collectRows(base);
  if (!rows.length) return null;
  const written = [];
  // Global: links reach down into <host>/<page>/<file>.
  const globalHref = (r, f) => `${encodeURIComponent(r.host)}/${encodeURIComponent(r.page)}/${encodeURIComponent(f)}`;
  await writeFile(path.join(base, "index.html"), renderDashboard(rows, globalHref, true));
  written.push(path.join(base, "index.html"));
  // Per-host: file sits in the host folder, so links are relative to it (<page>/<file>).
  for (const host of [...new Set(rows.map(r => r.host))]) {
    const hostHref = (r, f) => `${encodeURIComponent(r.page)}/${encodeURIComponent(f)}`;
    await writeFile(path.join(base, host, "index.html"), renderDashboard(rows.filter(r => r.host === host), hostHref, false));
    written.push(path.join(base, host, "index.html"));
  }
  return written;
}
