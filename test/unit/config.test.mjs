import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, slugFromUrl } from "../../src/config.mjs";

test("slugify: root/empty path becomes 'home'", () => {
  assert.equal(slugify("/"), "home");
  assert.equal(slugify(""), "home");
});

test("slugify: strips extension and lowercases", () => {
  assert.equal(slugify("/Checkout.HTML"), "checkout");
});

test("slugify: collapses non-alphanumerics to single dashes", () => {
  assert.equal(slugify("/pay/step 2"), "pay-step-2");
});

test("slugFromUrl: slugifies the pathname only", () => {
  assert.equal(slugFromUrl("https://x.gov/forms/apply?ref=nav"), "forms-apply");
});

import { normalizeAuth } from "../../src/config.mjs";

test("normalizeAuth: undefined auth yields empty structures", () => {
  assert.deepEqual(normalizeAuth(undefined, "https://x.gov/"), { cookies: [], headers: {} });
});

test("normalizeAuth: string cookies split into scoped objects", () => {
  const { cookies } = normalizeAuth({ cookies: "a=1; b=2" }, "https://x.gov/");
  assert.deepEqual(cookies, [
    { name: "a", value: "1", url: "https://x.gov/" },
    { name: "b", value: "2", url: "https://x.gov/" },
  ]);
});

test("normalizeAuth: array cookies get url only when domain/url absent", () => {
  const { cookies } = normalizeAuth({
    cookies: [
      { name: "s", value: "x" },
      { name: "d", value: "y", domain: ".x.gov" },
    ],
  }, "https://x.gov/");
  assert.deepEqual(cookies, [
    { name: "s", value: "x", url: "https://x.gov/" },
    { name: "d", value: "y", domain: ".x.gov" },
  ]);
});

test("normalizeAuth: headers pass through, default empty", () => {
  assert.deepEqual(normalizeAuth({ headers: { A: "b" } }, "https://x.gov/").headers, { A: "b" });
  assert.deepEqual(normalizeAuth({ cookies: "a=1" }, "https://x.gov/").headers, {});
});
