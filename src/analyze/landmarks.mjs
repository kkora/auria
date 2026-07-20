// Analyzer: ARIA landmark regions.
//
// readLandmarks(page) -> [{ role, label, tag }]  the page's landmark regions in document
// order, resolving native elements to their implicit ARIA role (header->banner,
// nav->navigation, main, aside->complementary, footer->contentinfo) and explicit role=.
// A <header>/<footer> nested in a sectioning element is NOT a banner/contentinfo, per the
// HTML-AAM scoping rules; a <form>/<section> is only a landmark when it has an accessible
// name. Hidden regions are skipped.
//
// landmarkFindings(landmarks) -> { counts, issues }  pure structure-quality checks
// (no main, duplicate main/banner, same-role landmarks that can't be told apart).
//
// Pure inspector + pure helper: no file writes.

export async function readLandmarks(page) {
  return page.evaluate(() => {
    const nameOf = el => {
      const al = el.getAttribute("aria-label");
      if (al && al.trim()) return al.trim();
      const lb = el.getAttribute("aria-labelledby");
      if (lb) {
        const txt = lb.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" ");
        if (txt) return txt;
      }
      return null;
    };
    // A <header>/<footer> inside one of these is scoped out of banner/contentinfo.
    const SECTIONING = "article, aside, main, nav, section";
    const LANDMARK_ROLES = ["banner", "navigation", "main", "complementary", "contentinfo", "form", "region", "search"];
    const roleFor = el => {
      const explicit = (el.getAttribute("role") || "").trim();
      if (LANDMARK_ROLES.includes(explicit)) return explicit;
      switch (el.tagName.toLowerCase()) {
        case "nav": return "navigation";
        case "main": return "main";
        case "aside": return "complementary";
        case "search": return "search";
        case "header": return el.closest(SECTIONING) ? null : "banner";
        case "footer": return el.closest(SECTIONING) ? null : "contentinfo";
        case "form": return nameOf(el) ? "form" : null;       // a form is a landmark only when named
        case "section": return nameOf(el) ? "region" : null;  // ditto for a region
        default: return null;
      }
    };
    const out = [];
    for (const el of document.querySelectorAll("header, nav, main, aside, footer, form, section, search, [role]")) {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const role = roleFor(el);
      if (role) out.push({ role, label: nameOf(el), tag: el.tagName.toLowerCase() });
    }
    return out;
  });
}

// Pure: turn the landmark list into counts + structure-quality issues. Kept out of the
// browser so it's unit-testable and shared by the report and the VPAT generator.
export function landmarkFindings(landmarks = []) {
  const count = role => landmarks.filter(l => l.role === role).length;
  const counts = {};
  for (const role of ["banner", "navigation", "main", "complementary", "contentinfo", "form", "region", "search"])
    counts[role] = count(role);

  const issues = [];
  if (counts.main === 0) issues.push({ level: "serious", msg: "No main landmark — screen-reader users can't skip straight to the primary content (WCAG 2.4.1)." });
  if (counts.main > 1) issues.push({ level: "serious", msg: `${counts.main} main landmarks — a page must have exactly one.` });
  if (counts.banner > 1) issues.push({ level: "moderate", msg: `${counts.banner} banner landmarks — a page has at most one.` });
  if (counts.contentinfo > 1) issues.push({ level: "moderate", msg: `${counts.contentinfo} contentinfo landmarks — a page has at most one.` });
  // Repeated landmarks of the same role must be distinguishable by an accessible name.
  for (const role of ["navigation", "region", "complementary", "form", "search"]) {
    const same = landmarks.filter(l => l.role === role);
    const unlabeled = same.filter(l => !l.label).length;
    if (same.length > 1 && unlabeled > 0)
      issues.push({ level: "moderate", msg: `${same.length} ${role} landmarks but ${unlabeled} lack a distinguishing label (WCAG 1.3.1).` });
  }
  return { counts, issues };
}
