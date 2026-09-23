// "Check my pages": which links on a page are the site's main pages, and the
// combined results of checking them (one message, one fix list). Pure
// functions over the runs' own files, like summarize.mjs: nothing here is
// written by a model, so it can only say what was measured.
import { DOT, shortTitle, where } from "./labels.mjs";
import { allIssues, fixSections, SCREENS_CHECKED } from "./summarize.mjs";

const RANK = { high: 3, medium: 2, low: 1 };
export const MAX_PAGES = 4;

/** Links that aren't pages a visitor reads: files, and account or archive pages. */
const FILE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?|pptx?|csv|txt|xml|json|ics)$/i;
const UTILITY = /(^|\/)(login|log-in|signin|sign-in|signup|sign-up|register|account|my-account|cart|checkout|basket|logout|privacy|privacy-policy|terms|terms-of-service|terms-and-conditions|cookies?|cookie-policy|legal|wp-admin|wp-login\.php|feed|rss|sitemap|search|tag|tags|category|author|page|wp-content)(\/|$)/i;

/** "/about" for https://www.sbeoc.com/about/; "/" for the homepage. */
export function pagePath(url) {
  return new URL(url).pathname.replace(/\/+$/, "") || "/";
}

/** "sbeoc.com/about": one page, however it was spelled (www, trailing slash, hash). */
export function pageKey(url) {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, "").toLowerCase()}${pagePath(u)}`;
}

export const hostOf = url => new URL(url).hostname.replace(/^www\./, "");
export const labelOf = path => path === "/" ? "Home" : path;

/**
 * Up to four other pages on the same site, in menu order: the page's own
 * navigation links, same domain (www or not), each path once, skipping the
 * page itself, files, and account, legal and archive pages.
 */
export function mainPages(links, pageUrl, max = MAX_PAGES) {
  const page = new URL(pageUrl);
  const site = page.hostname.replace(/^www\./, "").toLowerCase();
  const seen = new Set([pagePath(page)]);
  const out = [];
  for (const link of links ?? []) {
    if (typeof link?.href !== "string" || !link.href) continue;
    let u;
    try { u = new URL(link.href, page); } catch { continue; }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    // url-guard's rules again: the normal web ports only (URL blanks :80 and :443), no credentials (origin drops them).
    if (u.port) continue;
    if (u.hostname.replace(/^www\./, "").toLowerCase() !== site) continue;
    const path = pagePath(u);
    if (seen.has(path) || FILE.test(path) || UTILITY.test(path)) continue;
    seen.add(path);
    out.push({ url: `${u.origin}${path}`, path, label: labelOf(path) });
    if (out.length >= max) break;
  }
  return out;
}

/** "71–100": a page's lowest and highest score across its 9 screens. */
export function pageScore(audit) {
  const scores = audit.screens.map(s => s.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

/** How bad one page's instance of a problem is, to pick the worst page's wording: more examples, or more megabytes. */
const extent = ev => Array.isArray(ev) ? ev.length : ev?.kb ?? 0;

/** One entry per problem across several pages: the worst page's severity and wording, every screen and every page it appears on. */
export function mergeIssues(pages) {
  const byKey = new Map();
  for (const page of pages) {
    for (const issue of page.issues ?? []) {
      const entry = byKey.get(issue.key) ?? { ...issue, screenIds: [], pages: [] };
      entry.screenIds = [...new Set([...entry.screenIds, ...(issue.screenIds ?? [])])];
      entry.pages.push(page.label);
      const worse = RANK[issue.severity] > RANK[entry.severity] || (RANK[issue.severity] === RANK[entry.severity] && extent(issue.evidence) > extent(entry.evidence));
      if (worse) Object.assign(entry, { severity: issue.severity, title: issue.title, evidence: issue.evidence });
      byKey.set(issue.key, entry);
    }
  }
  return [...byKey.values()]
    .map(i => ({ ...i, short: shortTitle(i) }))
    .sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.pages.length - a.pages.length);
}

/** The results text for a pages run: one line per fact. */
export function pagesMessage(pr) {
  const checked = pr.pages.filter(p => p.audit && !p.home);
  const skipped = pr.pages.filter(p => !p.audit);
  const total = pr.pages.filter(p => p.audit).length;
  const big = mergeIssues(checked).filter(i => i.severity !== "low").length;
  const dot = audit => { const lo = Math.min(...audit.screens.map(s => s.score)); return lo >= 90 ? "🟢" : lo >= 70 ? "🟡" : "🔴"; };
  return [
    `${pr.host} · ${checked.length} more page${checked.length === 1 ? "" : "s"}`,
    big ? `${big} thing${big === 1 ? "" : "s"} to fix` : "nothing broken",
    `Score: ${checked.map(p => `${p.label} ${pageScore(p.audit)} ${dot(p.audit)}`).join(" · ")}`,
    ...skipped.map(p => `Couldn't check ${p.label}: ${p.skipped}`),
    `The PDF covers all ${total} pages`,
  ].join("\n");
}

/** The per-issue lines the text no longer carries, for the model to answer questions from. */
export function pagesIssueLines(pr) {
  return mergeIssues(pr.pages.filter(p => p.audit && !p.home)).map(i => `${DOT[i.severity]} ${i.short} (${i.pages.join(", ")})`);
}

/** One fix list for every page checked, page by page, from the measurements. */
export function pagesFixPrompt(pr) {
  const done = pr.pages.filter(p => p.audit);
  const sections = done.map((p, k) =>
    `PAGE ${k + 1} OF ${done.length}: ${p.label.toUpperCase()} (${p.audit.finalUrl ?? p.url})\n\n${fixSections(p)}`).join("");
  return `FIX LIST FOR ${pr.host.toUpperCase()}, ${done.length} PAGES

You're working on the website ${pr.site}. On ${pr.date}, an automated check opened ${done.length} of its pages on 9 screen sizes (360 to 2560 wide) and checked each page's SEO and how well AI tools can read it. Every item below was measured, not guessed.

Fix them in this codebase. For each one, find the code responsible and make the smallest change that fixes it. A problem listed under several pages usually has one cause in a shared layout or component; fix it once. Don't change the copy, routes, forms or tracking unless the fix says to. When you're done, check each page at 375px and 1440px wide.

${sections}${SCREENS_CHECKED}
`.replace(/\n{3,}/g, "\n\n");
}
