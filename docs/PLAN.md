# Auria — Product & Extraction Plan

> Status: **Plan / decide-later.** This document is the single source of truth for
> *what Auria is*, *how the repo is organized*, and *how it could be monetized as a
> SaaS*. No product code is implemented yet — the folder tree exists as a scaffold
> of stub modules to be filled in once the direction is confirmed.

Auria is a web **accessibility + responsive-layout auditor** that turns a URL (or a
whole site) into legible evidence: automated axe-core findings, per-viewport layout
checks, strict WCAG passes, a keyboard walk, and — its differentiator — a **narrated
video** (synthesized voice + captions) plus MD/PDF/JSON/SARIF/JUnit reports and
dashboards.

It originated as `tools/a11y-video-audit.mjs` (a single ~1,050-line Node script) in
the `cpp-payment-ui` project. This plan extracts it into an independent, testable,
publishable package.

---

## 1. Name

**Chosen working name: `Auria`** — `audio` + `ARIA`. It brands the one thing no
competitor offers (narrated audio/video *evidence* of accessibility), reads as a
product rather than a utility, and is gov-procurement-safe.

- CLI / bin: `auria`
- npm package: `auria`
- repo / folder: `auria`
- Tagline candidate: *"See and hear your accessibility gaps."*

**Availability gate (must clear before locking the name):**

- [ ] npm registry name free (`auria`)
- [ ] Domain (`.io` / `.app` / `.dev` acceptable; `.com` preferred)
- [ ] Basic trademark search (USPTO) — the a11y space is litigious
      (Deque/axe, AudioEye, Siteimprove, Level Access, Evinced, Tenon, Pope Tech)

**Runner-up:** `Axcess` (`axe` + `access` — legible to technical buyers, weaker as
a defensible trademark). Compliance-flavored alternative: `Attestly`.

---

## 2. Extraction approach

Preferred: **fresh repo, copy files, note provenance** (MIT-licensed). Clean history,
clean OSS/SaaS split. The current `tools/a11y-video-audit.mjs` stays in
`cpp-payment-ui` untouched so that project keeps working; it can later call
`npx auria` instead of vendoring the script.

Alternative: `git filter-repo` to preserve the file's commit history — only worth
the effort if that history has real value.

---

## 3. Repository structure

The 1,050-line monolith is split into focused, independently testable modules. Each
module has one clear responsibility, a small interface, and explicit dependencies.

```
auria/
├── CLAUDE.md                    # setup + working rules for agents/contributors
├── README.md  LICENSE  CHANGELOG.md  CONTRIBUTING.md
├── package.json  .gitignore  .editorconfig
├── bin/
│   └── auria.mjs                # CLI entry — arg parsing only, delegates to src/
├── src/
│   ├── index.mjs                # library entry: runAudit(job) + runJobs(jobs)
│   ├── config.mjs               # CLI flags + config file -> normalized jobs
│   ├── crawl.mjs                # BFS discoverPages + URL normalize / include-exclude
│   ├── analyze/
│   │   ├── axe.mjs              # axe-core scan at first/last viewport
│   │   ├── layout.mjs          # overflow / 24px targets / sub-12px text per viewport
│   │   ├── strict.mjs          # reflow-320 (1.4.10), zoom-200 (1.4.4)
│   │   └── keyboard.mjs        # tab walk (names/roles) + keyboard-trap (2.1.2)
│   ├── narrate/
│   │   ├── plan.mjs            # analysis -> ordered narration script + actions
│   │   ├── tts.mjs             # ★ pluggable TTS interface (synth text -> wav)
│   │   ├── tts-windows.mjs     #   System.Speech via gen-voice.ps1 (default on Win)
│   │   └── tts-crossplatform.mjs #  Piper / edge-tts for headless Linux / SaaS
│   ├── record.mjs              # Playwright recordVideo + ffmpeg mux + caption overlay
│   ├── nvda.mjs                # Windows-only real NVDA driver (@guidepup)
│   ├── report/
│   │   ├── markdown.mjs        # the canonical report -> markdown
│   │   ├── pdf.mjs             # markdown -> print-styled A4 PDF
│   │   ├── sarif.mjs           # SARIF 2.1.0 for code scanning
│   │   ├── junit.mjs           # JUnit XML for CI dashboards
│   │   └── screenshots.mjs     # annotated full-page PNGs
│   └── dashboard.mjs           # global + per-host index.html generation
├── assets/
│   └── gen-voice.ps1           # Windows TTS renderer (unchanged)
├── examples/
│   ├── pages.sample.json
│   └── pages.public-test.json
├── docs/
│   ├── PLAN.md                 # (this file)
│   ├── architecture.md         # module map + data flow
│   ├── cli.md                  # full flag / config reference
│   ├── crawl.md                # crawler + regex-filter guide
│   ├── nvda.md                 # real screen-reader mode
│   ├── wcag-coverage.md        # every check mapped to its WCAG SC
│   ├── interpreting-results.md # what findings mean + limitations
│   └── monetization-and-saas.md # business model + hosted architecture
├── test/
│   ├── unit/                   # pure logic, no browser
│   ├── integration/            # against local HTML fixtures
│   └── fixtures/               # deliberately-broken pages
└── .github/workflows/ci.yml    # lint + unit (Linux) + integration; Win job for TTS/NVDA
```

**Module-boundary rules**

- `src/analyze/*` are pure "look at a page, return data" functions — no file writes,
  no narration. They take a Playwright `page` and return plain objects.
- `src/report/*` and `src/dashboard.mjs` take analysis data and emit artifacts —
  they never touch a browser.
- `src/narrate/tts.mjs` is the seam that lets the engine run headless on Linux; the
  rest of `narrate`/`record` must depend on the interface, never on Windows directly.
- `bin/auria.mjs` does argument parsing only and calls into `src/index.mjs`.

---

## 4. Testing plan

The monolith ships with **zero tests** — the top quality gap to close.

| Layer | Runs on | Covers |
| --- | --- | --- |
| **Unit** (no browser) | Linux + Win | `normalizeUrl`, include/exclude regex, `slugify`, auth normalization, config precedence, baseline diff, WAV assembly math, SARIF/JUnit serialization |
| **Integration** (Playwright + fixtures) | Linux + Win | each analyzer catches its target defect (missing `h1`, overflow, tiny tap targets, keyboard trap, no viewport meta) |
| **Crawler** | Linux + Win | discovery, dedupe, depth bounds, include/exclude pruning, dead-link survival |
| **Smoke** | Linux + Win | `--no-video` end-to-end produces JSON + PDF |
| **Windows-only** | Win | TTS rendering, `--nvda` availability probe + error message |

Runner: Node's built-in `node:test`. Fixtures are local HTML files so tests are
deterministic and offline.

---

## 5. Cross-platform narration (the SaaS enabler)

The narrated-video pipeline is Windows-bound today only because of `System.Speech`
TTS. `ffmpeg` and Playwright `recordVideo` already run headless on Linux.

`src/narrate/tts.mjs` defines the seam: `synth(text, { voice, rate }) -> wav buffer`.

- **Windows impl** (`tts-windows.mjs`) → existing `gen-voice.ps1`. Best quality;
  default on Windows.
- **Cross-platform impl** (`tts-crossplatform.mjs`) → **Piper** (offline neural TTS,
  MIT, no per-use cost — best server economics) or **edge-tts** (higher quality,
  network dependency).

Once TTS is pluggable, **the entire narrated audit runs server-side in a Linux
container.** `--nvda` (real screen reader) stays Windows-only and is served by a
small dedicated Windows worker pool as a premium feature.

---

## 6. Monetization (tuned for gov / public-sector)

**Open-core.** The MIT CLI drives adoption and trust (gov engineers vet the source);
revenue comes from the hosted and compliance layers.

| Stream | What | Why gov pays |
| --- | --- | --- |
| **Compliance deliverables** ⭐ | Auto-generated VPAT/ACR + narrated evidence video per audit | The killer artifact: 508 remediation + legal need human-legible proof; video sells to non-technical accessibility coordinators. Per-report or subscription. |
| **Hosted SaaS subscription** | Scheduled scans, trend dashboards, baseline alerts, team/RBAC | Continuous 508 monitoring across many portals; priced per-site/domain or scan-volume tiers. |
| **Self-hosted / on-prem license** ⭐ | Whole platform inside their tenancy (annual license) | Gov security often forbids sending pages to a third-party cloud — on-prem is a *requirement* and a high-margin lever. |
| **Usage credits** | Scan-minutes / video-render credits for burst audits | Aligns cost with actual browser + render time. |
| **Services & support** | SLA, remediation consulting, custom rules | Standard gov line-item; sticky revenue. |

Gov buys **annual subscriptions/licenses via PO**, not month-to-month cards. Design
billing around invoicing + procurement; Stripe self-serve only for the commercial tier.

---

## 7. SaaS architecture (reference for the build-later phase)

```
Web app (Next.js)  ──►  API (REST) ──►  Job queue (Redis/BullMQ or SQS)
  dashboards/orgs        auth, RBAC          │
  billing, scheduling    SAML/SSO (gov)      ▼
                                      Worker fleet (Playwright in containers)
                                      ├─ Linux workers: axe/layout/keyboard/video (Piper TTS)
                                      └─ Windows pool:  --nvda real screen-reader jobs
                                                  │
        Postgres (accounts/scans/results)  ◄─────┤────►  Object storage (S3): mp4/pdf/json
```

- The refactored `src/` becomes the **engine library** every worker imports — reuse,
  not rewrite.
- The existing dashboard HTML is the **seed** for the web UI.
- Gov cross-cutting concerns: SSO/SAML, audit logging, data residency, per-tenant
  isolation, and a long-term path to **FedRAMP/StateRAMP** (gates the biggest deals).
  Self-hosted sidesteps much of this early.

---

## 8. Phasing

1. **P1 — Extract & harden:** new repo, modularize, add tests + docs, publish OSS CLI.
   Ship value now; validate the name.
2. **P2 — Cross-platform TTS + headless video:** prove one Linux container runs a full
   audit including narrated video.
3. **P3 — Compliance deliverables:** VPAT/ACR generator + polished evidence video.
   First thing gov will *pay* for — sellable before full SaaS.
4. **P4 — Hosted platform:** API, workers, dashboard, scheduling, billing; self-hosted
   enterprise build alongside. **Design:** [p4-saas-design.md](p4-saas-design.md) (awaiting
   sign-off before any code; the SaaS lives in a separate repo, not this OSS engine).

**Beyond P4** — once the platform is built, the focus shifts from building to distribution
and the compliance moat (pilots, human-in-the-loop ACR completion, FedRAMP, CI/CD +
monitoring): [roadmap-post-p4.md](roadmap-post-p4.md).

---

## 9. Open items

1. **Name gate** — verify `Auria` (npm + domain + trademark) before locking.
2. **Module split** — confirm the `src/` decomposition in §3.
3. **TTS engine for P2** — Piper (offline, cheap) vs edge-tts (quality, networked).
4. **Repo hosting** — GitHub public (OSS) with a private SaaS repo, or monorepo.
5. **License** — MIT for the CLI is assumed here; confirm.
