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

// Config file -> job list. Takes already-parsed JSON; the caller reads the file.
// Every property resolves per-page ?? top-level config ?? default (undefined here,
// with real defaults applied downstream in runAudit).
export function parseConfigFile(cfg) {
  const pages = cfg.pages || [];
  if (!pages.length) throw usageError("Config file has no `pages` array.");
  const jobs = [];
  for (const p of pages) {
    if (!p.url) throw usageError("Every config page needs a `url`.");
    jobs.push({
      url: p.url,
      name: p.name,
      tabs: p.tabs ?? cfg.tabs,
      format: p.format ?? cfg.format,
      pdf: p.pdf ?? cfg.pdf,
      md: p.md ?? cfg.md,
      video: p.video ?? cfg.video,
      steps: p.steps,
      viewports: p.viewports ?? cfg.viewports,
      colorScheme: p.colorScheme ?? cfg.colorScheme,
      reducedMotion: p.reducedMotion ?? cfg.reducedMotion,
      voice: p.voice ?? cfg.voice,
      rate: p.rate ?? cfg.rate,
      auth: p.auth ?? cfg.auth,
      baseline: p.baseline ?? cfg.baseline,
      failOn: p.failOn ?? cfg.failOn,
      screenshots: p.screenshots ?? cfg.screenshots,
      sarif: p.sarif ?? cfg.sarif,
      junit: p.junit ?? cfg.junit,
      nvda: p.nvda ?? cfg.nvda,
      out: cfg.out,
    });
  }
  return { jobs, crawl: cfg.crawl || null };
}

const VALUE_FLAGS = new Set(["out", "name", "tabs", "format", "config", "color-scheme",
  "voice", "rate", "cookie", "header", "baseline", "fail-on", "max-pages", "max-depth"]);

const USAGE =
  "Usage: node bin/auria.mjs <url> [--out base] [--name page] [--tabs n] [--format mp4|webm] [--no-pdf] [--crawl] [--nvda]\n" +
  "       node bin/auria.mjs --config pages.json";

// CLI flags + positional URL -> { jobs, crawlOpts, configPath }. Pure: no file reads,
// no process.exit. When --config is present the caller reads it and calls parseConfigFile.
export function parseCli(argv) {
  const args = argv;
  const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
  const optAll = k => args.flatMap((a, i) => a === `--${k}` ? [args[i + 1]] : []).filter(Boolean);
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) { if (VALUE_FLAGS.has(a.slice(2))) i++; }
    else positionals.push(a);
  }

  const configPath = opt("config");
  if (configPath) return { jobs: [], crawlOpts: null, configPath };

  const url = positionals[0];
  if (!url) throw usageError(USAGE);

  const jobs = [{
    url,
    name: opt("name"),
    tabs: opt("tabs"),
    format: opt("format"),
    pdf: args.includes("--no-pdf") ? false : undefined,
    md: args.includes("--md") ? true : undefined,
    video: args.includes("--no-video") ? false : undefined,
    colorScheme: opt("color-scheme") || undefined,
    reducedMotion: args.includes("--reduced-motion") ? true : undefined,
    voice: opt("voice") || undefined,
    rate: opt("rate") || undefined,
    auth: (optAll("cookie").length || optAll("header").length) ? {
      cookies: optAll("cookie").join("; "),
      headers: Object.fromEntries(optAll("header").map(h => {
        const i = h.indexOf(":");
        return [h.slice(0, i).trim(), h.slice(i + 1).trim()];
      })),
    } : undefined,
    baseline: opt("baseline") || undefined,
    failOn: opt("fail-on") || undefined,
    screenshots: args.includes("--screenshots") ? true : undefined,
    sarif: args.includes("--sarif") ? true : undefined,
    junit: args.includes("--junit") ? true : undefined,
    nvda: args.includes("--nvda") ? true : undefined,
    out: opt("out"),
  }];

  let crawlOpts = null;
  if (args.includes("--crawl")) {
    crawlOpts = { maxPages: opt("max-pages") ?? undefined, maxDepth: opt("max-depth") ?? undefined };
  }
  return { jobs, crawlOpts, configPath: null };
}
