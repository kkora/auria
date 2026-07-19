# CLI & config reference

> Ported from the original tool's README; verify each flag against `src/config.mjs`
> as modules are implemented.

## Usage

```bash
node bin/auria.mjs <url> [flags]
node bin/auria.mjs --config <file.json>
```

## Flags

| Flag | Meaning | Default |
| --- | --- | --- |
| `--out <dir>` | Base output folder (`<host>/<page>/` created inside) | `a11y-audits` |
| `--name <label>` | Page folder + file base name | slug of URL path |
| `--tabs <n>` | Ceiling on keyboard-walk tab stops | 25 |
| `--format mp4\|webm` | Video container | `mp4` |
| `--no-pdf` | Skip the PDF report | PDF on |
| `--md` | Also write `<page>-report.md` | off |
| `--no-video` | Analysis-only fast mode (no narration/recording) | video on |
| `--color-scheme dark\|light` | Emulate OS color scheme | none |
| `--reduced-motion` | Emulate `prefers-reduced-motion: reduce` | off |
| `--voice "<name>"`, `--rate <-10..10>` | TTS voice + speed | Zira, 1 |
| `--cookie "n=v"`, `--header "K: V"` | Auth (repeatable; values never in reports) | none |
| `--baseline <axe.json\|auto>` | Diff vs a previous run | off |
| `--fail-on minor\|moderate\|serious\|critical` | CI gate (exit 2 on breach) | off |
| `--screenshots` | Annotated PNG per viewport | off |
| `--sarif`, `--junit` | Machine-readable results | off |
| `--nvda` | Real NVDA screen reader (see [nvda.md](nvda.md)) | off |
| `--crawl` | Audit every same-origin page (see [crawl.md](crawl.md)) | off |
| `--max-pages <n>`, `--max-depth <n>` | Crawl bounds | 20, 3 |

## Config file

Resolution order for every property: **per-page → top-level config → default.**
See [examples/pages.sample.json](../examples/pages.sample.json). Config keys mirror
the flags (`format`, `pdf`, `video`, `tabs`, `viewports`, `colorScheme`,
`reducedMotion`, `voice`, `rate`, `auth`, `baseline`, `failOn`, `screenshots`,
`sarif`, `junit`, `nvda`, `steps`, plus top-level `out` and `crawl`).

`steps` (per page) put the page into a state before auditing — one action key per
entry (`click` / `fill` / `select` / `focus` / `press`) plus optional `wait`.

## Environment variables

| Var | Effect |
| --- | --- |
| `AURIA_TTS` | Force the narration engine: `piper` \| `windows` \| `crossplatform`. Otherwise: Piper when `PIPER_VOICE` is set, else System.Speech on Windows, else espeak-ng. |
| `PIPER_VOICE` | Path to a Piper `.onnx` neural voice (auto-selects Piper). See [guides/narrated-video.md](guides/narrated-video.md#installing-piper-neural). |
| `PIPER_BIN` | Path to the `piper` binary (default: `piper` on `PATH`). |
| `GUIDEPUP_NVDA_UNAVAILABLE=1` | Test override — forces the NVDA-unavailable branch. |
