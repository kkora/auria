// Narration planner: analysis data -> ordered narration script.
//
// buildNarration(analysis, { viewports }) -> plan[]  where each entry is
//   { text, pad, action }  and action is null | { type: "tab" } | { type: "layout", vp }
//
// The plan drives BOTH the report's step-by-step script and the recorded video, so
// they always describe the same page state. Pure function of the analysis object —
// no browser, no TTS, no I/O.

// TODO(port): move the "narration + action plan" section (the say(...) calls) here.

export function buildNarration(/* analysis, opts */) {
  throw new Error("not implemented — scaffold");
}
