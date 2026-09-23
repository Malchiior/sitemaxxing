// One full check of a page: nine screens, the grid, SEO and AI-readability,
// the report card, the PDF, the fix prompt, and the results text. When the
// page was checked before, the text says what changed since. The plugin runs
// this as a child process.
//
//   node check.mjs <url> <run-dir> [previous-run-dir]     prints the agent summary as JSON
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit } from "./audit.mjs";
import { renderGrid } from "./grid.mjs";
import { seo } from "./seo.mjs";
import { agentSummary, allIssues, diffRuns, fixPrompt, recheckMessage, resultMessage } from "./summarize.mjs";
import { imageRepairs } from "./repairs.mjs";
import { mainPages, pageKey } from "./pages.mjs";
import { renderCard } from "./card.mjs";
import { renderReport } from "./report.mjs";

const [, , url, runDir, previousDir] = process.argv;
const auditResult = await audit(url, runDir);
// A bot check or login wall isn't the site: stop rather than report on it.
const gate = auditResult.screens.find(s => s.id === "laptop")?.measurements.gate;
if (gate) {
  console.error(`blocked: ${gate}`);
  process.exit(3);
}
const grid = await renderGrid(runDir);
const seoResult = await seo(auditResult.finalUrl ?? url, runDir);
const repairs = await imageRepairs(auditResult, url);
// The site's other main pages, from this page's menu, for "check my pages".
const pages = mainPages(seoResult.page?.navLinks, auditResult.finalUrl ?? url);

const run = { url, date: new Date().toISOString().slice(0, 10), audit: auditResult, seo: seoResult, repairs, pages };
writeFileSync(join(runDir, "FIX-PROMPT.md"), fixPrompt(run));
const issues = allIssues(run);
const card = await renderCard(run, issues, runDir);
const report = await renderReport(run, issues, runDir);

// The earlier check of this page, if the plugin found one: the results text
// then says what got fixed, what's still there and what's new.
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), "utf8"));
let previous = null, changes, message;
if (previousDir) {
  try {
    const earlier = { audit: read(previousDir, "audit.json"), seo: read(previousDir, "seo.json") };
    // Only a check that landed on this same page compares; a redirect that
    // changed since would compare two different pages.
    if (pageKey(earlier.audit.finalUrl ?? earlier.audit.url) !== pageKey(auditResult.finalUrl ?? url)) throw new Error("the earlier check landed on a different page");
    const d = diffRuns(earlier, run);
    changes = { since: earlier.audit.finishedAt?.slice(0, 10) ?? null, fixed: d.fixed.map(i => i.short), stillThere: d.still.map(i => i.short), new: d.added.map(i => i.short) };
    message = recheckMessage(run, earlier);
    previous = previousDir;
  } catch (error) {
    console.error(`no comparison with the earlier check: ${error.message}`);
    previous = null;
  }
}

const summary = {
  kind: "page",
  // The results text, built in code: send it word for word.
  message: message ?? resultMessage(run),
  ...agentSummary(run),
  requested: url,
  date: run.date,
  pages,
  ...(previous ? { previous, changes } : {}),
  images: { card, grid, google: join(runDir, "google-preview.png") },
  report,
  fixPrompt: join(runDir, "FIX-PROMPT.md"),
};
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
