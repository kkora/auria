// Analyzer: keyboard order walk + keyboard-trap detection.
//
// walkTabOrder(page, { maxTabs, nvda }) -> tabStops[]  { name, role, nvda? }
//   Tabs through the page capturing each stop's accessible name + role. With an NVDA
//   driver (opts.nvda), presses are issued through it and its spoken phrase is captured
//   per stop; otherwise names/roles are approximated from the DOM.
//
// detectKeyboardTrap(page) -> { status: "pass"|"trap", at?, stops }
//   Tabs the whole page (WCAG 2.1.2); if focus stops moving, users are trapped.
//
// Pure inspector aside from the optional NVDA driver passed in. No Windows import here.

export async function walkTabOrder(page, { maxTabs = 25, nvda = null } = {}) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  if (nvda) await page.bringToFront();
  const tabStops = [];
  for (let i = 0; i < maxTabs; i++) {
    let nvdaPhrase = null;
    if (nvda) {
      await nvda.clearSpokenPhraseLog();
      await nvda.press("Tab");            // NVDA presses the key → speech reflects real focus
      await page.waitForTimeout(600);     // let speech settle
      nvdaPhrase = (await nvda.spokenPhraseLog()).join(" ").replace(/\s+/g, " ").trim() || null;
      if (nvdaPhrase != null && nvdaPhrase.length > 300) nvdaPhrase = `${nvdaPhrase.slice(0, 300)}…`;
    } else {
      await page.keyboard.press("Tab");
    }
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const byId = id => document.getElementById(id)?.textContent.trim();
      let nm = el.getAttribute("aria-label")
        || (el.getAttribute("aria-labelledby") || "").split(/\s+/).map(byId).filter(Boolean).join(" ")
        || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent.trim())
        || (/^(BUTTON|A|SUMMARY)$/.test(el.tagName) && el.textContent.trim())
        || el.getAttribute("alt") || el.getAttribute("title") || el.getAttribute("placeholder") || "";
      const role = el.getAttribute("role")
        || ({ A: "link", BUTTON: "button", SELECT: "combo box", TEXTAREA: "edit" }[el.tagName]
        || (el.tagName === "INPUT" ? ({ radio: "radio button", checkbox: "check box", submit: "button" }[el.type] || "edit") : el.tagName.toLowerCase()));
      const req = el.getAttribute("aria-required") === "true" || el.required ? ", required" : "";
      return { name: nm.replace(/\s+/g, " ").slice(0, 70), role: role + req };
    });
    if (!info) break;
    if (tabStops.length && tabStops[0].name === info.name && tabStops[0].role === info.role) break;
    tabStops.push({ ...info, ...(nvdaPhrase != null && { nvda: nvdaPhrase }) });
  }
  if (nvda && !tabStops.length)
    throw new Error("NVDA walk captured no tab stops — the browser window likely lost OS focus during the walk. Keep the headed browser window foreground while --nvda runs.");
  return tabStops;
}

export async function detectKeyboardTrap(page) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const focusSig = () => page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const idx = [...document.querySelectorAll(el.tagName)].indexOf(el);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}@${idx}`;
  });
  let first = null, prev = null, same = 0, total = 0, trapAt = null;
  for (let i = 0; i < 300; i++) {
    await page.keyboard.press("Tab");
    const s = await focusSig();
    total++;
    if (s === prev) {
      // Repeats never count as a completed cycle — a trapped element can be the
      // first stop when tabbing resumes mid-page.
      same++;
      if (same >= 3) { trapAt = s; break; }
      continue;
    }
    same = 0;
    if (i === 0) first = s;
    else if (s === first || s === "BODY") break; // full cycle completed
    prev = s;
  }
  return trapAt ? { status: "trap", at: trapAt, stops: total } : { status: "pass", stops: total };
}
