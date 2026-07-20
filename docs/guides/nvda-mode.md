# Real NVDA mode (Windows)

`--nvda` drives a **real NVDA screen reader** during the keyboard walk instead of the
simulated narration, capturing what actual assistive technology announces per tab stop
(and re-voicing it into the video). Windows only. Reference: [nvda.md](../nvda.md).

## Prerequisites

- **Windows** with an **interactive desktop session** (see the focus note below — this
  cannot run headless / from a background CI job / over RDP without an attached console).
- **NVDA** installed (nvaccess.org).
- The **guidepup NVDA automation add-on** (installed by `npx @guidepup/setup`).

## Step 1 — Install NVDA

Download and install NVDA (free) from [nvaccess.org](https://www.nvaccess.org/).
Verify: `C:\Program Files\NVDA\nvda.exe` exists.

## Step 2 — Install the guidepup automation add-on (one-time)

This is **separate from the NVDA app** — it prepares a guidepup-managed NVDA
environment (a controlled NVDA + the NVDA Remote automation add-on) so Auria can drive
NVDA and read its speech log. Run once, from the project root:

```bash
npx @guidepup/setup
```

Success prints `Environment setup complete 🎉`.

> Note: guidepup manages its **own** NVDA config next to the executable it controls —
> it does **not** populate your normal `%APPDATA%\nvda\addons` folder, so that folder
> staying empty is expected. The real proof of setup is a working `--nvda` run
> (Step 3); if it errors with the "install NVDA / `npx @guidepup/setup`" message, the
> environment isn't ready — re-run this command and check its output.

## Step 3 — Run an audit with `--nvda`

```bash
node bin/auria.mjs https://example.com/checkout --nvda
```

Or in a config file: `{ "nvda": true }`. Auria will:

1. Launch the browser **headed** (visible) — NVDA reads from the focused window.
2. Start NVDA via guidepup (you'll hear it).
3. Tab through the page, pressing each Tab **through NVDA** and recording its spoken
   phrase per stop.
4. Stop NVDA and write the artifacts.

## Step 4 — Keep the window focused during the walk

This is the one thing that makes or breaks a capture:

- The headed browser window **must stay in the foreground and focused** for the whole
  keyboard walk. NVDA reads the *focused* window.
- **Don't touch the mouse/keyboard, switch apps, or lock the screen** during the walk.
- Prefer a single monitor and close other foreground apps.
- If focus is lost, Auria fails that job with:
  `NVDA walk captured no tab stops — the browser window likely lost OS focus…` — just
  re-run and leave the window alone.

## Step 5 — Read the results

- The report's keyboard-walk table gains an **"NVDA announced"** column (the real
  spoken phrase per stop), and unnamed/silent stops are flagged for investigation.
- With video on, the captured NVDA text is **re-voiced** by the TTS engine, so the
  `.mp4` carries real screen-reader behavior, not an approximation. The caption banner
  reads "REAL NVDA OUTPUT (RE-VOICED)".

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `NVDA mode requested but not available … npx @guidepup/setup` | The add-on isn't installed — run Step 2 and verify the `addons` folder. |
| `NVDA walk captured no tab stops … lost OS focus` | The window lost focus mid-walk (Step 4). Re-run and don't touch the machine; disable NVDA's startup dialog so it doesn't steal focus. |
| Nothing happens / hangs on start | NVDA is likely showing its **welcome dialog** on launch. Open NVDA once manually, tick "Show this dialog when NVDA starts" **off**, and dismiss it. |
| Runs but the NVDA column is empty | NVDA started but produced no speech — confirm NVDA speaks normally outside Auria, then re-run keeping focus. |

`GUIDEPUP_NVDA_UNAVAILABLE=1` forces the unavailable branch (used by the test suite).

## Scope

`--nvda` proves real announcements (evidence for WCAG 4.1.2 / 1.3.1) but is not full
conformance testing. For 508/WCAG sign-off, replay the report's step list with NVDA
(Windows) and VoiceOver (iOS/macOS). See [wcag-coverage.md](../wcag-coverage.md).
