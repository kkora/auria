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
