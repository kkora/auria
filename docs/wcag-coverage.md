# WCAG coverage

What each Auria check maps to. This matters for gov/508 buyers: it states plainly
what the tool proves automatically and what still needs manual verification.

| Auria check | WCAG SC | Level | How |
| --- | --- | --- | --- |
| axe-core rule set | many (1.1.1, 1.3.1, 1.4.3, 4.1.2, …) | A/AA | axe-core engine at widest + narrowest viewport |
| Horizontal overflow (per viewport) | 1.4.10 Reflow | AA | `scrollWidth > clientWidth` at each viewport |
| Reflow at exactly 320 CSS px | 1.4.10 Reflow | AA | spec-exact 320px pass (`strict.reflow320`) |
| 200% zoom, no horizontal scroll | 1.4.4 Resize Text | AA | document zoom ×2 pass (`strict.zoom200`) |
| Interactive targets ≥ 24px | 2.5.8 Target Size (Minimum) | AA | bounding box of interactive elements |
| Viewport meta present | 1.4.10 (mobile reflow) | AA | `<meta name="viewport">` check |
| Keyboard order walk (names/roles) | 2.4.3 Focus Order, 4.1.2 Name/Role/Value | A | tab traversal + accessible-name inference |
| Keyboard-trap detection | 2.1.2 No Keyboard Trap | A | full-page tab cycle; flags stuck focus |
| Heading structure / missing `h1` | 1.3.1 Info & Relationships, 2.4.6 Headings | A/AA | heading outline extraction |
| Text under 12px (advisory) | — (readability signal, not a pass/fail SC) | — | computed `font-size` scan |
| Dark-mode / reduced-motion audit | context for 1.4.3 etc. | AA | `prefers-color-scheme` / `prefers-reduced-motion` emulation |
| Real NVDA announcements (`--nvda`) | evidence for 4.1.2 / 1.3.1 | A | captured screen-reader speech |

## Not covered automatically (needs manual testing)

- Meaningful reading order and content that only a human can judge (1.3.2, 1.3.1 nuance).
- Real screen-reader task completion beyond the keyboard walk.
- Cross-origin iframes (hosted card fields, embeds) — axe cannot see inside them.
- Color/contrast inside images or canvas; motion/animation semantics.

Auria is a **shift-left evidence tool**, not a certification. For 508/WCAG conformance,
replay the report's step list with NVDA (Windows) and VoiceOver (iOS/macOS).

> This table is a scaffold — confirm each mapping against the implemented analyzers
> and the axe-core version in `package.json` before publishing it to customers.
