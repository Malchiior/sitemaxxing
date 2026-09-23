// Run: node --test tests/pages.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mainPages, mergeIssues, pageKey, pagePath, pageScore, pagesFixPrompt, pagesIssueLines, pagesMessage } from "../render/pages.mjs";
import { pagesOffer, resultMessage, fixSections } from "../render/summarize.mjs";
import { seoIssues, SITE_WIDE } from "../render/seo.mjs";
import { hostSize, pagesCardHtml } from "../render/card.mjs";
import { pagesReportHtml } from "../render/report.mjs";

const link = (href, text = "") => ({ href, text });

test("mainPages: same site only, normal ports, menu order, each path once, up to four", () => {
  const links = [
    link("https://sbeoc.com/", "Home"), link("https://www.sbeoc.com/about/", "About"), link("/about#team"),
    link("https://sbeoc.com/projects", "Projects"), link("https://instagram.com/sbeoc"), link("mailto:hi@sbeoc.com"),
    link("https://sbeoc.com/brochure.pdf"), link("https://sbeoc.com/wp-login.php"), link("https://sbeoc.com/privacy-policy/"),
    link("https://sbeoc.com:8443/admin"), link("http://sbeoc.com:2096/webmail"), { href: {}, text: "svg logo" }, { href: null }, null,
    link("https://sbeoc.com/contact?ref=nav", "Contact"), link("https://sbeoc.com/careers", "Careers"), link("https://sbeoc.com/blog", "Blog"),
  ];
  const pages = mainPages(links, "https://sbeoc.com/");
  assert.deepEqual(pages.map(p => p.path), ["/about", "/projects", "/contact", "/careers"]);
  assert.equal(pages[0].url, "https://www.sbeoc.com/about");
  assert.equal(pages[0].label, "/about");
  assert.equal(pages[2].url, "https://sbeoc.com/contact", "query strings are dropped");
});

test("mainPages: from a deeper page, the homepage is a candidate and the page itself is not", () => {
  const links = [link("https://sbeoc.com/"), link("https://sbeoc.com/pricing"), link("https://sbeoc.com/about")];
  const pages = mainPages(links, "https://sbeoc.com/pricing/");
  assert.deepEqual(pages.map(p => p.path), ["/", "/about"]);
  assert.equal(pages[0].label, "Home");
  assert.deepEqual(mainPages([], "https://sbeoc.com/"), []);
  assert.deepEqual(mainPages(undefined, "https://sbeoc.com/"), []);
});

test("pagePath and pageKey ignore www, trailing slashes and hashes", () => {
  assert.equal(pagePath("https://www.sbeoc.com/about/"), "/about");
  assert.equal(pagePath("https://sbeoc.com"), "/");
  assert.equal(pageKey("https://WWW.sbeoc.com/about/#x"), pageKey("http://sbeoc.com/about"));
});

const screen = (id, label, score, issues) => ({ id, label, width: 375, height: 800, score, issues, foldJpeg: `/tmp/${id}.jpg`, measurements: {} });
const issue = (severity, key, title, evidence = null) => ({ severity, key, title, evidence });
const auditFor = (issuesByScreen) => ({ finalUrl: "https://sbeoc.com/x", screens: [
  screen("iphone", "iPhone 15", 75, issuesByScreen.iphone ?? []),
  screen("ipad-portrait", "iPad portrait", 100, issuesByScreen.ipad ?? []),
  screen("laptop", "Laptop", 100, issuesByScreen.laptop ?? []),
] });
const withIssues = page => ({ ...page, issues: [
  ...Object.values(page.audit.screens.flatMap(s => s.issues).reduce((m, i) => ({ ...m, [i.key]: { ...i, screenIds: page.audit.screens.filter(s => s.issues.some(x => x.key === i.key)).map(s => s.id), short: i.title } }), {})),
  ...(page.seo?.issues ?? []).map(i => ({ ...i, screenIds: [], short: i.title })),
] });

const run = () => ({
  kind: "pages", host: "sbeoc.com", site: "https://sbeoc.com/", date: "2026-09-23", firstRun: "/runs/1",
  pages: [
    withIssues({ label: "Home", path: "/", url: "https://sbeoc.com/", home: true, audit: auditFor({ iphone: [issue("high", "broken-images", "Logo missing", [{ src: "x", alt: "Logo" }])] }), seo: { issues: [issue("low", "no-sitemap", "No sitemap")] } }),
    withIssues({ label: "/about", path: "/about", url: "https://sbeoc.com/about", audit: auditFor({ iphone: [issue("medium", "tap-targets", "Buttons too small to tap")] }), seo: { issues: [issue("medium", "no-description", "No Google description")] } }),
    withIssues({ label: "/projects", path: "/projects", url: "https://sbeoc.com/projects", audit: auditFor({ iphone: [issue("high", "sideways", "Page scrolls sideways")], ipad: [issue("medium", "tap-targets", "Buttons too small to tap")] }), seo: { issues: [issue("low", "no-lang", "Page language not set")] } }),
    { label: "/careers", path: "/careers", url: "https://sbeoc.com/careers", skipped: "it didn't load" },
    withIssues({ label: "/contact", path: "/contact", url: "https://sbeoc.com/contact", audit: auditFor({}), seo: { issues: [] } }),
  ],
});

test("mergeIssues: one line per problem across pages, worst severity, screens joined, pages listed", () => {
  const merged = mergeIssues(run().pages.filter(p => p.audit && !p.home));
  const taps = merged.find(i => i.key === "tap-targets");
  assert.deepEqual(taps.pages, ["/about", "/projects"]);
  assert.deepEqual(taps.screenIds, ["iphone", "ipad-portrait"]);
  assert.equal(merged[0].key, "sideways", "high before medium");
});

test("pagesMessage: one line with scores per page, skipped pages named, the PDF as the handoff", () => {
  const text = pagesMessage(run());
  assert.equal(text, "sbeoc.com, 3 more pages checked (/about 75–100, /projects 75–100, /contact 75–100): 3 things to fix. Couldn't check /careers: it didn't load. The PDF covers all 4 pages; send it to your coding agent as is. Text the URL again after you deploy.");
  assert.doesNotMatch(text, /https?:\/\/|\n/);
  assert.deepEqual(pagesIssueLines(run()), [
    "🔴 Page scrolls sideways on iPhone 15 (/projects)",
    "🟡 Buttons too small to tap on iPhone 15 and iPad portrait (/about, /projects)",
    "🟡 No Google description (/about)",
    "⚪ Page language not set (/projects)",
  ]);
});

test("a page that didn't load on a sub-page is called a page, not the homepage", async () => {
  const { shortTitle } = await import("../render/labels.mjs");
  assert.equal(shortTitle({ key: "unreachable", title: "The page answered 404 to a normal visit" }), "Page didn't load");
  assert.equal(shortTitle({ key: "unreachable", title: "The homepage answered 500 to a normal visit" }), "Homepage didn't load");
});

test("pageScore is one number or a range across the 9 screens", () => {
  assert.equal(pageScore(auditFor({})), "75–100");
  assert.equal(pageScore({ screens: [{ score: 90 }, { score: 90 }] }), "90");
});

test("pagesFixPrompt: one section per page, numbered, the clean page says so, no markdown", () => {
  const prompt = pagesFixPrompt(run());
  assert.match(prompt, /^FIX LIST FOR SBEOC\.COM, 4 PAGES/);
  assert.match(prompt, /PAGE 1 OF 4: HOME \(https:\/\/sbeoc\.com\/x\)\n\nFIX FIRST\n\n1\. Logo missing/);
  assert.match(prompt, /PAGE 2 OF 4: \/ABOUT \(https:\/\/sbeoc\.com\/x\)\n\nTHEN\n\n1\. Buttons too small/);
  assert.match(prompt, /PAGE 4 OF 4: \/CONTACT[^\n]*\n\nNothing to fix on this page\./);
  assert.doesNotMatch(prompt, /careers/i, "a skipped page has no section");
  assert.match(prompt, /Screens checked: Small Android/);
  assert.doesNotMatch(prompt, /\*\*|^#/m);
});

test("fixSections alone says when a page is clean", () => {
  assert.equal(fixSections({ audit: auditFor({}), seo: { issues: [] } }), "Nothing to fix on this page.\n\n");
});

test("the result text offers the other pages by name, or by count when the list is long", () => {
  const withIds = { url: "https://sbeoc.com", audit: auditFor({}), seo: { issues: [] } };
  assert.match(resultMessage({ ...withIds, pages: [{ path: "/about" }, { path: "/contact" }] }), /Reply pages to check \/about and \/contact too, or text the URL again after you deploy\.$/);
  assert.match(resultMessage(withIds), /fix list\. Text the URL again after you deploy\.$/);
  assert.equal(pagesOffer([{ path: "/about" }]), ", or pages to check /about too");
  assert.equal(pagesOffer(mainPages([link("https://sbeoc.com/"), link("https://sbeoc.com/about")], "https://sbeoc.com/pricing")), ", or pages to check Home and /about too");
  assert.equal(pagesOffer([{ path: "/a" }, { path: "/b" }, { path: "/c" }]), ", or pages to check /a, /b and /c too");
  assert.equal(pagesOffer([{ path: "/services/commercial-electrical-contracting" }, { path: "/services/residential-electrical-contracting" }]), ", or pages to check 2 more pages from your menu");
});

test("seoIssues: a page run keeps page findings, drops site-wide ones, and says 'The page'", () => {
  const facts = { robotsMeta: null, title: null, description: null, h1: [], images: 0, missingAlt: [], og: {}, canonical: null, renderedText: 12, structuredData: [], lang: null };
  const r = {
    page: facts, home: { ok: false, status: 500, url: "https://sbeoc.com/about" }, preview: {}, noJs: { share: 100 },
    crawlers: [{ name: "Google", robotsAllowed: false }, { name: "Claude", robotsAllowed: false, firewall: true, status: 403 }],
    sitemap: { found: false }, llmsTxt: { found: false },
  };
  const site = seoIssues({ ...r, scope: "site" }).map(i => i.key);
  const page = seoIssues({ ...r, scope: "page" }).map(i => i.key);
  for (const key of SITE_WIDE) { assert.ok(site.includes(key), `site run reports ${key}`); assert.ok(!page.includes(key), `page run skips ${key}`); }
  for (const key of ["unreachable", "no-title", "thin", "no-lang"]) assert.ok(page.includes(key), key);
  assert.match(seoIssues({ ...r, scope: "page" }).find(i => i.key === "thin").title, /^The page has only/);
  assert.match(seoIssues({ ...r, scope: "site" }).find(i => i.key === "thin").title, /^The homepage has only/);
});

test("the pages card has a row per page, names skipped pages, and shrinks long domain names", () => {
  const html = pagesCardHtml(run());
  assert.equal((html.match(/class="row[ "]/g) ?? []).length, 5);
  assert.match(html, /class="label">SITEMAXXING FIT CHECK · 4 PAGES</);
  assert.match(html, /Couldn't check it: it didn't load\./);
  assert.match(html, /<b class="path">\/projects<\/b>/);
  assert.match(html, /Page scrolls sideways/);
  assert.match(html, /text-overflow: ellipsis/);
  assert.equal(hostSize("sbeoc.com"), 64);
  assert.ok(hostSize("a-really-long-domain-name-for-a-business.example") < hostSize("sbeoc.com"));
  assert.match(pagesCardHtml({ ...run(), host: "<script>" }), /&lt;script&gt;/);
});

test("the pages report has an issues page and a screens page per checked page, then one fix list", () => {
  const dir = mkdtempSync(join(tmpdir(), "ro-pages-"));
  writeFileSync(join(dir, "FIX-PROMPT.md"), "FIX LIST <test>");
  const pr = run();
  for (const p of pr.pages) p.dir = dir;
  const html = pagesReportHtml(pr, dir);
  assert.equal((html.match(/what to fix<\/h2>/g) ?? []).length, 4);
  assert.equal((html.match(/the first screen on 9 screen sizes<\/h2>/g) ?? []).length, 4);
  assert.match(html, /<h2>\/careers<\/h2><p>Couldn't check it: it didn't load\./, "a skipped page has no number");
  assert.match(html, /4\. \/contact: what to fix<\/h2>/, "numbered like the fix list: PAGE 4 OF 4");
  assert.match(html, /Fix list for your coding agent, 4 pages<\/h2><pre>FIX LIST &lt;test&gt;/);
});
