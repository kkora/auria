// Real NVDA screen-reader driver (Windows-only power feature).
//
// nvdaPreflight() -> nvda   starts NVDA via @guidepup/guidepup; throws with clear
//   install/setup guidance (nvaccess.org + `npx @guidepup/setup`) if unavailable.
//   AURIA test override: GUIDEPUP_NVDA_UNAVAILABLE=1 forces the unavailable branch.
//
// The started driver is passed into analyze/keyboard.walkTabOrder so the keyboard
// walk captures NVDA's actual spoken phrases (later re-voiced into the video).
//
// Windows-only. Along with tts-windows.mjs, the only module allowed a hard OS
// dependency. In the SaaS this runs on a dedicated Windows worker pool.

export async function nvdaPreflight() {
  if (process.env.GUIDEPUP_NVDA_UNAVAILABLE === "1")
    throw new Error("forced unavailable for tests");
  const { nvda } = await import("@guidepup/guidepup");
  await nvda.start();          // throws if NVDA / the guidepup add-on is not installed
  return nvda;
}
