// Auria engine — library entry point.
//
//   runAudit(job)  -> Promise<Result>   audit one page, emit its artifacts
//   runJobs(jobs)  -> Promise<exitCode>  run every job, write dashboards, aggregate
//
// This slice implements the analysis-only pipeline (analyze -> reports -> dashboard).
// The narrated video (narrate/tts + record) is not wired yet; when a job requests
// video it is skipped with a warning and reports are still produced.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeAuth, slugFromUrl } from "./config.mjs";
import { launchBrowser, applySteps } from "./browser.mjs";
import { runAxe } from "./analyze/axe.mjs";
import { runLayout, readViewportMeta } from "./analyze/layout.mjs";
import { runStrict } from "./analyze/strict.mjs";
import { walkTabOrder, detectKeyboardTrap } from "./analyze/keyboard.mjs";
import { readHeadings } from "./analyze/headings.mjs";
import { readLandmarks } from "./analyze/landmarks.mjs";
import { buildNarration } from "./narrate/plan.mjs";
import { buildMarkdown } from "./report/markdown.mjs";
import { renderPdf } from "./report/pdf.mjs";
import { buildSarif } from "./report/sarif.mjs";
import { buildJunit } from "./report/junit.mjs";
import { buildVpat, buildVpatData, buildSiteVpat, buildSiteVpatData } from "./report/vpat.mjs";
import { diffVpat, renderTrendMd, pushHistory } from "./report/trend.mjs";
import { captureScreenshots } from "./report/screenshots.mjs";
import { writeDashboards } from "./dashboard.mjs";
import { recordVideo } from "./record.mjs";
import { nvdaPreflight } from "./nvda.mjs";

const VIEWPORTS = [
  { label: "Desktop", w: 1280, h: 900 },
  { label: "Tablet", w: 820, h: 1080 },
  { label: "Phone", w: 375, h: 812 },
];
const IMPACT_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4, unknown: 3 };

export async function runAudit(job) {
  const format = (job.format || "mp4").toLowerCase();
  if (!["webm", "mp4"].includes(format)) throw new Error(`format must be webm or mp4, got "${format}"`);
  const wantPdf = job.pdf !== false;
  const wantMd = job.md === true;
  const wantVideo = job.video !== false;
  const maxTabs = job.tabs != null ? Number(job.tabs) : 25; // `tabs: 0` means zero, not default
  const viewports = Array.isArray(job.viewports) && job.viewports.length
    ? job.viewports.map(v => ({ label: v.label || `${v.w}×${v.h}`, w: Number(v.w), h: Number(v.h) }))
    : VIEWPORTS;

  const emu = {};
  if (job.colorScheme) {
    if (!["dark", "light"].includes(job.colorScheme)) throw new Error(`colorScheme must be dark or light, got "${job.colorScheme}"`);
    emu.colorScheme = job.colorScheme;
  }
  if (job.reducedMotion) emu.reducedMotion = "reduce";
  const auth = normalizeAuth(job.auth, job.url);
  if (Object.keys(auth.headers).length) emu.extraHTTPHeaders = auth.headers;

  const host = new URL(job.url).hostname.replace(/[^a-z0-9.-]/gi, "_") || "site";
  const name = (job.name || slugFromUrl(job.url)).replace(/[^a-z0-9._-]/gi, "-");
  const outDir = path.resolve(job.out || "a11y-audits", host, name);
  await mkdir(outDir, { recursive: true });

  // --fail-on-regression needs a VPAT to diff against, so it implies --vpat.
  const wantVpat = !!job.vpat || !!job.failOnRegression;

  let nvdaDriver = null;
  let browser = null;
  try {
    // Preflight NVDA BEFORE launching the browser, so requesting --nvda on a machine
    // without NVDA surfaces the install guidance (not a browser-launch error) — and
    // even on a headless box, where the headed NVDA browser couldn't start anyway.
    if (job.nvda) {
      try { nvdaDriver = await nvdaPreflight(); }
      catch (e) {
        throw new Error(`NVDA mode requested but not available: ${e.message}. ` +
          `Install NVDA (nvaccess.org) and run: npx @guidepup/setup`, { cause: e });
      }
    }
    // NVDA runs headed (it reads the focused window); everything else can be headless.
    browser = await launchBrowser({ headless: job.nvda ? false : undefined });
    // ---------- analyze ----------
    const analysis = { url: job.url, date: new Date().toISOString().slice(0, 10), axe: {}, headings: [], tabStops: [], title: "", nvdaUsed: false };
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...emu });
      if (auth.cookies.length) await ctx.addCookies(auth.cookies);
      const page = await ctx.newPage();
      await page.goto(job.url, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(1500);
      await applySteps(page, job.steps);

      analysis.emulation = await page.evaluate(() => ({
        prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
        prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      }));
      analysis.title = await page.title();
      analysis.headings = await readHeadings(page);
      analysis.landmarks = await readLandmarks(page);
      // Collect axe's passed criteria too when a VPAT is requested, so criteria axe
      // tested-and-passed become a confident "Supports" (heavier, hence opt-in).
      const axeResult = await runAxe(page, viewports, { passes: wantVpat });
      analysis.axe = axeResult.byViewport;
      analysis.axePassedSc = axeResult.passedSc;
      analysis.viewportMeta = await readViewportMeta(page);
      analysis.layout = await runLayout(page, viewports);
      if (job.screenshots) analysis.screenshots = await captureScreenshots(page, analysis, { viewports, outDir, name });
      analysis.strict = await runStrict(page);
      analysis.tabStops = await walkTabOrder(page, { maxTabs, nvda: nvdaDriver });
      analysis.nvdaUsed = !!nvdaDriver;
      analysis.keyboardTrap = await detectKeyboardTrap(page);
      await ctx.close();
    }

    // ---------- baseline diff (optional) ----------
    let diff = null;
    const baselinePath = (job.baseline === true || job.baseline === "auto")
      ? path.join(outDir, `${name}-axe.json`)
      : job.baseline ? path.resolve(job.baseline) : null;
    if (baselinePath) {
      try {
        const prev = JSON.parse(await readFile(baselinePath, "utf8"));
        const flat = a => Object.entries(a.axe || {}).flatMap(([state, list]) =>
          list.map(v => ({ key: `${state}|${v.id}|${(v.nodes || []).join(",")}`, state, v })));
        const prevMap = new Map(flat(prev).map(x => [x.key, x]));
        const curMap = new Map(flat(analysis).map(x => [x.key, x]));
        diff = {
          baselineDate: prev.date || "unknown",
          added: [...curMap.values()].filter(x => !prevMap.has(x.key)),
          fixed: [...prevMap.values()].filter(x => !curMap.has(x.key)),
          unchanged: [...curMap.values()].filter(x => prevMap.has(x.key)).length,
        };
        console.log(`  baseline (${diff.baselineDate}): +${diff.added.length} new, -${diff.fixed.length} fixed, ${diff.unchanged} unchanged`);
      } catch (e) { console.error(`  baseline unreadable (${baselinePath}): ${e.message}`); }
    }

    // ---------- narration plan (drives the report's step-by-step script) ----------
    const plan = buildNarration(analysis, { viewports, host, diff });

    // ---------- video: narrate + record + mux (best-effort; never blocks reports) ----------
    let outVideo = null, seconds = null;
    if (wantVideo) {
      try {
        ({ outVideo, seconds } = await recordVideo(browser, job, { plan, analysis, emu, auth, outDir, name, format }));
      } catch (e) {
        console.error(`  Video generation failed (reports still written): ${e.message}`);
      }
    }

    // ---------- reports ----------
    await writeFile(path.join(outDir, `${name}-axe.json`), JSON.stringify(analysis, null, 2));
    const md = buildMarkdown(analysis, { job, plan, viewports, host, diff, emu, auth, outVideo, name, format, seconds });
    if (wantMd) await writeFile(path.join(outDir, `${name}-report.md`), md);
    if (wantPdf) await renderPdf(browser, md, path.join(outDir, `${name}-report.pdf`));
    if (job.sarif) await writeFile(path.join(outDir, `${name}.sarif`), JSON.stringify(buildSarif(analysis, { url: job.url }), null, 2));
    if (job.junit) await writeFile(path.join(outDir, `${name}-junit.xml`), buildJunit(analysis, { url: job.url }));
    let regressionBreached = false, regressedCount = 0;
    if (wantVpat) {
      // `vpat` may be `true` (CLI flag) or an object of VPAT metadata from the config.
      const vpatMeta = typeof job.vpat === "object" ? job.vpat : {};
      const vctx = { url: job.url, title: analysis.title, date: analysis.date, product: job.name, ...vpatMeta };
      const vpatMd = buildVpat(analysis, vctx);
      const vpatData = buildVpatData(analysis, vctx);
      const jsonPath = path.join(outDir, `${name}-vpat.json`);
      // Trend: read the previous run's VPAT (before we overwrite it) so we can diff conformance.
      let prevVpat = null;
      try { prevVpat = JSON.parse(await readFile(jsonPath, "utf8")); } catch { /* first run — no prior */ }
      await writeFile(path.join(outDir, `${name}-vpat.md`), vpatMd);
      await writeFile(jsonPath, JSON.stringify(vpatData, null, 2));
      if (wantPdf) await renderPdf(browser, vpatMd, path.join(outDir, `${name}-vpat.pdf`));
      // Conformance trend + rolling history (compliance over time).
      const diff = diffVpat(prevVpat, vpatData);
      await writeFile(path.join(outDir, `${name}-vpat-trend.md`),
        renderTrendMd(diff, { name: vpatData.product || name, date: vpatData.date, prevDate: prevVpat?.date }));
      const histPath = path.join(outDir, `${name}-vpat-history.json`);
      let history = null;
      try { history = JSON.parse(await readFile(histPath, "utf8")); } catch { /* none yet */ }
      await writeFile(histPath, JSON.stringify(
        pushHistory(history, { date: vpatData.date, url: vpatData.url, summary: vpatData.summary }), null, 2));
      if (diff.hasPrev && diff.changed)
        console.log(`  VPAT trend: ${diff.regressed.length} regressed, ${diff.fixed.length} fixed since ${prevVpat.date || "last run"}`);
      // --fail-on-regression: a conformance drop vs the previous run trips the CI gate.
      regressedCount = diff.regressed.length;
      if (job.failOnRegression && diff.hasPrev && regressedCount > 0) regressionBreached = true;
    }

    const totalV = Object.values(analysis.axe).reduce((n, v) => n + v.length, 0);
    let failOnBreached = false;
    if (job.failOn) {
      const min = IMPACT_RANK[job.failOn];
      if (!min) throw new Error(`fail-on must be minor|moderate|serious|critical, got "${job.failOn}"`);
      // A CSP-blocked scan ("scan-failed", impact "unknown") verified nothing — it must
      // not be counted as a real violation that trips the CI gate.
      failOnBreached = Object.values(analysis.axe).flat().some(v => v.id !== "scan-failed" && (IMPACT_RANK[v.impact] || 0) >= min);
    }
    return {
      outDir, outVideo, seconds, violations: totalV, tabStops: analysis.tabStops.length, pdf: wantPdf, failOnBreached, failOn: job.failOn,
      regressionBreached, regressedCount,
      // Carry the analysis for a product-level (site-wide) VPAT aggregation in runJobs.
      ...(wantVpat ? { vpat: true, host, base: path.resolve(job.out || "a11y-audits", host), analysis } : {}),
    };
  } finally {
    if (nvdaDriver) await nvdaDriver.stop().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

export async function runJobs(jobs) {
  const results = [];
  for (const job of jobs) {
    console.log(`\n=== Auditing ${job.url} ===`);
    try {
      const r = await runAudit(job);
      results.push({ url: job.url, ok: true, ...r });
      console.log(`${r.outVideo ? `  Video:  ${r.outVideo} (${r.seconds}s)\n` : ""}  Folder: ${r.outDir}\n  axe violations: ${r.violations} | tab stops: ${r.tabStops}${r.pdf ? " | PDF: yes" : ""}`);
    } catch (e) {
      results.push({ url: job.url, ok: false, error: e.message });
      console.error(`  FAILED: ${e.message}`);
    }
  }

  // Site-wide VPAT: a VPAT is a product-level document, so aggregate a host's pages into
  // one report (in addition to the per-page ones) when several pages were audited.
  const vpatByHost = {};
  for (const r of results) if (r.ok && r.vpat && r.analysis) (vpatByHost[`${r.base} ${r.host}`] ??= []).push(r);
  for (const rs of Object.values(vpatByHost)) {
    if (rs.length < 2) continue; // a single page already has its own VPAT
    const { base, host } = rs[0];
    try {
      const analyses = rs.map(r => r.analysis);
      const md = buildSiteVpat(analyses, { product: host, date: rs[0].analysis.date });
      const siteData = buildSiteVpatData(analyses, { product: host, date: rs[0].analysis.date });
      const siteJson = path.join(base, `${host}-vpat.json`);
      let prevSite = null;
      try { prevSite = JSON.parse(await readFile(siteJson, "utf8")); } catch { /* first site run */ }
      await writeFile(path.join(base, `${host}-vpat.md`), md);
      await writeFile(siteJson, JSON.stringify(siteData, null, 2));
      // Product-level conformance trend + history.
      const diff = diffVpat(prevSite, siteData);
      await writeFile(path.join(base, `${host}-vpat-trend.md`),
        renderTrendMd(diff, { name: host, date: siteData.date, prevDate: prevSite?.date }));
      const siteHist = path.join(base, `${host}-vpat-history.json`);
      let history = null;
      try { history = JSON.parse(await readFile(siteHist, "utf8")); } catch { /* none yet */ }
      await writeFile(siteHist, JSON.stringify(
        pushHistory(history, { date: siteData.date, url: siteData.url, pages: siteData.pages, summary: siteData.summary }), null, 2));
      if (rs.some(r => r.pdf)) {
        const browser = await launchBrowser();
        try { await renderPdf(browser, md, path.join(base, `${host}-vpat.pdf`)); }
        finally { await browser.close().catch(() => {}); }
      }
      console.log(`\nSite VPAT (${rs.length} pages): ${path.join(base, `${host}-vpat.md`)}`);
    } catch (e) { console.error(`Site VPAT failed for ${host}: ${e.message}`); }
  }

  const bases = [...new Set(jobs.map(j => path.resolve(j.out || "a11y-audits")))];
  for (const base of bases) {
    try {
      const written = await writeDashboards(base);
      if (written) console.log(`\nDashboard: ${written.join("\n           ")}`);
    } catch (e) { console.error(`Dashboard failed for ${base}: ${e.message}`); }
  }

  const failed = results.filter(r => !r.ok).length;
  const breached = results.filter(r => r.failOnBreached);
  const regressed = results.filter(r => r.regressionBreached);
  console.log(`\nDONE: ${results.length - failed}/${results.length} page${results.length > 1 ? "s" : ""} audited${failed ? `, ${failed} failed` : ""}.`);
  if (breached.length || regressed.length) {
    breached.forEach(r => console.error(`FAIL-ON BREACH: ${r.url} has violations at/above "${r.failOn}"`));
    regressed.forEach(r => console.error(`REGRESSION GATE: ${r.url} lost conformance on ${r.regressedCount} criteria vs the previous run`));
    return 2;
  }
  return failed && failed === results.length ? 1 : 0;
}
