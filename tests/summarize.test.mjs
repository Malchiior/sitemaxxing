// Run: node --test tests/summarize.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupScreenIssues, repairedImageUrl, fixPrompt } from "../render/summarize.mjs";

const screen = (label, width, issues) => ({ label, width, height: 800, issues, measurements: {} });
const audit = { finalUrl: "https://sbeoc.com/", screens: [
  screen("iPhone SE", 375, [{ severity: "high", key: "broken-images", title: "1 image(s) don't load", evidence: [{ src: "x.jpg", alt: "Logo" }] }]),
  screen("iPhone 15", 393, [{ severity: "high", key: "broken-images", title: "1 image(s) don't load", evidence: [{ src: "x.jpg", alt: "Logo" }] }, { severity: "low", key: "oversized-images", title: "big", evidence: [] }]),
  screen("Desktop", 1920, []),
] };

test("issues are grouped across screens, worst first", () => {
  const grouped = groupScreenIssues(audit);
  assert.equal(grouped[0].key, "broken-images");
  assert.deepEqual(grouped[0].screens, ["iPhone SE 375×800", "iPhone 15 393×800"]);
  assert.equal(grouped[1].key, "oversized-images");
});

test("a URL with the domain pasted mid-path is repaired; normal URLs aren't", () => {
  assert.equal(repairedImageUrl("wp-contehttps://sbeoc.com/nt/uploads/logo.jpg", "https://sbeoc.com"), "https://sbeoc.com/wp-content/uploads/logo.jpg");
  assert.equal(repairedImageUrl("https://sbeoc.com/logo.jpg", "https://sbeoc.com"), null);
  assert.equal(repairedImageUrl("/uploads/logo.jpg", "https://sbeoc.com"), null);
});

test("the fix prompt only contains measured issues, in priority sections", () => {
  const prompt = fixPrompt({ url: "https://sbeoc.com", date: "2026-09-23", audit, seo: { issues: [] }, repairs: ["x.jpg -> https://sbeoc.com/logo.png"] });
  assert.match(prompt, /# Fix list for sbeoc\.com/);
  assert.match(prompt, /## Fix first[\s\S]*don't load[\s\S]*https:\/\/sbeoc\.com\/logo\.png/);
  assert.match(prompt, /## When there's time[\s\S]*big/);
  assert.doesNotMatch(prompt, /## Then/);
});
