# Handoff — continuing P4 (Auria hosted platform)

A pointer doc so a fresh Claude Code session (rooted at **`auria-cloud`**) can pick up P4
without re-deriving context. Everything here is already committed across the two repos.

## The two repos

| Repo | Path | Role | Branch model |
| --- | --- | --- | --- |
| `auria` | `c:\repos\CT\auria` | OSS engine (CLI). Released **v0.2.0**. | `main` (locked, default) + `develop` (work) |
| `auria-cloud` | `c:\repos\CT\auria-cloud` | **Private** SaaS: API + queue + workers. **P4a done.** | `main` |

**Work the repo you're rooted in.** Engine change → session in `auria`. Cloud change →
session in `auria-cloud`. A Claude session can only edit files under its own root.

## Read first (the plan)

- **[docs/p4-saas-design.md](docs/p4-saas-design.md)** — the P4 architecture. §9 = build
  order (P4a→P4d), §10 = the decisions (all made, below), §11 = the P4a slice (done).
- **`auria-cloud/README.md`** — how to run the stack + known gaps.

## Decisions locked (from §10)

1. **Separate `auria-cloud` repo** (private), engine pinned as a library dep
   `github:kkora/auria#v0.2.0`. The OSS engine repo never absorbs SaaS code.
2. **Self-hosted `docker-compose`** first (Postgres + Redis + MinIO + API + worker).
3. **Auth: Keycloak OIDC**, deferred to P4b. P4a uses a static `x-api-key`.
4. **Web app: Next.js**, seeded by the engine's dashboard HTML + the `vpat.json` /
   `vpat-history.json` artifacts (conformance tables + trend charts are rendering data we
   already emit).

## P4a — DONE and proven end-to-end (do not redo)

Committed to `auria-cloud` (`main`, HEAD `f17df25`). Verified on a live local stack:
enqueue a scan → worker runs `runAudit` (engine unchanged) → **55 VPAT criteria + summary
persisted to Postgres**, artifacts (real VPAT **PDF**, axe/vpat JSON) in MinIO, served via
**signed URLs**; committed `npm test` green (2/2).

- API (Fastify): `POST /v1/projects`, `POST /v1/projects/:id/scans`, `GET /v1/scans/:id`,
  `/conformance`, `/artifacts/:kind` (signed URL), `/projects/:id/trend`.
- Queue: BullMQ/Redis. Worker: `src/worker/worker.mjs` (temp-dir → upload → parse to DB).
- Storage: `src/storage.mjs` (signed URLs only). DB: `db/schema.sql`.
- **Fixed during P4a:** worker Playwright base image must match the engine's
  `playwright-core` (currently `v1.61.1-jammy`) or the browser launch fails.

## P4b — the next slice (what to build next)

Next.js web app + real auth, in the `auria-cloud` repo:

1. Next.js app (in `auria-cloud`, e.g. `web/`) — scan list, scan detail rendering the
   **VPAT JSON** (conformance table) + **trend history** (chart from `/projects/:id/trend`),
   embedded evidence video. Reuse the look of the engine's `src/dashboard.mjs`.
2. Turn on **evidence video** in the worker (currently `video: false`) for P4b.
3. **Keycloak OIDC** auth + org/user/RBAC tables (extend `db/schema.sql`), tenant-scope
   every query by `org_id`.
4. Add Keycloak + the web app to `docker-compose.yml`.

Later: P4c (scheduling + billing, reuse `--fail-on-regression` semantics), P4d (audit log,
KMS, data residency, Windows/NVDA worker pool).

## Ground rules (both repos)

- **Commits: kkora only** — never add a `Co-Authored-By: Claude` trailer or "Generated
  with Claude Code" line. (This bit me once in `auria-cloud`; the first commit was amended.)
- Engine boundaries still hold in the CLI: `analyze/*` never write files; `report/*` never
  open a browser; auth values never land in artifacts (counts only) — this invariant
  extends into the cloud (secrets encrypted, artifacts via signed URLs).
- `auria` releases: bump version + CHANGELOG on `develop`, unlock `main` → ff → **re-lock**,
  tag, push (the tag triggers the GHCR publish workflow).

## Optional unblock

If P4b workers should pin a **published** engine instead of the GitHub tag, run
`npm publish` for `auria@0.2.0` (package is publish-ready) and change the dep to `auria@^0.2.0`.
