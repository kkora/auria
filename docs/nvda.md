# Real NVDA mode

`--nvda` (or `"nvda": true`) drives a **real NVDA screen reader** during the keyboard
walk instead of simulated narration, capturing what actual assistive technology
announces. Windows-only.

## One-time setup

1. Install NVDA (free — [nvaccess.org](https://www.nvaccess.org/)).
2. Run `npx @guidepup/setup` — installs and configures NVDA for automation (the
   Guidepup NVDA add-on). This is not a browser add-on.

## During the audit

- The browser runs **headed** (visible) and **must stay focused** for the whole walk
  — NVDA reads from the focused window. Switching focus away fails the capture.
- Each Tab is pressed *through NVDA*; its real spoken phrase is recorded per stop.

## In the output

- The report's keyboard-walk table gains an "NVDA announced" column.
- In the video, the captured NVDA text is **re-voiced** by the same TTS voice — so
  the video carries real screen-reader behavior, not an approximation.

## Errors

If NVDA or the Guidepup add-on is unavailable, the run **fails immediately** with the
fix (`npx @guidepup/setup`). Test override: `GUIDEPUP_NVDA_UNAVAILABLE=1` forces the
unavailable branch.

## SaaS note

In a hosted deployment, `--nvda` jobs are routed to a dedicated **Windows worker
pool**; all other audit work runs on Linux workers (see [PLAN.md](PLAN.md) §7).
