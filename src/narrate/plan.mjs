// Narration planner: analysis data -> ordered narration script.
//
// buildNarration(analysis, { viewports, host, diff, scrollMs }) -> plan[]  where each
//   entry is { text, pad, action } and action is null | { type: "tab" } | { type: "layout", vp }.
//
// The plan drives BOTH the report's step-by-step script and the recorded video, so
// they always describe the same page state. Pure function of the analysis object —
// no browser, no TTS, no I/O. Auth values are never referenced.

const SCROLL_MS = 7000;

export function buildNarration(analysis, { viewports, host, diff = null, scrollMs = SCROLL_MS } = {}) {
  const plan = [];
  const say = (text, pad = 700, action = null) => plan.push({ text, pad, action });

  say(analysis.nvdaUsed
    ? `Accessibility review of ${analysis.title || host}. Keyboard announcements in this video are the real output of the NVDA screen reader, re-voiced by synthesized speech.`
    : `Accessibility and layout review of ${analysis.title || host}. This narration is simulated: a synthesized voice reads the page's accessibility markup and automated test results. It is not a real screen reader.`, 800);

  for (const vpLabel of Object.keys(analysis.axe)) {
    const v = analysis.axe[vpLabel];
    if (!v.length) say(`The automated axe scan at ${vpLabel} width found zero violations.`);
    else say(`The automated axe scan at ${vpLabel} width found ${v.length} violation${v.length > 1 ? "s" : ""}: ${v.slice(0, 3).map(x => x.id.replace(/-/g, " ")).join("; ")}${v.length > 3 ? "; and more" : ""}.`, 900);
  }

  if (diff)
    say(`Compared with the baseline from ${diff.baselineDate}: ${diff.added.length} new violation${diff.added.length === 1 ? "" : "s"}, ${diff.fixed.length} fixed, ${diff.unchanged} unchanged.`, 800);

  const h1 = analysis.headings.find(h => h.level === 1);
  say(h1
    ? `The page has ${analysis.headings.length} headings. The main heading is: ${h1.text}.`
    : `The page has ${analysis.headings.length} headings, but no level-one heading — screen reader users lose their main anchor.`, 800);

  say(`Now walking the keyboard order. Each press of Tab is announced the way a screen reader would.`, 500);
  analysis.tabStops.forEach(s =>
    say(analysis.nvdaUsed
      ? `Tab. NVDA says: ${s.nvda || "nothing — silence on this stop"}.`
      : `Tab. ${s.name || "unnamed element"}, ${s.role}.${s.name ? "" : " An unnamed control is a WCAG 4.1.2 failure."}`,
      400, { type: "tab" }));

  if (!analysis.viewportMeta)
    say(`Warning: the page has no viewport meta tag, so it will not reflow on mobile devices. This fails WCAG 1.4.10, reflow.`, 800);

  say(`Strict reflow checks. At exactly 320 pixels wide, ${analysis.strict.reflow320
    ? `content overflows by ${analysis.strict.reflow320} pixels — failing WCAG 1.4.10`
    : `the page reflows with no horizontal scrolling`}. At 200 percent zoom, ${analysis.strict.zoom200
    ? `content overflows by ${analysis.strict.zoom200} pixels`
    : `the layout holds with no horizontal scrolling`}.`, 800);

  say(analysis.keyboardTrap.status === "trap"
    ? `Keyboard trap detected: after ${analysis.keyboardTrap.stops} tab presses, focus is stuck on ${analysis.keyboardTrap.at.replace(/[#@]/g, " ")}. This fails WCAG 2.1.2, no keyboard trap.`
    : `No keyboard trap: focus moved freely through all ${analysis.keyboardTrap.stops} tab stops.`, 700);

  for (const vp of viewports) {
    const L = analysis.layout[vp.label];
    const verdict = [];
    verdict.push(L.overflowPx > 1
      ? `Horizontal overflow of ${L.overflowPx} pixels — content is wider than the screen`
      : `No horizontal scrolling`);
    if (L.smallTargets.length)
      verdict.push(`${L.smallTargets.length} interactive target${L.smallTargets.length > 1 ? "s" : ""} smaller than the 24 pixel minimum`);
    else if (vp.label === "Phone")
      verdict.push(`all interactive targets meet the 24 pixel minimum`);
    if (L.tinyText.length) verdict.push(`${L.tinyText.length} element${L.tinyText.length > 1 ? "s" : ""} with text under 12 pixels`);
    say(`${vp.label} layout, ${vp.w} by ${vp.h}. ${verdict.join(". ")}. Scrolling the full page.`, scrollMs, { type: "layout", vp });
  }
  say(`End of review. Full findings are in the accompanying report.`, 1200);

  return plan;
}
