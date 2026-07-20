# Run Auria in a Linux container (headless, incl. narrated video)

Auria's full pipeline — analysis, reports, dashboards, and the **narrated video** — runs
headless in a Linux container. This is the P2 milestone and the basis for a SaaS worker:
one container image audits any URL server-side, no desktop required.

## What's in the image

- **Node 22** + the Auria engine.
- **Chromium** + its system libraries (`playwright install --with-deps`), for the audit
  and headless video recording.
- **espeak-ng** — the cross-platform narration engine (auto-selected on Linux).
- **ffmpeg** — via `ffmpeg-static` (the Linux binary is fetched during `npm ci`), for the
  audio/video mux.

`--nvda` is **not** available in a container (real NVDA is Windows-only); everything else,
including the narrated video, is.

## Build

```bash
docker build -t auria .
```

## Run

Mount an output directory and pass a URL (all the usual flags work):

```bash
mkdir -p out

# Full audit + narrated video (mp4 by default):
docker run --rm -v "$PWD/out:/out" auria https://example.com/page --out /out --name page

# Fast analysis-only (no video), with CI artifacts:
docker run --rm -v "$PWD/out:/out" auria https://example.com/page \
  --out /out --name page --no-video --sarif --junit

# Whole site:
docker run --rm -v "$PWD/out:/out" auria https://example.com/ --crawl --out /out
```

Artifacts land under `out/<host>/<page>/` on the host: `.mp4`/`.webm`, `-report.pdf`,
`-axe.json`, `.sarif`, `-junit.xml`, plus the `index.html` dashboards.

## Higher-quality neural narration (optional)

espeak-ng is robotic. To use the neural **Piper** voice in the container, mount a Piper
binary + voice model and point `PIPER_VOICE`/`PIPER_BIN` at them (Auria then auto-selects
Piper — see [narrated-video.md](narrated-video.md#installing-piper-neural)):

```bash
docker run --rm \
  -v "$PWD/out:/out" -v "$PWD/piper:/piper" \
  -e PIPER_BIN=/piper/piper -e PIPER_VOICE=/piper/en_US-amy-medium.onnx \
  auria https://example.com/page --out /out
```

## CI proof

The `container` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) builds
this image and runs a full audit **including the narrated video** against the local
fixture on every push, asserting the video + PDF are produced — so the Linux-container
path stays proven, not just documented.
