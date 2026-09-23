// Run: node --test tests/recheck.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffRuns, recheckMessage } from "../render/summarize.mjs";
import { diffName } from "../render/labels.mjs";
import { pageKey, previousRun } from "../plugins/ro/runs.ts";

const issue = (severity, key, title, evidence = null) => ({ severity, key, title, evidence });
const screen = (id, score, issues) => ({ id, label: id, width: 375, height: 800, score, issues, measurements: {} });
const run = (scores, screenIssues, seoIssues) => ({
  url: "https://sbeoc.com/", audit: { finalUrl: "https://sbeoc.com/", finishedAt: "2026-09-22T10:00:00.000Z", screens: [
    screen("iphone", scores[0], screenIssues), screen("ipad-portrait", scores[1], []), screen("laptop", scores[2], []),
  ] }, seo: { issues: seoIssues },
});

const logo = issue("high", "broken-images", "1 image(s) don't load", [{ src: "x.jpg", alt: "Logo" }]);
const sideways = issue("high", "sideways", "The page scrolls sideways by 38px", []);
const taps = issue("medium", "tap-targets", "6 button(s) are under 24px", []);
const noDescription = issue("medium", "no-description", "No meta description", null);
const noLlms = issue("low", "no-llms-txt", "No llms.txt", null);

test("diffRuns: fixed, still there and new, by problem", () => {
  const before = run([50, 75, 90], [logo, sideways, taps], [noDescription, noLlms]);
  const after = run([88, 75, 90], [taps], [noDescription, noLlms, issue("low", "title-cut", "Google cuts the title off (70 characters)", "t")]);
  const d = diffRuns(before, after);
  assert.deepEqual(d.fixed.map(i => i.key), ["broken-images", "sideways"]);
  assert.deepEqual(d.still.map(i => i.key), ["tap-targets", "no-description", "no-llms-txt"]);
  assert.deepEqual(d.added.map(i => i.key), ["title-cut"]);
  assert.equal(d.googleAndAiUnchanged, false);
  assert.equal(d.scores.before.phones.text, "50");
  assert.equal(d.scores.after.phones.text, "88");
});

test("the re-check text has the shape of 'Re-check after a deploy'", () => {
  const before = run([50, 75, 90], [logo, sideways, taps], [noDescription, noLlms]);
  const after = run([88, 75, 90], [taps], [noDescription, noLlms]);
  const text = recheckMessage(after, before);
  assert.equal(text, [
    "sbeoc.com again, 9 screens, compared with Sep 22. Phones went from 50 to 88. Tablets and computers unchanged.",
    'Fixed: the "Logo" image, the sideways scroll.',
    "Still there: buttons too small to tap, the missing description, plus 1 small thing in the report.",
    "New: nothing.",
    "Google and AI unchanged.",
    "",
    "Report card and full PDF below. Reply fix for what's left.",
  ].join("\n"));
  assert.doesNotMatch(text, /https?:\/\//);
  const withPages = { ...after, pages: [{ path: "/about", label: "/about" }, { path: "/contact", label: "/contact" }] };
  assert.match(recheckMessage(withPages, before), /Reply fix for what's left, or pages to check \/about and \/contact too\.$/);
  const deeper = { ...after, audit: { ...after.audit, finalUrl: "https://www.sbeoc.com/pricing/" } };
  assert.match(recheckMessage(deeper, before), /^sbeoc\.com\/pricing again, 9 screens/);
});

test("broken images are compared one by one: fixing one of two is credited, a new one is new", () => {
  const logoAndHero = issue("high", "broken-images", "2 image(s) don't load", [{ src: "logo.jpg", alt: "Logo" }, { src: "hero.jpg", alt: "Hero" }]);
  const hero = issue("high", "broken-images", "1 image(s) don't load", [{ src: "hero.jpg", alt: "Hero" }]);
  const partly = recheckMessage(run([50, 75, 90], [hero], []), run([50, 75, 90], [logoAndHero], []));
  assert.match(partly, /\nFixed: the "Logo" image\.\nStill there: the "Hero" image\.\nNew: nothing\.\n/);
  const swapped = recheckMessage(run([50, 75, 90], [hero], []), run([50, 75, 90], [logo], []));
  assert.match(swapped, /\nFixed: the "Logo" image\.\nStill there: nothing\.\nNew: the "Hero" image\.\n/);
});

test("after a clean check, a regression says 'Fixed: nothing', not 'nothing yet'", () => {
  const text = recheckMessage(run([75, 100, 100], [sideways], []), run([100, 100, 100], [], []));
  assert.match(text, /\nFixed: nothing\.\nStill there: nothing\.\nNew: the sideways scroll\.\n/);
  assert.match(text, /Reply fix for what's left\.$/);
});

test("when only small things are left, they're counted, not named, and the closing says so", () => {
  const text = recheckMessage(run([100, 100, 100], [], [noLlms]), run([90, 100, 100], [taps], [noLlms]));
  assert.match(text, /\nFixed: buttons too small to tap\.\nStill there: 1 small thing in the report\.\nNew: nothing\.\nGoogle and AI unchanged\.\n\nReport card and full PDF below\. Nothing broken left; the small things are in the report\. Reply fix if you want those written up\.$/);
  const clean = recheckMessage({ ...run([100, 100, 100], [], []), pages: [{ path: "/about", label: "/about" }] }, run([90, 100, 100], [taps], []));
  assert.match(clean, /Nothing left to fix on this page\. Reply pages to check \/about too\.$/);
});

test("the re-check text: nothing fixed yet, several score groups changed, long lists are capped", () => {
  const many = ["viewport", "covered", "clipped", "tiny-text", "headline-low", "oversized-images"].map(key => issue("medium", key, key, null));
  const before = run([50, 75, 90], [taps], [noLlms]);
  const after = run([30, 60, 90], [taps, ...many], [noLlms, noDescription]);
  const text = recheckMessage(after, before);
  assert.match(text, /^sbeoc\.com again, 9 screens, compared with Sep 22\. Phones went from 50 to 30, tablets from 75 to 60\. Computers unchanged\.\n/);
  assert.match(text, /\nFixed: nothing yet\.\n/);
  assert.match(text, /\nStill there: buttons too small to tap, plus 1 small thing in the report\.\n/);
  assert.match(text, /\nNew: the missing viewport tag, the pop-up covering the page, the cut-off text, the tiny text and 3 more\.\n/);
  assert.doesNotMatch(text, /Google and AI unchanged/);
});

test("the re-check text when everything is fixed and scores didn't move", () => {
  const before = run([100, 100, 100], [], [noLlms]);
  const after = run([100, 100, 100], [], []);
  const text = recheckMessage(after, before);
  assert.equal(text.split("\n")[0], "sbeoc.com again, 9 screens, compared with Sep 22. Scores unchanged: 100 on phones, 100 on tablets, 100 on computers.");
  assert.match(text, /\nFixed: the missing llms\.txt\.\nStill there: nothing\.\nNew: nothing\.\n\nReport card and full PDF below\. Nothing left to fix on this page\.$/);
});

test("every problem has a short name for the re-check lists", () => {
  const keys = ["viewport", "sideways", "headline-cut", "covered", "broken-images", "headline-low", "tiny-text", "tap-targets", "cramped-targets", "clipped", "heavy", "action-low", "oversized-images",
    "unreachable", "noindex", "google-blocked", "no-title", "title-cut", "no-description", "description-cut", "no-h1", "many-h1", "alt-text", "no-share-image", "no-canonical", "no-sitemap",
    "firewall", "thin", "js-only", "ai-blocked", "no-schema", "no-llms-txt", "no-lang"];
  for (const key of keys) assert.notEqual(diffName({ key, title: "TITLE" }), "TITLE", key);
  assert.equal(diffName({ key: "broken-images", evidence: [{ src: "a" }, { src: "b" }] }), "the 2 missing images");
  assert.equal(diffName({ key: "broken-images", evidence: [{ src: "a" }] }), "the missing image");
  const long = diffName({ key: "broken-images", evidence: [{ src: "a", alt: "x".repeat(200) + "\n\n end" }] });
  assert.ok(long.length < 80 && long.includes("…") && !long.includes("\n"), long);
});

test("previousRun finds the newest finished check of the same page, never a pages run", () => {
  const runs = mkdtempSync(join(tmpdir(), "ro-runs-"));
  const make = (name, summary, complete = true) => {
    mkdirSync(join(runs, name));
    writeFileSync(join(runs, name, "summary.json"), JSON.stringify(summary));
    if (complete) { writeFileSync(join(runs, name, "audit.json"), "{}"); writeFileSync(join(runs, name, "seo.json"), "{}"); }
  };
  make("20260921T100000-sbeoc.com", { kind: "page", site: "https://sbeoc.com/", requested: "https://sbeoc.com/" });
  make("20260922T100000-sbeoc.com", { kind: "page", site: "https://www.sbeoc.com/", requested: "https://www.sbeoc.com/" });
  make("20260922T110000-sbeoc.com-pages", { kind: "pages", site: "https://sbeoc.com/", pages: [] });
  make("20260922T120000-sbeoc.com", { kind: "page", site: "https://sbeoc.com/pricing", requested: "https://sbeoc.com/pricing" });
  make("20260922T130000-sbeoc.com", { kind: "page", site: "https://sbeoc.com/", requested: "https://sbeoc.com/" }, false);
  make("20260922T140000-other", { site: "https://fluidicsystems.com/" });
  make("20260922T145000-redirected", { kind: "page", site: "https://www.example.com/home", requested: "https://example.com/" });
  mkdirSync(join(runs, "20260922T150000-junk"));
  assert.equal(previousRun(runs, "https://sbeoc.com"), join(runs, "20260922T100000-sbeoc.com"), "newest complete check of the homepage, www ignored");
  assert.equal(previousRun(runs, "https://sbeoc.com/pricing/"), join(runs, "20260922T120000-sbeoc.com"));
  assert.equal(previousRun(runs, "https://fluidicsystems.com/"), join(runs, "20260922T140000-other"), "an older run without 'requested' matches by site");
  assert.equal(previousRun(runs, "https://example.com/home"), join(runs, "20260922T145000-redirected"), "matches where the earlier check landed, too");
  assert.equal(previousRun(runs, "https://sbeoc.com/about"), null);
  assert.equal(previousRun(join(runs, "missing"), "https://sbeoc.com/"), null);
  assert.equal(pageKey("https://WWW.sbeoc.com/about/#top"), "sbeoc.com/about");
  rmSync(runs, { recursive: true, force: true });
});
