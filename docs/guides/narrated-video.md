# Narrated video

Produce the shareable narrated walkthrough — a synthesized voice + on-screen captions
that announce the axe results, per-device layout verdicts, heading structure, and the
keyboard order. This is Auria's signature output for non-technical stakeholders.

## Step 1 — Produce a video

Video is **on by default** — a plain run makes it:

```bash
node bin/auria.mjs https://example.gov/checkout
```

Result: `a11y-audits/example.gov/checkout/checkout.mp4`.

## Step 2 — Choose the container format

```bash
node bin/auria.mjs https://example.gov/checkout --format webm
```

- `--format mp4` (default) — widest compatibility.
- `--format webm` — smaller, web-native.

## Step 3 — Pick the voice and speed

```bash
node bin/auria.mjs https://example.gov/checkout --voice "Microsoft Zira" --rate 2
```

- `--voice "<name>"` — an installed TTS voice (default `Zira` on Windows).
- `--rate <-10..10>` — speaking speed (default `1`).

## Step 4 — Skip video while iterating

The recording + narration pass is the slow part. During fix-and-recheck:

```bash
node bin/auria.mjs https://example.gov/checkout --no-video
```

Then drop `--no-video` for the final shareable render.

## How it works (and the platform note)

The narration script is built from the analysis data (`narrate/plan`), synthesized to
audio through the **`tts` seam**, recorded via Playwright, captioned, and muxed with
`ffmpeg`.

- **Windows**: the default voice uses `System.Speech` (`assets/gen-voice.ps1`).
- **Other OSes**: narration routes through the cross-platform TTS path. If no TTS is
  available, use `--no-video` — the audit and all reports still run everywhere.

The narrated screen-reader walk is a **simulation** built from the page's ARIA + axe
output. For *real* screen-reader speech in the video, see [Real NVDA mode](nvda-mode.md)
— with `--nvda`, captured NVDA phrases are re-voiced by the same TTS voice.

## Config equivalents

```jsonc
{ "format": "webm", "voice": "Microsoft David", "rate": 2,
  "pages": [{ "url": "https://example.gov/checkout" }] }
```

## Related

- [Real NVDA mode](nvda-mode.md) · [Reports & artifacts](reports-and-artifacts.md)
