// Site crawler — BFS same-origin page discovery.
//
// Responsibility:
//   - normalizeUrl(href, base) : absolute, hash-stripped, trailing-slash-trimmed;
//                                returns null for links a crawler must not follow
//                                (mailto:/tel:/javascript:, skipped extensions).
//   - sameOrigin(a, b)
//   - discoverPages(seed, crawlOpts) : { pages, failed } bounded by maxPages/maxDepth,
//                                gated by include/exclude regexes.
//
// normalizeUrl + the include/exclude matching are pure and MUST be unit-tested
// (see docs/crawl.md for the exact matching semantics — full URL, unanchored,
// case-sensitive, JSON-escaped backslashes).

// TODO(port): move normalizeUrl, sameOrigin, collectLinks, discoverPages here.

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

export async function discoverPages(/* seed, crawl */) {
  throw new Error("not implemented — scaffold");
}
