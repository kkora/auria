// Analyzer: strict WCAG passes.
//
// runStrict(page) -> { reflow320, zoom200 }
//   reflow320 : horizontal overflow (px) at exactly 320 CSS px (WCAG 1.4.10, exact)
//   zoom200   : horizontal overflow (px) at document zoom 2x    (WCAG 1.4.4 approx)
//
// Leaves the page at viewport 1280x900 on return.
// Pure inspector: takes a Playwright page, returns data.

export async function runStrict(page) {
  const strict = {};
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(500);
  strict.reflow320 = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  strict.zoom200 = await page.evaluate(async () => {
    document.documentElement.style.zoom = "2";
    await new Promise(r => setTimeout(r, 400));
    const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    document.documentElement.style.zoom = "";
    await new Promise(r => setTimeout(r, 200));
    return overflow;
  });
  return strict;
}
