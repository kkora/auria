// Config & CLI parsing -> normalized job list.
//
// Pure module: no browser, no process.exit, no file writes. Config-file *reading*
// is the caller's job (see parseCli's returned configPath). Resolution order for
// every property is ALWAYS: per-page value -> top-level config -> built-in default.

// Tagged error for bad invocations. bin/ prints the message + usage and exits 1;
// any untagged throw is an unexpected bug.
export function usageError(message) {
  const e = new Error(message);
  e.usage = true;
  return e;
}

export const slugify = s => s.replace(/^\/+|\/+$/g, "")
  .replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "home";

export const slugFromUrl = u => slugify(new URL(u).pathname);

// Auth: cookies as "n=v; n2=v2" or [{name, value, domain?, path?}]; headers as {Name: value}.
// Values are used only to drive the browser and never appear in reports (counts only).
export function normalizeAuth(auth, url) {
  if (!auth) return { cookies: [], headers: {} };
  let cookies = [];
  if (typeof auth.cookies === "string") {
    cookies = auth.cookies.split(";").map(s => s.trim()).filter(Boolean).map(s => {
      const i = s.indexOf("=");
      return { name: s.slice(0, i).trim(), value: s.slice(i + 1).trim(), url };
    });
  } else if (Array.isArray(auth.cookies)) {
    cookies = auth.cookies.map(c => (c.domain || c.url) ? c : { ...c, url });
  }
  return { cookies, headers: auth.headers || {} };
}
