// Unit tests for applySteps — driven against a stub `page` (no real browser needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { applySteps } from "../../src/browser.mjs";

function stubPage() {
  const calls = [];
  const rec = m => (...a) => { calls.push([m, ...a]); return Promise.resolve(); };
  return {
    calls,
    click: rec("click"),
    fill: rec("fill"),
    selectOption: rec("select"),
    focus: rec("focus"),
    waitForTimeout: rec("wait"),
    keyboard: { press: rec("press") },
  };
}

test("applySteps: dispatches each step kind, then a trailing settle wait", async () => {
  const page = stubPage();
  await applySteps(page, [{ click: "#a" }, { fill: "#b", value: "x" }, { press: "Enter" }, { wait: 100 }]);
  assert.deepEqual(page.calls.map(c => c[0]), ["click", "fill", "press", "wait", "wait"]);
  // the explicit {wait:100} plus the 400ms post-steps settle
  assert.equal(page.calls.filter(c => c[0] === "wait").at(-1)[1], 400);
});

test("applySteps: a failing step is swallowed, not fatal — later steps still run", async () => {
  const page = stubPage();
  page.click = () => Promise.reject(new Error("boom"));
  await assert.doesNotReject(() => applySteps(page, [{ click: "#x" }, { focus: "#y" }]));
  assert.ok(page.calls.some(c => c[0] === "focus"), "focus step ran after the failing click");
});

test("applySteps: no settle wait when there are no steps", async () => {
  const page = stubPage();
  await applySteps(page, []);
  await applySteps(page, undefined);
  assert.equal(page.calls.length, 0);
});
