// Config & CLI parsing -> normalized job list.
//
// Responsibility:
//   - parseCli(argv)      : flags + positional URL -> jobs[]
//   - parseConfigFile(p)  : --config JSON -> jobs[] (+ crawl options)
//   - normalizeAuth(auth) : cookies string/array + headers -> { cookies, headers }
//   - slugify / slugFromUrl helpers
//
// Resolution order for every property is ALWAYS:
//   per-page value -> top-level config value -> built-in default.
//
// Pure module: no browser, no file writes other than reading the config file.

// TODO(port): move the "CLI", "Build the job list", and normalizeAuth sections
// from the original monolith here. Export the helpers so test/unit can cover
// slugify, include/exclude precedence, and auth normalization directly.

export function parseCli(/* argv */) {
  throw new Error("not implemented — scaffold");
}
