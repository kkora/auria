// Report: axe + strict checks -> JUnit XML.
//
// buildJunit(analysis, { url }) -> string   axe rules, reflow-320, zoom-200, and the
// keyboard-trap result rendered as <testcase>/<failure> for CI test dashboards.
// Pure serialization — unit-testable.

// TODO(port): move the JUnit block here.

export function buildJunit(/* analysis, ctx */) {
  throw new Error("not implemented — scaffold");
}
