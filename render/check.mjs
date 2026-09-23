// One full check of a site: nine screens, the grid, SEO and AI-readability,
// the fix prompt. The plugin runs this as a child process.
//
//   node check.mjs <url> <run-dir>     prints the agent summary as JSON
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit } from "./audit.mjs";
import { renderGrid } from "./grid.mjs";
import { seo } from "./seo.mjs";
import { agentSummary, fixPrompt, groupScreenIssues, repairedImageUrl } from "./summarize.mjs";

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

// For each broken image, offer a replacement only if it's proven to work:
// first a same-alt image that loads at another screen size, then the URL
// with a pasted-in domain removed, if that URL actually returns an image.
const origin = new URL(auditResult.finalUrl ?? url).origin;
const loadsAsImage = async candidate => {
  try {
    const res = await fetch(candidate, { method: "GET", signal: AbortSignal.timeout(10_000) });
    return res.ok && /^image\//.test(res.headers.get("content-type") ?? "");
  } catch { return false; }
};
const working = auditResult.screens.flatMap(s => s.measurements.images.working.map(w => ({ ...w, screen: s.label })));
const repairs = [];
const seen = new Set();
for (const issue of groupScreenIssues(auditResult).filter(i => i.key === "broken-images")) {
  for (const { src, alt } of issue.evidence ?? []) {
    if (seen.has(src)) continue;
    seen.add(src);
    const twin = alt && working.find(w => w.alt.toLowerCase() === alt.toLowerCase());
    if (twin) { repairs.push(`${src} -> ${twin.src} (the working image with the same alt text, "${alt}")`); continue; }
    const candidate = repairedImageUrl(src, origin);
    if (candidate && new URL(candidate).origin === origin && await loadsAsImage(candidate)) repairs.push(`${src} -> ${candidate}`);
  }
}

const run = { url, date: new Date().toISOString().slice(0, 10), audit: auditResult, seo: seoResult, repairs };
writeFileSync(join(runDir, "FIX-PROMPT.md"), fixPrompt(run));
const summary = { ...agentSummary(run), images: { grid, google: join(runDir, "google-preview.png") }, fixPrompt: join(runDir, "FIX-PROMPT.md") };
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
