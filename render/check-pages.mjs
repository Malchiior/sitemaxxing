// "Check my pages": up to four more pages of a site that was just checked, on
// the same nine screens, with one report card, one PDF and one fix list
// covering every page (the page checked first included). The plugin runs this
// as a child process.
//
//   node check-pages.mjs <first-run-dir> <run-dir>     prints the agent summary as JSON
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit } from "./audit.mjs";
import { seo } from "./seo.mjs";
import { allIssues } from "./summarize.mjs";
import { imageRepairs } from "./repairs.mjs";
import { hostOf, labelOf, MAX_PAGES, pageKey, pagePath, pageScore, pagesFixPrompt, pagesMessage } from "./pages.mjs";
import { renderPagesCard } from "./card.mjs";
import { renderPagesReport } from "./report.mjs";

const [, , firstDir, runDir] = process.argv;
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), "utf8"));
const firstSummary = read(firstDir, "summary.json");
const site = firstSummary.site;
const candidates = (firstSummary.pages ?? []).slice(0, MAX_PAGES);
if (!candidates.length) {
  console.error("no pages: the first check found no other pages in the menu");
  process.exit(4);
}

// Page 1 is the page checked first, from its own run: its findings include
// the site-wide Google and AI checks, which the other pages don't repeat.
const first = { label: labelOf(pagePath(site)), path: pagePath(site), url: site, home: true, dir: firstDir, audit: read(firstDir, "audit.json"), seo: read(firstDir, "seo.json"), repairs: firstSummary.repairsChecked ?? [] };
first.issues = allIssues(first);
const pages = [first];
const done = new Set([pageKey(site)]);
// A page that never fires its load event costs about five minutes without
// failing (25 s per screen), so stop starting pages well before the plugin's
// 12-minute limit; whatever was measured still gets its card and PDF.
const started = Date.now();
const BUDGET_MS = 6.5 * 60_000;
mkdirSync(runDir, { recursive: true });
for (const [k, candidate] of candidates.entries()) {
  const dir = join(runDir, "pages", String(k + 1));
  const page = { ...candidate, dir };
  if (Date.now() - started > BUDGET_MS) {
    page.skipped = "the earlier pages took too long";
    pages.push(page);
    continue;
  }
  try {
    const result = await audit(candidate.url, dir, { slices: false, png: false });
    const gate = result.screens.find(s => s.id === "laptop")?.measurements.gate;
    const landed = result.finalUrl ?? candidate.url;
    if (gate) page.skipped = gate === "login" ? "it asks for a login" : "it's behind a bot check";
    else if (hostOf(landed) !== hostOf(site)) page.skipped = `it goes to another site (${hostOf(landed)})`;
    else if (done.has(pageKey(landed))) page.skipped = "it's the same page as one already checked";
    else {
      // Only a page with every step done counts as checked: a half-measured
      // page would read as clean in the message, the card and the PDF.
      const seoResult = await seo(landed, dir, first.seo);
      const repairs = await imageRepairs(result, candidate.url);
      Object.assign(page, { audit: result, seo: seoResult, repairs });
      page.issues = allIssues(page);
      done.add(pageKey(landed));
    }
  } catch (error) {
    console.error(`${candidate.path}: ${error instanceof Error ? error.message : error}`);
    delete page.audit; delete page.seo; delete page.repairs; delete page.issues;
    page.skipped = "it didn't load";
  }
  pages.push(page);
}
if (!pages.some(p => p.audit && !p.home)) {
  console.error(`no page loaded: ${pages.filter(p => p.skipped).map(p => `${p.label} (${p.skipped})`).join(", ")}`);
  process.exit(5);
}

const pr = { kind: "pages", host: hostOf(site), site, date: new Date().toISOString().slice(0, 10), firstRun: firstDir, pages };
writeFileSync(join(runDir, "FIX-PROMPT.md"), pagesFixPrompt(pr));
const card = await renderPagesCard(pr, runDir);
const report = await renderPagesReport(pr, runDir);
const summary = {
  kind: "pages",
  // The results text, built in code: send it word for word.
  message: pagesMessage(pr),
  site, host: pr.host, date: pr.date, firstRun: firstDir,
  pages: candidates,
  checked: pages.map(p => ({
    page: p.label, url: p.audit?.finalUrl ?? p.url,
    ...(p.home ? { note: "checked first; its findings include the site-wide Google and AI checks" } : {}),
    ...(p.skipped ? { skipped: p.skipped } : { scores: pageScore(p.audit), issues: p.issues.map(i => `${i.severity}: ${i.short}`) }),
  })),
  images: { card },
  report,
  fixPrompt: join(runDir, "FIX-PROMPT.md"),
};
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
