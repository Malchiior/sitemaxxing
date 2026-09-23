// One full check of a page: nine screens, the grid, SEO and AI-readability,
// the report card, the PDF, the fix prompt, and the results text. The plugin
// runs this as a child process.
//
//   node check.mjs <url> <run-dir>     prints the agent summary as JSON
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit } from "./audit.mjs";
import { renderGrid } from "./grid.mjs";
import { seo } from "./seo.mjs";
import { agentSummary, allIssues, fixPrompt, resultMessage } from "./summarize.mjs";
import { imageRepairs } from "./repairs.mjs";
import { mainPages } from "./pages.mjs";
import { renderCard } from "./card.mjs";
import { renderReport } from "./report.mjs";

const [, , url, runDir] = process.argv;
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
const summary = {
  kind: "page",
  // The results text, built in code: send it word for word.
  message: resultMessage(run),
  ...agentSummary(run),
  requested: url,
  date: run.date,
  pages,
  images: { card, grid, google: join(runDir, "google-preview.png") },
  report,
  fixPrompt: join(runDir, "FIX-PROMPT.md"),
};
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
