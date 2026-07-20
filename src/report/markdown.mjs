// Report: analysis data -> canonical markdown.
//
// buildMarkdown(analysis, { job, plan, viewports, host, diff, emu, auth, outVideo,
//   name, format, seconds }) -> string
//
// The single source report: metadata, step-by-step script, baseline comparison,
// axe violations per viewport, layout/responsive tables, WCAG-strict checks,
// screenshots list, heading outline, keyboard-order table, and the Limitations
// section. The PDF renderer consumes this same string, so there is one report body.
//
// Auth values are NEVER included — counts only (hard invariant).
// Pure function: no browser, no file writes (caller decides whether to persist .md).
import { landmarkFindings } from "../analyze/landmarks.mjs";

// Describe a config setup step for the "setup steps applied first" list.
// SECURITY: `fill`/`select` values are the login/PII channel (e.g. a password typed
// into #password), so they are REDACTED by default — the same hard invariant that
// keeps cookies/headers out of reports. Opt a specific step back in with
// `sensitive: false` when the value is genuinely non-secret and useful to show.
const stepValue = s => s.sensitive === false ? `"${s.value ?? ""}"` : "(value redacted)";
const describeStep = s =>
  s.click ? `Click \`${s.click}\`` :
  s.fill ? `Fill \`${s.fill}\` with ${stepValue(s)}` :
  s.select ? `Select ${stepValue(s)} in \`${s.select}\`` :
  s.focus ? `Focus \`${s.focus}\`` :
  s.press ? `Press ${s.press}` :
  s.wait ? `Wait ${s.wait}ms` :
  // Never fall through to JSON.stringify(s) — it would dump a raw `value`.
  "Setup step";

export function buildMarkdown(analysis, {
  job, plan, viewports, host, diff = null, emu = {},
  auth = { cookies: [], headers: {} }, outVideo = null,
  name = "", format = "mp4", seconds = 0,
} = {}) {
  const md = [];
  md.push(`# Accessibility & Layout Audit — ${analysis.title || host}`, "",
    `- **URL:** ${job.url}`, `- **Date:** ${analysis.date}`,
    ...(outVideo ? [`- **Video:** \`${name}.${format}\` (${seconds}s, ${analysis.nvdaUsed ? "real NVDA keyboard output re-voiced + captions" : "simulated narration + captions"})`] : []),
    ...(job.steps?.length ? [`- **Page state:** ${job.steps.length} setup step${job.steps.length > 1 ? "s" : ""} applied before auditing (listed below)`] : []),
    ...((emu.colorScheme || emu.reducedMotion) ? [`- **Emulation:** ${[emu.colorScheme && `${emu.colorScheme} color scheme`, emu.reducedMotion && "reduced motion"].filter(Boolean).join(", ")} (page saw prefers-dark=${analysis.emulation?.prefersDark}, prefers-reduced-motion=${analysis.emulation?.prefersReducedMotion})`] : []),
    ...((auth.cookies.length || Object.keys(auth.headers).length) ? [`- **Auth:** ${auth.cookies.length} cookie(s), ${Object.keys(auth.headers).length} custom header(s) applied (values not recorded)`] : []),
    "",
    `## Step-by-step script (replay these steps manually with NVDA/VoiceOver for real verification)`, "");
  if (job.steps?.length) {
    md.push("**Setup steps applied first:**", "");
    job.steps.forEach((s, i) => md.push(`${i + 1}. ${describeStep(s)}`));
    md.push("", "**Audit walkthrough:**", "");
  }
  plan.forEach((s, i) => md.push(`${i + 1}. ${s.action?.type === "tab" ? "**Press Tab.** " : s.action?.type === "layout" ? `**Resize to ${s.action.vp.w}×${s.action.vp.h} and scroll the full page.** ` : ""}${s.text}`));
  if (diff) {
    md.push("", "## Baseline comparison", "",
      `Against baseline from **${diff.baselineDate}**: **${diff.added.length} new**, **${diff.fixed.length} fixed**, ${diff.unchanged} unchanged.`, "");
    if (diff.added.length) {
      md.push("**New violations:**", "");
      diff.added.forEach(x => md.push(`- \`${x.v.id}\` (${x.state}, ${x.v.impact}) — ${x.v.help}`));
      md.push("");
    }
    if (diff.fixed.length) {
      md.push("**Fixed since baseline:**", "");
      diff.fixed.forEach(x => md.push(`- \`${x.v.id}\` (${x.state}) — ${x.v.help}`));
      md.push("");
    }
  }
  md.push("", "## axe-core violations", "");
  for (const [vp, list] of Object.entries(analysis.axe)) {
    md.push(`### ${vp} width`, "");
    if (!list.length) md.push("None. ✅", "");
    else { md.push("| Rule | Impact | WCAG | Elements |", "| --- | --- | --- | --- |");
      list.forEach(v => md.push(`| ${v.id} — ${v.help} | ${v.impact} | ${v.wcag.join(", ") || "best practice"} | ${v.nodes.slice(0, 4).map(n => `\`${n}\``).join("<br>")} |`)); md.push(""); }
  }
  md.push("## Layout / responsive checks", "",
    analysis.viewportMeta
      ? `Viewport meta: \`${analysis.viewportMeta}\` ✅`
      : `Viewport meta: **missing** — the page will not reflow on mobile (WCAG 1.4.10) ❌`, "");
  for (const vp of viewports) {
    const L = analysis.layout[vp.label];
    md.push(`### ${vp.label} ${vp.w}×${vp.h}`, "",
      "| Check | Result | Details |", "| --- | --- | --- |",
      `| Horizontal overflow (WCAG 1.4.10 Reflow) | ${L.overflowPx > 1 ? `❌ ${L.overflowPx}px wider than viewport` : "✅ none"} | ${L.overflowing.map(o => `\`${o.el}\` (+${o.px}px)`).join("<br>") || "—"} |`,
      `| Interactive targets ≥ 24px (WCAG 2.5.8) | ${L.smallTargets.length ? `❌ ${L.smallTargets.length} too small` : "✅ all pass"} | ${L.smallTargets.map(s2 => `\`${s2.el}\` (${s2.size})`).join("<br>") || "—"} |`,
      `| Text ≥ 12px | ${L.tinyText.length ? `⚠ ${L.tinyText.length} below 12px` : "✅ all pass"} | ${L.tinyText.map(x => `\`${x.el}\` (${x.px}px)`).join("<br>") || "—"} |`, "");
  }
  md.push("### WCAG-strict checks", "",
    "| Check | Result |", "| --- | --- |",
    `| Reflow at exactly 320 CSS px (WCAG 1.4.10) | ${analysis.strict.reflow320 ? `❌ overflows by ${analysis.strict.reflow320}px` : "✅ no horizontal scroll"} |`,
    `| 200% zoom, 1280px window → 640px equivalent (WCAG 1.4.4/1.4.10) | ${analysis.strict.zoom200 ? `❌ overflows by ${analysis.strict.zoom200}px` : "✅ no horizontal scroll"} |`,
    `| Keyboard trap (WCAG 2.1.2), full-page tab cycle | ${analysis.keyboardTrap.status === "trap" ? `❌ focus stuck on \`${analysis.keyboardTrap.at}\` after ${analysis.keyboardTrap.stops} tabs` : `✅ none (${analysis.keyboardTrap.stops} stops traversed)`} |`, "");
  if (analysis.screenshots?.length) {
    md.push("## Screenshots", "",
      "Full-page captures per viewport; offending elements are outlined in red.", "");
    analysis.screenshots.forEach(s => md.push(`- \`${s.file}\` — ${s.viewport}, ${s.marked} element${s.marked === 1 ? "" : "s"} highlighted`));
    md.push("");
  }
  md.push("## Headings", "", ...analysis.headings.map(h => `${"  ".repeat(h.level - 1)}- h${h.level}: ${h.text}`), "");
  if (analysis.landmarks) {
    const { counts, issues } = landmarkFindings(analysis.landmarks);
    md.push("## Landmarks", "");
    if (!analysis.landmarks.length) md.push("No ARIA landmark regions found — the page offers no `banner`/`nav`/`main`/`contentinfo` structure for assistive-technology navigation (WCAG 1.3.1 / 2.4.1). ❌", "");
    else {
      md.push("| Role | Accessible name | Element |", "| --- | --- | --- |",
        ...analysis.landmarks.map(l => `| ${l.role} | ${l.label ? l.label.replace(/\|/g, "\\|") : "*(none)*"} | \`<${l.tag}>\` |`), "",
        `Roles present: ${Object.entries(counts).filter(([, n]) => n > 0).map(([r, n]) => `${r} ×${n}`).join(", ") || "none"}.`, "");
    }
    if (issues.length) { md.push("**Landmark issues:**", "", ...issues.map(i => `- ${i.level === "serious" ? "❌" : "⚠"} ${i.msg}`), ""); }
    else if (analysis.landmarks.length) md.push("No landmark-structure issues detected. ✅", "");
  }
  md.push("## Keyboard order (first tab stops)", "",
    analysis.nvdaUsed
      ? "| # | Simulated (approximation) | NVDA announced |"
      : "| # | Announced as |",
    analysis.nvdaUsed ? "| --- | --- | --- |" : "| --- | --- |",
    ...analysis.tabStops.map((s, i) => analysis.nvdaUsed
      ? `| ${i + 1} | ${s.name || "*(unnamed)*"}, ${s.role} | ${s.nvda ? String(s.nvda).replace(/\|/g, "\\|") : "*(silence — investigate)*"} |`
      : `| ${i + 1} | ${s.name || "*(unnamed — WCAG 4.1.2 failure)*"}, ${s.role} |`),
    "",
    "## Limitations", "",
    analysis.nvdaUsed
      ? "- Keyboard announcements are the **real output of NVDA**, captured from its speech log and re-voiced by synthesized speech in the video. Non-keyboard sections (axe, layout) remain automated checks."
      : "- The narration is **simulated** (synthesized voice reading the page's ARIA + axe output). It is not evidence of real screen-reader behavior — replay the steps above with NVDA (Windows) and VoiceOver (iOS) for compliance testing.",
    "- axe cannot inspect cross-origin iframes (hosted payment fields, embeds); pages with a strict CSP may block the scan entirely (reported as `scan-failed`).",
    "- Accessible names in the keyboard walk are approximated; the browser's real accessibility tree is authoritative.", "");
  return md.join("\n");
}
