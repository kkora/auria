# Architecture

Auria is a pipeline: **discover → analyze → narrate → record → report → dashboard.**
Each stage is a focused module with a small interface so it can be tested alone and
reused by a SaaS worker.

## Data flow

```
config.mjs ──► jobs[] ──► [crawl.mjs expands seeds] ──► per-job runAudit()
                                                            │
   ┌────────────────────────────────────────────────────────┘
   ▼
analyze/axe · analyze/layout · analyze/strict · analyze/keyboard
   │  (each: Playwright page -> plain data)
   ▼
analysis object ──► narrate/plan ──► narration plan[]
                        │
                        ├──► record.mjs (narrate/tts -> WAV, recordVideo, ffmpeg mux)   [--no-video skips]
                        └──► report/{markdown,pdf,sarif,junit,screenshots}
   ▼
dashboard.mjs (scans the whole out-base tree -> global + per-host index.html)
```

## Boundaries (enforced by convention — see CLAUDE.md)

| Layer | May touch a browser? | May write files? |
| --- | --- | --- |
| `config.mjs`, `crawl.mjs` | crawl uses a short-lived browser | crawl-map only |
| `analyze/*` | yes (reads the page) | **no** |
| `narrate/plan.mjs` | no | no |
| `narrate/tts*`, `record.mjs` | record: yes | intermediates + final video |
| `report/*` | pdf + screenshots only | yes |
| `dashboard.mjs` | no | yes |
| `bin/auria.mjs` | no | no (parses args) |

## The TTS seam

`narrate/tts.mjs` is the single point where narration touches the OS. Windows uses
`System.Speech`; Linux/SaaS uses a cross-platform engine. Everything else in
`narrate`/`record` depends only on the `synth()` interface. This is what lets the
identical engine run in a Linux container. See [PLAN.md](PLAN.md) §5.

## Porting status

The working implementation currently lives in the original monolith
(`tools/a11y-video-audit.mjs` in `cpp-payment-ui`). Each stub file names the exact
section to move into it via a `TODO(port)` comment.
