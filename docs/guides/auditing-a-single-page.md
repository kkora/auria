# Audit a single page

Audit one URL and tune what gets checked. Full flag table: [cli.md](../cli.md).

## Step 1 — Basic run

```bash
node bin/auria.mjs https://example.com/checkout
```

Output goes to `a11y-audits/example.com/checkout/`.

## Step 2 — Name it and choose where it lands

```bash
node bin/auria.mjs https://example.com/checkout --name checkout-v2 --out ./audits
```

- `--name` sets the page folder + file base name (defaults to a slug of the URL path).
- `--out` sets the base output folder (default `a11y-audits`).

## Step 3 — Fast mode while iterating

```bash
node bin/auria.mjs https://example.com/checkout --no-video
```

Skips narration + recording (the slow part). You keep the PDF, `-axe.json`, and
dashboard. Use this as your fix-and-recheck loop, then drop `--no-video` for the
final shareable video.

## Step 4 — Test responsive layout at specific viewports

By default Auria checks desktop / tablet / phone. To pin your own set, use a config
file (a single page is fine):

```jsonc
// one-page.json
{
  "pages": [{
    "url": "https://example.com/checkout",
    "viewports": [
      { "label": "Desktop", "w": 1280, "h": 800 },
      { "label": "Phone",   "w": 360,  "h": 740 }
    ]
  }]
}
```

```bash
node bin/auria.mjs --config one-page.json
```

Each viewport is checked for horizontal overflow (WCAG 1.4.10 Reflow). See
[wcag-coverage.md](../wcag-coverage.md).

## Step 5 — Emulate dark mode / reduced motion

Audit the experience a user with these OS settings gets:

```bash
node bin/auria.mjs https://example.com/checkout --color-scheme dark --reduced-motion
```

- `--color-scheme dark|light` emulates `prefers-color-scheme`.
- `--reduced-motion` emulates `prefers-reduced-motion: reduce`.

## Step 6 — Control the keyboard walk

Auria tabs through the page to check focus order and keyboard traps. Cap the number
of tab stops (default 25):

```bash
node bin/auria.mjs https://example.com/checkout --tabs 40
```

## Common combinations

```bash
# Fast iteration loop, dark theme
node bin/auria.mjs https://example.com/checkout --no-video --color-scheme dark

# Full run with markdown report and annotated screenshots
node bin/auria.mjs https://example.com/checkout --md --screenshots
```

## Related

- [Authenticate](authentication.md) if the page is behind a login.
- [Reports & artifacts](reports-and-artifacts.md) to understand the output files.
- [Audit many pages](auditing-multiple-pages.md) to run a list with setup steps.
