# P4 — Hosted platform (design, for review)

> **Status: DESIGN ONLY.** No SaaS code is written yet. CLAUDE.md gates the SaaS layer
> until the phase is confirmed and, per the repo rules, it should **not** be built into
> this OSS engine repo. This document proposes the architecture, the engine seam, a
> build order, and the decisions that need your call **before any code**. Approve or
> redline it; then we start P4a.

## 1. Goal & scope

Turn the Auria CLI into a hosted service: submit a URL or site, get scans run on a
worker fleet, and browse results (reports, VPATs, trends, evidence video) in a web app —
with orgs, auth, scheduling, and billing. Sell to public-sector buyers who already want
the VPAT/ACR the CLI produces.

**In scope for P4** (phased below): REST API, job queue + worker fleet, Postgres + object
storage, a web app (seeded by the existing dashboard), scheduled scans, regression
alerts, usage billing, and the gov cross-cutting concerns (SSO, audit log, tenant
isolation).

**Non-goals for P4:** rewriting the engine (it is reused verbatim), and FedRAMP
authorization itself (we build *toward* it; the paperwork is its own multi-quarter track).

## 2. Guiding principles

1. **Reuse, don't rewrite.** `src/` is the engine library every worker imports. The API
   and workers are thin orchestration around `runAudit()` / `runJobs()`.
2. **The OSS engine stays clean.** The cloud lives in a **separate repo** (`auria-cloud`)
   that depends on `auria` as a versioned library. This repo keeps its "extract & harden
   the CLI" identity and never grows an API/queue/web app. (Resolves [PLAN.md](PLAN.md) §9
   item 4.)
3. **Self-host first.** Ship a `docker-compose` single-node deployment before any managed
   cloud. It sidesteps most gov compliance early and is itself a sellable enterprise SKU.
4. **The security invariant scales up.** The CLI already never writes auth values into
   artifacts (counts only). In the cloud that extends to: secrets encrypted at rest,
   per-tenant isolation, and artifact URLs that are signed and expiring.

## 3. Architecture

```
                        ┌────────────────────────────────────────────┐
   Web app (Next.js) ──►│ API (REST, Node/Fastify)                    │
   orgs · scans · VPAT   │  auth (SSO/SAML) · RBAC · tenancy · billing │
   trend charts · video  └───────────────┬────────────────────────────┘
        ▲                                 │ enqueue
        │ signed URLs                     ▼
        │                        Job queue (Redis + BullMQ)
        │                                 │
        │                 ┌───────────────┴───────────────┐
        │                 ▼                               ▼
        │        Linux worker pool               Windows worker pool
        │        (this repo's Dockerfile)        (--nvda real screen reader)
        │        axe/layout/keyboard/video       import { runAudit } from 'auria'
        │        import { runAudit } from 'auria'         │
        │                 └───────────────┬───────────────┘
        │                                 │ results + artifacts
        │                                 ▼
        └──── Object storage (S3):  ◄── Postgres (orgs, scans, pages,
              mp4 / pdf / vpat.* / axe.json     findings, vpat, artifacts index)
```

- The **worker imports the engine** and calls `runAudit(job)` per page (or `runJobs` for a
  batch). The engine already returns a structured result and writes the artifact set.
- The **web app is seeded by the existing dashboard** (`src/dashboard.mjs` HTML) and the
  machine-readable artifacts this session added: `*-vpat.json` (conformance tables),
  `*-vpat-history.json` (trend sparkline data), `*-axe.json` (findings). The SaaS UI is
  largely *rendering data we already emit*.

## 4. The engine seam (what the worker calls)

Today (unchanged, reused as-is):

```js
import { runAudit } from "auria";           // one page  -> result object + artifacts on disk
import { runJobs }  from "auria";            // many pages -> dashboards + site VPAT, exit code
import { parseConfigFile, normalizeAuth } from "auria/config";
```

`runAudit(job)` returns `{ outDir, violations, failOnBreached, regressionBreached,
regressedCount, vpat?, analysis? }` and writes `<name>-{axe.json,report.md,report.pdf,
vpat.md,vpat.json,vpat-trend.md,vpat-history.json,...}` under `outDir`.

**Worker flow (zero engine change for P4a):**
1. Pull a scan job from the queue → build the `job` object (URL, viewports, `--vpat`,
   auth, etc.) exactly as the CLI does.
2. `runAudit(job)` into a **temp dir**.
3. Upload the artifact files to S3 under `s3://…/{org}/{scan}/{page}/…`; parse
   `*-vpat.json` + `*-axe.json` into Postgres rows (findings, conformance, summary).
4. Persist the returned result fields (violations, regression flags) on the scan record.
5. Emit progress/terminal events back through the API (SSE/websocket) for the UI.

**Optional later refinement (P4b+):** add an **artifact-sink interface** to the engine
(`{ writeArtifact(name, bytes), putResult(json) }`) so workers stream straight to S3/DB
instead of temp-dir-then-upload. Kept out of P4a to avoid touching the engine before the
service shape is proven. This is the *only* engine change P4 would ever propose, and it
would land in this repo as a normal, backward-compatible feature (local disk stays the
default sink).

## 5. Data model (Postgres, first cut)

| Table | Key columns |
| --- | --- |
| `orgs` | id, name, plan, sso_config, data_region, created_at |
| `users` | id, org_id, email, role (`owner`/`admin`/`member`/`viewer`), sso_subject |
| `projects` | id, org_id, name, base_url, default_config (viewports, `--vpat`, auth ref) |
| `scans` | id, project_id, status (`queued`/`running`/`done`/`failed`), trigger (`manual`/`schedule`/`api`), started_at, finished_at, exit_code |
| `pages` | id, scan_id, url, violations, layout_issues, regression_breached |
| `findings` | id, page_id, rule_id, impact, wcag[], node_count | (counts, never node auth/content) |
| `conformance` | id, page_id (or scan_id for site), sc, level, conformance, remarks | ← from `vpat.json` |
| `conformance_history` | id, project_id, date, summary(jsonb) | ← from `vpat-history.json`; powers trend charts |
| `artifacts` | id, scan_id, page, kind (`mp4`/`pdf`/`vpat_md`/`vpat_json`/…), s3_key, bytes |
| `secrets` | id, project_id, kind (`cookie`/`header`/`login_step`), ciphertext | (KMS-encrypted; never leaves the worker in plaintext, never in artifacts) |
| `schedules` | id, project_id, cron, config, fail_on_regression | |
| `usage_events` | id, org_id, scan_id, pages, worker_seconds, video_seconds, ts | ← billing meter |

## 6. API surface (REST, first cut)

| Method + path | Purpose |
| --- | --- |
| `POST /v1/projects` | Create a project (base URL + default config) |
| `POST /v1/projects/:id/scans` | Enqueue a scan (optional config override) |
| `GET /v1/scans/:id` | Scan status + summary (violations, conformance tally, regression flags) |
| `GET /v1/scans/:id/pages` | Per-page results |
| `GET /v1/scans/:id/artifacts/:kind` | **Signed, expiring** URL to an artifact (mp4/pdf/vpat) |
| `GET /v1/projects/:id/trend` | Conformance history for charts (`conformance_history`) |
| `POST /v1/projects/:id/schedules` | Create a recurring scan (+ regression alerting) |
| `GET /v1/scans/:id/events` | SSE stream of progress (queued→running→done) |
| `POST /v1/webhooks` | Register a webhook (scan finished / regression detected) |

Auth: bearer tokens (API keys per org) for the API; SSO/SAML or OIDC for the web app.
RBAC enforced per-org; every query is tenant-scoped by `org_id`.

## 7. Worker fleet

- **Linux pool** runs everything except real NVDA: this repo's `Dockerfile` is the base
  image, `npm i auria@<version>`, and a small queue-consumer entrypoint. Autoscaling on
  queue depth. Video via espeak-ng (already proven headless in CI/P2).
- **Windows pool** handles `--nvda` jobs only (real screen-reader evidence) — a smaller,
  pricier pool; jobs routed by a `needsNvda` flag on the queue.
- **Isolation:** one browser context per job (the engine already does this); one job per
  container process for blast-radius control; per-tenant network egress policy.

## 8. Security & gov compliance

- **Tenant isolation** — `org_id` on every row and every S3 prefix; signed URLs scoped to
  the requesting org; row-level checks in the API layer.
- **Secrets** — login cookies/headers/step values encrypted with a per-tenant KMS key;
  decrypted only in-worker, in-memory; **never** persisted to artifacts or logs (the CLI
  invariant, enforced end-to-end).
- **Audit log** — append-only record of who ran/viewed/exported what (a gov procurement
  checkbox).
- **SSO/SAML + OIDC**, **data residency** (`org.data_region` pins storage + workers), and
  a documented control set as the on-ramp to **FedRAMP/StateRAMP**. Self-hosted deploy
  lets an agency keep data in its own boundary and sidestep our authorization timeline.

## 9. Build order (P4 sub-phases)

1. **P4a — Headless MVP (self-hosted).** API (create project/scan, get status/artifacts) +
   Redis/BullMQ + one Linux worker + Postgres + S3 (or MinIO), shipped as `docker-compose`.
   No web app yet — drive it with `curl`/the CLI. Proves the engine-as-worker seam and the
   artifact/DB pipeline end-to-end.
2. **P4b — Web app + auth.** Next.js UI (scan list, scan detail rendering the VPAT JSON +
   trend history, embedded video), org/user/RBAC, SSO. Optional engine artifact-sink.
3. **P4c — Scheduling + billing.** Cron scans, regression alerts/webhooks (reusing
   `--fail-on-regression` semantics), usage metering + plans.
4. **P4d — Gov hardening.** Audit log, data residency, KMS, the FedRAMP control mapping,
   Windows/NVDA pool productionized.

## 10. Decisions needed before P4a

1. **Repo** — confirm a **separate `auria-cloud` repo** depending on `auria` as a library
   (recommended), vs a monorepo. (This repo must not absorb the SaaS per CLAUDE.md.)
2. **Deploy target first** — **self-hosted `docker-compose`** (recommended) vs a managed
   cloud (AWS/GCP/Azure) from day one.
3. **Queue** — **Redis + BullMQ** (recommended; simple, Node-native) vs SQS.
4. **Datastore** — Postgres + S3 (recommended) vs alternatives; MinIO for the self-host box.
5. **Auth provider** — roll OIDC via a provider (Auth0/Clerk/Keycloak) vs build SAML in-house.
6. **Distribution of the engine to workers** — publish `auria` to **npm** (recommended, and
   already prepped) so `auria-cloud` pins a version, vs git submodule/vendoring.

## 11. First concrete slice (once §10 is answered)

Scaffold `auria-cloud`: a Fastify API with `POST /v1/projects/:id/scans` +
`GET /v1/scans/:id`, a BullMQ queue, a Linux worker that imports `auria`, runs one page to
a temp dir, uploads to MinIO, and writes the scan/conformance rows to Postgres — all under
one `docker-compose up`. A single end-to-end test: enqueue a scan of a fixture URL, poll to
`done`, assert the `vpat.json` row and the signed PDF URL exist. That is P4a's walking
skeleton; everything else hangs off it.
