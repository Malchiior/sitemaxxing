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
  assert.match(prompt, /FIX LIST FOR SBEOC\.COM/);
  assert.match(prompt, /FIX FIRST[\s\S]*don't load[\s\S]*https:\/\/sbeoc\.com\/logo\.png/);
  assert.match(prompt, /WHEN THERE'S TIME[\s\S]*big/);
  assert.doesNotMatch(prompt, /^THEN$/m);
  assert.doesNotMatch(prompt, /\*\*|^#/m, "no markdown syntax");
});

test("the result text: scores by device group, dots, worst first, no URLs", async () => {
  const { resultMessage } = await import("../render/summarize.mjs");
  const withIds = { ...audit, screens: [
    { ...audit.screens[0], id: "iphone-se", score: 75 },
    { ...audit.screens[1], id: "iphone", score: 71 },
    { ...audit.screens[2], id: "desktop", score: 100 },
  ] };
  const text = resultMessage({ url: "https://sbeoc.com", audit: withIds, seo: { issues: [{ severity: "medium", area: "seo", key: "no-description", title: "x" }] } });
  const lines = text.split("\n");
  assert.equal(lines[0], "sbeoc.com fit check: 71–75 on phones, 100 on computers.");
  assert.equal(lines[1], '🔴 "Logo" image missing on iPhone SE and iPhone 15');
  assert.equal(lines[2], "🟡 No Google description");
  assert.match(text, /\+1 smaller in the report\./);
  assert.doesNotMatch(text, /https?:\/\//);
});

test("where() names device groups in plain words", async () => {
  const { where } = await import("../render/labels.mjs");
  assert.equal(where(["android-small", "iphone-se", "iphone", "iphone-max"]), "phones");
  assert.equal(where(["android-small", "iphone-se", "iphone", "iphone-max", "ipad-portrait"]), "phones and iPad portrait");
  assert.equal(where(["android-small", "iphone-se", "iphone", "iphone-max", "ipad-portrait", "ipad-landscape", "laptop", "desktop", "ultrawide"]), "all screens");
  assert.equal(where(["laptop", "desktop", "ultrawide", "ipad-landscape"]), "iPad landscape and computers");
});
