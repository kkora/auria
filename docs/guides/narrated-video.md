# Narrated video

Produce the shareable narrated walkthrough — a synthesized voice + on-screen captions
that announce the axe results, per-device layout verdicts, heading structure, and the
keyboard order. This is Auria's signature output for non-technical stakeholders.

## Step 1 — Produce a video

Video is **on by default** — a plain run makes it:

```bash
node bin/auria.mjs https://example.com/checkout
```

Result: `a11y-audits/example.com/checkout/checkout.mp4`.

## Step 2 — Choose the container format

```bash
node bin/auria.mjs https://example.com/checkout --format webm
```

- `--format mp4` (default) — widest compatibility.
- `--format webm` — smaller, web-native.

## Step 3 — Pick the voice and speed

```bash
node bin/auria.mjs https://example.com/checkout --voice "Microsoft Zira" --rate 2
```

- `--voice "<name>"` — an installed TTS voice (default `Zira` on Windows).
- `--rate <-10..10>` — speaking speed (default `1`).

## Step 4 — Skip video while iterating

The recording + narration pass is the slow part. During fix-and-recheck:

```bash
node bin/auria.mjs https://example.com/checkout --no-video
```

Then drop `--no-video` for the final shareable render.

## How it works (and the platform note)

The narration script is built from the analysis data (`narrate/plan`), synthesized to
audio through the **`tts` seam**, recorded via Playwright, captioned, and muxed with
`ffmpeg`.

- **Windows**: the default voice uses `System.Speech` (`assets/gen-voice.ps1`).
- **Other OSes**: narration routes through the cross-platform TTS path. If no TTS is
  available, use `--no-video` — the audit and all reports still run everywhere.

### Choosing a TTS engine

The narration engine is chosen by the `AURIA_TTS` environment variable (and, for the
neural engine, the presence of a voice model). Precedence:

1. `AURIA_TTS=piper|windows|crossplatform` — explicit override.
2. `PIPER_VOICE` set → **Piper** (neural, offline, best quality, any OS).
3. Windows → **System.Speech**.
4. otherwise → **espeak-ng** (cross-platform, offline).

| Engine | Quality | Setup |
| --- | --- | --- |
| System.Speech | good | none (built into Windows) |
| espeak-ng | robotic | `apt install espeak-ng` / `brew install espeak-ng` |
| **Piper** (neural) | **best** | download the `piper` binary + a `.onnx` voice, then `PIPER_VOICE=/path/to/voice.onnx` (optionally `PIPER_BIN=/path/to/piper`) |

```bash
# High-quality neural narration on any OS:
PIPER_VOICE=~/voices/en_US-amy-medium.onnx node bin/auria.mjs https://example.com/checkout
```

#### Installing Piper (neural)

1. **Binary** — download from [github.com/rhasspy/piper/releases](https://github.com/rhasspy/piper/releases)
   (`piper_windows_amd64.zip` on Windows x64) and extract to e.g. `C:\tools\piper\`
   (keep `piper.exe` with its DLLs and `espeak-ng-data\`).
2. **Voice** — from [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)
   download **both** `<voice>.onnx` and `<voice>.onnx.json` (e.g. `en_US-amy-medium`) into one folder.
3. **Point Auria at it:**
   ```powershell
   $env:PIPER_BIN   = "C:\tools\piper\piper.exe"   # optional if piper is on PATH
   $env:PIPER_VOICE = "C:\tools\piper\voices\en_US-amy-medium.onnx"
   node bin/auria.mjs https://example.com/checkout
   ```

Either Piper build works — the classic **rhasspy/piper** (`--output_file` / `--length_scale`)
or the newer **piper1-gpl** / `pip install piper-tts` (`--output-file` / `--length-scale`).
Auria reads `piper --help` once and picks the matching flags automatically.

All engines emit the same PCM-WAV contract, so the rest of the pipeline is identical.
If the selected engine is unavailable, the video step warns and Auria still writes all
reports (never a hard failure).

The narrated screen-reader walk is a **simulation** built from the page's ARIA + axe
output. For *real* screen-reader speech in the video, see [Real NVDA mode](nvda-mode.md)
— with `--nvda`, captured NVDA phrases are re-voiced by the same TTS voice.

## Config equivalents

```jsonc
{ "format": "webm", "voice": "Microsoft David", "rate": 2,
  "pages": [{ "url": "https://example.com/checkout" }] }
```

## Related

- [Real NVDA mode](nvda-mode.md) · [Reports & artifacts](reports-and-artifacts.md)
