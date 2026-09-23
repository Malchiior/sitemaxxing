// Run: node --test tests/recheck.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffRuns, recheckLines, recheckMessage } from "../render/summarize.mjs";
import { diffName } from "../render/labels.mjs";
import { earlierRuns, pageKey, previousRun } from "../plugins/ro/runs.ts";

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

test("the re-check text: one line per fact; the detail lines are separate", () => {
  const before = run([50, 75, 90], [logo, sideways, taps], [noDescription, noLlms]);
  const after = run([88, 75, 90], [taps], [noDescription, noLlms]);
  const text = recheckMessage(after, before);
  assert.equal(text, "sbeoc.com (report 2) · last Sep 22\nfixed 2, same 3, new 0\nScore: 📱 phones 88 🟡 · tablets 75 🟡 · 💻 computers 90 🟢");
  assert.match(recheckMessage({ ...after, reportNumber: 5 }, before), /^sbeoc\.com \(report 5\)/);
  assert.deepEqual(recheckLines(after, before), [
    'Fixed: the "Logo" image, the sideways scroll.',
    "Still there: buttons too small to tap, the missing description, plus 1 small thing in the report.",
    "New: nothing.",
    "Google and AI unchanged.",
  ]);
  const withPages = { ...after, pages: [{ path: "/about", label: "/about" }] };
  assert.match(recheckMessage(withPages, before), /\nText pages for a report on \/about$/);
  const deeper = { ...after, audit: { ...after.audit, finalUrl: "https://www.sbeoc.com/pricing/" } };
  assert.match(recheckMessage(deeper, before), /^sbeoc\.com\/pricing \(report 2\)/);
});

test("broken images are compared one by one: fixing one of two is credited, a new one is new", () => {
  const logoAndHero = issue("high", "broken-images", "2 image(s) don't load", [{ src: "logo.jpg", alt: "Logo" }, { src: "hero.jpg", alt: "Hero" }]);
  const hero = issue("high", "broken-images", "1 image(s) don't load", [{ src: "hero.jpg", alt: "Hero" }]);
  const partly = recheckLines(run([50, 75, 90], [hero], []), run([50, 75, 90], [logoAndHero], []));
  assert.deepEqual(partly.slice(0, 3), ['Fixed: the "Logo" image.', 'Still there: the "Hero" image.', "New: nothing."]);
  assert.match(recheckMessage(run([50, 75, 90], [hero], []), run([50, 75, 90], [logoAndHero], [])), /fixed 1, same 1, new 0/);
  const swapped = recheckLines(run([50, 75, 90], [hero], []), run([50, 75, 90], [logo], []));
  assert.deepEqual(swapped.slice(0, 3), ['Fixed: the "Logo" image.', "Still there: nothing.", 'New: the "Hero" image.']);
});

test("after a clean check, a regression says 'Fixed: nothing', not 'nothing yet'", () => {
  const lines = recheckLines(run([75, 100, 100], [sideways], []), run([100, 100, 100], [], []));
  assert.deepEqual(lines.slice(0, 3), ["Fixed: nothing.", "Still there: nothing.", "New: the sideways scroll."]);
});

test("when only small things are left, they're counted, not named; a clean page says so", () => {
  const lines = recheckLines(run([100, 100, 100], [], [noLlms]), run([90, 100, 100], [taps], [noLlms]));
  assert.deepEqual(lines, ["Fixed: buttons too small to tap.", "Still there: 1 small thing in the report.", "New: nothing.", "Google and AI unchanged."]);
  const clean = recheckMessage({ ...run([100, 100, 100], [], []), pages: [{ path: "/about", label: "/about" }] }, run([90, 100, 100], [taps], []));
  assert.match(clean, /nothing left to fix\nScore: 📱 phones 100 🟢 · tablets 100 🟢 · 💻 computers 100 🟢\nText pages for a report on \/about$/);
});

test("the re-check text: several score groups changed, nothing fixed yet, long lists capped", () => {
  const many = ["viewport", "covered", "clipped", "tiny-text", "headline-low", "oversized-images"].map(key => issue("medium", key, key, null));
  const before = run([50, 75, 90], [taps], [noLlms]);
  const after = run([30, 60, 90], [taps, ...many], [noLlms, noDescription]);
  assert.equal(recheckMessage(after, before), "sbeoc.com (report 2) · last Sep 22\nfixed 0, same 2, new 7\nScore: 📱 phones 30 🔴 · tablets 60 🔴 · 💻 computers 90 🟢");
  const lines = recheckLines(after, before);
  assert.equal(lines[0], "Fixed: nothing yet.");
  assert.equal(lines[1], "Still there: buttons too small to tap, plus 1 small thing in the report.");
  assert.equal(lines[2], "New: the missing viewport tag, the pop-up covering the page, the cut-off text, the tiny text and 3 more.");
});

test("the re-check text when everything is fixed and scores didn't move", () => {
  const text = recheckMessage(run([100, 100, 100], [], []), run([100, 100, 100], [], [noLlms]));
  assert.equal(text, "sbeoc.com (report 2) · last Sep 22\nfixed 1, same 0, new 0 · nothing left to fix\nScore: 📱 phones 100 🟢 · tablets 100 🟢 · 💻 computers 100 🟢");
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
  assert.equal(earlierRuns(runs, "https://sbeoc.com/").length, 2, "two finished checks of the homepage");
  assert.equal(previousRun(join(runs, "missing"), "https://sbeoc.com/"), null);
  assert.equal(pageKey("https://WWW.sbeoc.com/about/#top"), "sbeoc.com/about");
  rmSync(runs, { recursive: true, force: true });
});
