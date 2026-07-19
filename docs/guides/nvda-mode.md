# Real NVDA mode (Windows)

`--nvda` drives a **real NVDA screen reader** during the keyboard walk instead of the
simulated narration, capturing what actual assistive technology announces. Windows
only. Reference: [nvda.md](../nvda.md).

## Step 1 — One-time setup

1. Install **NVDA** (free) from [nvaccess.org](https://www.nvaccess.org/).
2. Run the Guidepup NVDA automation setup once:

   ```bash
   npx @guidepup/setup
   ```

   This installs/configures the Guidepup NVDA add-on for automation. It is **not** a
   browser add-on.

## Step 2 — Run with `--nvda`

```bash
node bin/auria.mjs https://example.gov/checkout --nvda
```

Or in config: `{ "nvda": true }`.

## Step 3 — Keep the browser focused during the walk

- The browser runs **headed (visible)** and **must stay focused** for the whole
  keyboard walk — NVDA reads from the focused window.
- **Do not switch windows** during the walk; stealing focus fails the capture.
- Each `Tab` is pressed *through NVDA* and its real spoken phrase is recorded per stop.

## Step 4 — Read the results

- The report's keyboard-walk table gains an **"NVDA announced"** column.
- In the video, captured NVDA text is **re-voiced** by the same TTS voice — the video
  then carries real screen-reader behavior, not an approximation.

## Errors

If NVDA or the Guidepup add-on is unavailable, the run **fails immediately** and tells
you the fix (`npx @guidepup/setup`). For tests, `GUIDEPUP_NVDA_UNAVAILABLE=1` forces
the unavailable branch.

## Scope

`--nvda` proves real announcements (evidence for WCAG 4.1.2 / 1.3.1) but is not full
conformance testing. For 508/WCAG sign-off, replay the report's step list with NVDA
(Windows) and VoiceOver (iOS/macOS). See [wcag-coverage.md](../wcag-coverage.md).
