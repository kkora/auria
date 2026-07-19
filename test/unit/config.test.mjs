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
