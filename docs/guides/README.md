# Auria guides

Task-oriented, step-by-step walkthroughs for each Auria feature. These are the
**how-to manuals**; for terse flag/semantic lookups use the reference docs in
[`docs/`](../) (linked from each guide).

> **Status — scaffold.** The `src/` modules are being ported from the original
> monolith. Until a feature's module lands, its commands describe the *intended*
> behavior (verified against the working monolith) and may not run yet. The
> [porting plan](../PLAN.md) tracks what's live. Guides are updated as each slice
> is implemented.

## Start here

1. [Getting started](getting-started.md) — install, run your first audit, find the output.

## By task

| Guide | Do this when you want to… |
| --- | --- |
| [Audit a single page](auditing-a-single-page.md) | Check one URL; choose viewports, emulation, fast mode. |
| [Audit many pages (config)](auditing-multiple-pages.md) | Run a fixed list of pages with per-page overrides and setup steps. |
| [Crawl a whole site](crawling-a-site.md) | Discover and audit every same-origin page, with include/exclude filters. |
| [Authenticate](authentication.md) | Audit pages behind a login using cookies or headers. |
| [Narrated video](narrated-video.md) | Produce the shareable narrated `.mp4`/`.webm` walkthrough. |
| [Real NVDA mode](nvda-mode.md) | Capture what an actual screen reader announces (Windows). |
| [Reports & artifacts](reports-and-artifacts.md) | Understand every file a run emits (PDF, MD, JSON, SARIF, JUnit, screenshots). |
| [Compliance (VPAT/ACR)](compliance.md) | Generate a draft VPAT® 2 / ACR conformance report with `--vpat`. |
| [CI gating & baselines](ci-gating-and-baselines.md) | Fail a build on regressions; diff against a previous run. |
| [Dashboards](dashboards.md) | Browse findings across all audited pages in one place. |
| [Run in Docker](docker.md) | Run the full audit (incl. narrated video) headless in a Linux container. |
| [Deploy](deployment.md) | Publish the image (GHCR) and run it as a job (VM / Cloud Run / ECS / k8s). |

## Reference docs (not guides)

[cli.md](../cli.md) · [crawl.md](../crawl.md) · [nvda.md](../nvda.md) ·
[wcag-coverage.md](../wcag-coverage.md) · [interpreting-results.md](../interpreting-results.md) ·
[architecture.md](../architecture.md)
