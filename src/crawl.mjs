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

export function normalizeUrl(/* href, base */) {
  throw new Error("not implemented — scaffold");
}

export async function discoverPages(/* seed, crawl */) {
  throw new Error("not implemented — scaffold");
}
