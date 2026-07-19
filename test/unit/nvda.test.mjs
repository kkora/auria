// Unit test for the NVDA preflight's test-override branch (no NVDA install needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { nvdaPreflight } from "../../src/nvda.mjs";

test("nvdaPreflight: honors the GUIDEPUP_NVDA_UNAVAILABLE test override", async () => {
  const prev = process.env.GUIDEPUP_NVDA_UNAVAILABLE;
  process.env.GUIDEPUP_NVDA_UNAVAILABLE = "1";
  try {
    await assert.rejects(() => nvdaPreflight(), /forced unavailable/);
  } finally {
    if (prev === undefined) delete process.env.GUIDEPUP_NVDA_UNAVAILABLE;
    else process.env.GUIDEPUP_NVDA_UNAVAILABLE = prev;
  }
});
