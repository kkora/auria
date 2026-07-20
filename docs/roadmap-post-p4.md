# Roadmap — after auria-cloud (post-P4)

Once the hosted platform (P4a–d, see [p4-saas-design.md](p4-saas-design.md)) is built, the
bottleneck moves from **building** to **distribution + the compliance moat**. More engine
features won't move the needle until real public-sector buyers are running audits through
the platform. This is the strategic sequence; it is deliberately not more feature work.

> **One-line take:** stop widening the engine — prove revenue (pilots + the ACR-completion
> workflow), and run FedRAMP in parallel as the moat.

## 1. Design partners → first paying customers  *(start during P4b/c, not after)*

The platform is unproven until an agency or a Section 508 vendor runs real audits through
it. Land **1–3 pilots** who already need a VPAT; their feedback reorders everything below.
Highest-leverage move — begins the moment P4b has a usable web UI.

- Success signal: a pilot replaces part of their manual VPAT process with Auria and renews.
- Watch for: the gap between the automated draft and what they'll actually sign (→ item 2).

## 2. Human-in-the-loop ACR completion — the paid service layer

Today Auria emits a **draft** VPAT; the "Not Evaluated" rows need a human. What gov *pays*
for is a **finished, signed ACR**. Build the in-app workflow where a specialist:

- works the Not-Evaluated criteria and records real conformance statements,
- confirms/overrides the automated findings,
- exports a certified deliverable (versioned, attributable).

This turns "automated draft" into "certified deliverable" — the margin business, and the
natural upsell on top of self-serve scans. Reuses the `vpat.json` / conformance schema
already in the engine and `auria-cloud`.

## 3. FedRAMP / StateRAMP — the durable moat  *(runs in parallel, starts early)*

[PLAN.md](PLAN.md) §7 flags this as gating the biggest deals. Mostly **non-code**: control
mapping, audit logging, data residency, incident response — much of it seeded in P4d.

- Start the paperwork early; it's a multi-quarter track and the real competitive wall.
- **Self-hosted deploy** (already the P4a posture) is the interim that lets agencies buy
  *before* authorization completes — keep it first-class.

## 4. Continuous-monitoring surface — the recurring-revenue hook

One-off audits are transactions; **monitoring is a subscription.** Productize what the
engine already does:

- **GitHub / GitLab App** — PR gate reusing `--fail-on-regression` (block merges that drop
  conformance).
- **Scheduled scans + regression alerts** to Slack / Teams / webhooks (P4c has the
  scheduler; this is the notification + integration layer).
- **Public status / trend pages** per project (renders the `conformance_history` we store).

Turns the trend + regression-gate work already in the engine into recurring value.

## Sequencing at a glance

| When | Track | Type |
| --- | --- | --- |
| During P4b/c | (1) Pilots / first customers | Go-to-market |
| After P4b | (2) ACR-completion workflow | Product (paid layer) |
| Parallel, early | (3) FedRAMP / StateRAMP | Compliance moat |
| After P4c | (4) CI/CD + monitoring integrations | Product (recurring) |

## Engine-side (`auria`) implications

Most of the above lives in `auria-cloud`, but a few items land back in this repo:

- **npm publish `auria`** so workers/integrations pin a released version (package is ready).
- Possible **artifact-sink interface** (design §4) if streaming to storage beats temp-dir.
- Keep the **draft/Not-Evaluated model honest** — item 2 depends on the engine clearly
  separating "automated finding" from "needs human", which the VPAT generator already does.
