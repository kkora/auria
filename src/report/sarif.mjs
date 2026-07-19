// Report: axe results -> SARIF 2.1.0.
//
// buildSarif(analysis, { url }) -> object   for GitHub / Azure DevOps code scanning.
// Impact maps to SARIF level (critical/serious->error, moderate->warning, minor->note);
// each axe node becomes a result location. Pure serialization — unit-testable.

// TODO(port): move the "SARIF / JUnit for CI systems" SARIF block here.

export function buildSarif(/* analysis, ctx */) {
  throw new Error("not implemented — scaffold");
}
