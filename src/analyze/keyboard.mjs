// Analyzer: keyboard order walk + keyboard-trap detection.
//
// walkTabOrder(page, { maxTabs, nvda }) -> tabStops[]  { name, role, nvda? }
//   Tabs through the page capturing each stop's accessible name + role. With an
//   NVDA driver, presses are issued through NVDA and its real spoken phrase is
//   captured per stop; otherwise names/roles are approximated from the DOM.
//
// detectKeyboardTrap(page) -> { status: "pass"|"trap", at?, stops }
//   Tabs the whole page (WCAG 2.1.2); if focus stops moving, users are trapped.
//
// Pure inspector aside from the optional NVDA driver passed in (see src/nvda.mjs).

// TODO(port): move the "keyboard walk" and "Keyboard-trap detection" blocks here.

export async function walkTabOrder(/* page, opts */) {
  throw new Error("not implemented — scaffold");
}

export async function detectKeyboardTrap(/* page */) {
  throw new Error("not implemented — scaffold");
}
