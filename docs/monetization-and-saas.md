# Monetization & SaaS

This is the business-model companion to the engineering plan. The canonical version
of these sections lives in [PLAN.md](PLAN.md) §6–§7; this file is where they get
expanded as the strategy firms up.

## Model: open-core

MIT CLI for adoption and trust (gov engineers vet the source); revenue from the
hosted + compliance layers.

## Revenue streams (see PLAN §6)

1. **Compliance deliverables** ⭐ — VPAT/ACR + narrated evidence video per audit.
2. **Hosted SaaS subscription** — scheduled scans, trend dashboards, alerts, RBAC.
3. **Self-hosted / on-prem license** ⭐ — required by gov security; high margin.
4. **Usage credits** — scan-minutes / video-render credits.
5. **Services & support** — SLA, remediation, custom rules.

Gov buys via **PO / annual license**, not monthly cards — design billing around
invoicing + procurement; Stripe self-serve only for the commercial tier.

## Hosted architecture (see PLAN §7)

Web app (Next.js) → API → job queue → worker fleet (Linux for audit/video with
cross-platform TTS; a Windows pool for `--nvda`). Postgres for accounts/scans/results;
S3 for artifacts. The refactored `src/` is the engine each worker imports.

## Open questions to resolve before building the SaaS

- Pricing metric: per-site/domain vs scan-volume vs seats.
- Data residency + isolation requirements per target agency.
- FedRAMP/StateRAMP timeline (gates the biggest deals) vs on-prem-first.
- TTS backend for cost at scale (Piper offline vs edge-tts).

> Placeholder document — expand with pricing tiers, ICP, and a go-to-market once
> the direction in PLAN §9 is decided.
