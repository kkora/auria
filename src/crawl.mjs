// Site crawler — BFS same-origin page discovery.
//
// Responsibility:
//   - normalizeUrl(href, base) : absolute, hash-stripped, trailing-slash-trimmed;
//                                returns null for links a crawler must not follow
//                                (mailto:/tel:/javascript:, skipped extensions).
//   - sameOrigin(a, b)
//   - discoverPages(seed, crawlOpts) : { pages, failed } bounded by maxPages/maxDepth,
//                                gated by include/exclude regexes.
//   - expandCrawl(seed, crawlOpts) : run discoverPages, write <out>/<host>/crawl-map.json,
//                                and return one job per discovered page (inherits seed).
//
// normalizeUrl + the include/exclude matching are pure and MUST be unit-tested
// (see docs/crawl.md for the exact matching semantics — full URL, unanchored,
// case-sensitive, JSON-escaped backslashes).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAuth, slugify } from "./config.mjs";
import { launchBrowser } from "./browser.mjs";

const SKIP_EXT = /\.(pdf|zip|png|jpe?g|svg|webm|mp4|docx?|xlsx?)$/i;

// Normalize for dedupe: absolute, hash stripped, trailing slash trimmed (root keeps "/").
// Returns null for links a crawler must not follow (mailto:/tel:/javascript:, assets).
export function normalizeUrl(href, base) {
  let u;
  try { u = new URL(href, base); } catch { return null; }
  if (!/^(https?|file):$/.test(u.protocol)) return null;   // mailto:, tel:, javascript:
  if (SKIP_EXT.test(u.pathname)) return null;
  u.hash = "";
  if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

export const sameOrigin = (a, b) => {
  const A = new URL(a), B = new URL(b);
  return A.protocol === B.protocol && A.host === B.host;
};

async function collectLinks(page) {
  return page.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")));
}

// BFS from the seed job's URL using a short-lived browser so the crawl respects the
// same auth the audits will use. A dead link never kills the crawl — it lands in
// `failed[]`. Bounded by maxPages (default 20) and maxDepth (default 3); a link is
// followed only if it matches `include` (when set) and not `exclude`.
export async function discoverPages(seed, crawl) {
  const maxPages = Number(crawl.maxPages ?? 20);
  const maxDepth = Number(crawl.maxDepth ?? 3);
  const inc = crawl.include ? new RegExp(crawl.include) : null;
  const exc = crawl.exclude ? new RegExp(crawl.exclude) : null;
  const auth = normalizeAuth(seed.auth, seed.url);
  const browser = await launchBrowser();
  const start = normalizeUrl(seed.url, seed.url);
  const seen = new Set([start]);
  const pages = [], failed = [];
  const queue = [{ url: start, depth: 0 }];
  try {
    const ctx = await browser.newContext(Object.keys(auth.headers).length ? { extraHTTPHeaders: auth.headers } : {});
    if (auth.cookies.length) await ctx.addCookies(auth.cookies);
    while (queue.length && pages.length < maxPages) {
      const { url, depth } = queue.shift();
      // A fresh page per URL avoids a failed goto's internal error-page navigation
      // racing with (and interrupting) the next goto.
      const page = await ctx.newPage();
      try {
        await page.goto(url, { waitUntil: "load", timeout: 30000 });
      } catch (e) {
        failed.push({ url, error: e.message.split("\n")[0] });
        await page.close().catch(() => {});
        continue;
      }
      pages.push({ url, depth });
      // The page loaded, so it stays audited; only its link discovery is best-effort.
      if (depth < maxDepth) {
        try {
          for (const href of await collectLinks(page)) {
            const n = normalizeUrl(href, url);
            if (!n || seen.has(n) || !sameOrigin(n, start)) continue;
            if (inc && !inc.test(n)) continue;
            if (exc && exc.test(n)) continue;
            seen.add(n);
            queue.push({ url: n, depth: depth + 1 });
          }
        } catch (e) {
          console.error(`  crawl: link discovery failed on ${url}: ${e.message.split("\n")[0]}`);
        }
      }
      await page.close().catch(() => {});
    }
    await ctx.close();
  } finally { await browser.close().catch(() => {}); }
  return { pages, failed };
}

// Run the crawl, persist <out>/<host>/crawl-map.json, and expand the seed into one
// job per discovered page (each inherits the seed's options, named by its path).
export async function expandCrawl(seed, crawl) {
  const { pages, failed } = await discoverPages(seed, crawl);
  const host = new URL(seed.url).hostname.replace(/[^a-z0-9.-]/gi, "_") || "site";
  const mapDir = path.resolve(seed.out || "a11y-audits", host);
  await mkdir(mapDir, { recursive: true });
  await writeFile(path.join(mapDir, "crawl-map.json"),
    JSON.stringify({ start: seed.url, date: new Date().toISOString().slice(0, 10), pages, failed }, null, 2));
  return {
    pages, failed,
    jobs: pages.map(p => {
      const parsed = new URL(p.url);
      let src = parsed.pathname;
      if (parsed.protocol === "file:") {
        const rel = path.relative(process.cwd(), fileURLToPath(parsed)).replace(/\\/g, "/");
        if (rel && !rel.startsWith("..")) src = rel;
      }
      return { ...seed, url: p.url, name: slugify(src) };
    }),
  };
}
