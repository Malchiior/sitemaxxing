// Turn a run's raw results into (1) a short summary for the agent to explain
// and (2) the fix prompt for the owner's own coding agent. Pure functions over
// audit.json and seo.json: nothing here is written by a model, so a fix can
// only say what was measured.

import { diffName, DOT, groups, shortTitle } from "./labels.mjs";

const RANK = { high: 3, medium: 2, low: 1 };

/** One entry per problem, with every screen it appears on, worst first. */
export function groupScreenIssues(audit) {
  const byKey = new Map();
  for (const screen of audit.screens) {
    for (const issue of screen.issues) {
      const entry = byKey.get(issue.key) ?? { key: issue.key, severity: issue.severity, title: issue.title, screens: [], screenIds: [], evidence: issue.evidence, area: "screens" };
      entry.screens.push(`${screen.label} ${screen.width}×${screen.height}`);
      entry.screenIds.push(screen.id);
      if (RANK[issue.severity] > RANK[entry.severity]) Object.assign(entry, { severity: issue.severity, title: issue.title, evidence: issue.evidence });
      byKey.set(issue.key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.screens.length - a.screens.length);
}

/** A broken image URL with the site's address pasted into the middle of its path. */
export function repairedImageUrl(src, origin) {
  const match = /^(.+?)(https?:\/\/[^/]+\/)(.+)$/.exec(src ?? "");
  if (!match || /^https?:/.test(match[1])) return null;
  return new URL(`/${match[1].replace(/^\/+/, "")}${match[3]}`, match[2] || origin).href;
}

const list = items => (items ?? []).map(x => typeof x === "string" ? x : Object.entries(x).map(([k, v]) => `${k}: ${v}`).join(", "));

/** What to change, per problem, for a coding agent that can see the code. */
const FIX = {
  viewport: () => 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> of every page.',
  sideways: i => `These elements run past the right edge of the screen: ${list(i.evidence).join("; ")}. Make them fit: max-width: 100%, let flex rows wrap, let long words break (overflow-wrap: anywhere), and remove fixed widths wider than the screen.`,
  "headline-cut": i => `The headline "${i.evidence}" runs off the screen. Let it wrap and size it with clamp() so it fits at 360px wide.`,
  covered: i => `On arrival, ${list(i.evidence).join("; ")} covers much of the screen. On phones, make it smaller, dismissible, or shown after the visitor scrolls.`,
  "broken-images": i => `These images fail to load: ${list(i.evidence).join("; ")}. ${i.repairs?.length ? `Likely correct URLs (checked, they load): ${i.repairs.join("; ")}.` : "Fix the image URLs."}`,
  "headline-low": i => `The headline "${i.evidence}" isn't on the first screen on these sizes. Reduce the space above it (hero padding, header height) on those widths.`,
  "tiny-text": i => `Text smaller than 12px: ${list(i.evidence).join("; ")}. Set a floor of 12px, and 16px for body text on phones.`,
  "tap-targets": i => `Controls under the 24px minimum tap size (WCAG 2.2) and too close to others: ${list(i.evidence).join("; ")}. Give each at least 24×24px, ideally 44×44px, with padding.`,
  "cramped-targets": i => `Buttons or links under Apple's 44px tap size: ${list(i.evidence).join("; ")}. Add padding so each is at least 44px tall on touch screens.`,
  clipped: i => `Text cut off inside its box: ${list(i.evidence).join("; ")}. Remove the fixed height or width, or let the text wrap.`,
  heavy: i => `The page downloads ${i.evidence?.kb ? (i.evidence.kb / 1024).toFixed(1) + " MB" : "a lot"}. Heaviest files: ${list(i.evidence?.heaviest).join("; ")}. For video on phones, show a poster image and don't preload (preload="none", or load it only above a width). Compress images to WebP or AVIF.`,
  "action-low": i => `${i.title}. On phones, bring the main button into the first screen.`,
  "oversized-images": i => `Images much larger than needed: ${list(i.evidence).join("; ")}. Serve sized versions with srcset and sizes.`,
  unreachable: () => "The page didn't load for a normal visitor. Check the server, DNS and any redirects.",
  noindex: i => `The page tells search engines not to index it (robots meta "${i.evidence}"). Remove noindex unless this page should stay out of search.`,
  "google-blocked": () => "robots.txt blocks Googlebot from the site. Remove that Disallow rule unless it's intentional.",
  "no-title": () => "Add a <title>: what the business does and its name, under 60 characters, from the site's own wording.",
  "title-cut": i => `Google cuts the title off: "${i.evidence}". Shorten it to under 60 characters, keeping the most important words first.`,
  "no-description": () => 'Add <meta name="description"> of 140-155 characters, using the site\'s own wording about what it does, for whom and where.',
  "description-cut": i => `Google cuts the description off: "${i.evidence}". Shorten it to under 155 characters.`,
  "no-h1": () => "Add one <h1> that says what the business does (not just its name or \"Home\").",
  "many-h1": i => `There are several <h1> headlines: ${list(i.evidence).join(" | ")}. Keep one; make the others <h2>.`,
  "alt-text": i => `Images without alt text: ${list(i.evidence).join("; ")}. Describe each in a few words (what it shows).`,
  "no-share-image": () => 'Add <meta property="og:image"> with a 1200×630 image so shared links show a picture.',
  "no-canonical": () => 'Add <link rel="canonical"> with the page\'s own preferred URL.',
  "no-sitemap": () => "Add /sitemap.xml listing the site's pages, and a Sitemap: line in robots.txt.",
  firewall: i => `The server or firewall turns these crawlers away: ${list(i.evidence).join("; ")}. If the owner wants to appear in AI answers, allow them in the firewall's bot settings.`,
  thin: () => "The page has almost no readable text. Add a real headline that says what the business does, plus a few sentences on who it serves, where, and how to get in touch, using the owner's own information.",
  "js-only": i => `Most of the text only appears after JavaScript runs (${i.evidence?.share}% visible without it). Render the main content on the server or pre-render the page.`,
  "ai-blocked": i => `robots.txt blocks: ${list(i.evidence).join(", ")}. If the owner wants to appear in AI answers, allow them. (Leave as is if blocking them was a choice.)`,
  "no-schema": () => 'Add JSON-LD structured data (<script type="application/ld+json">): Organization or LocalBusiness with the name, URL, logo, address, phone and social links shown on the site.',
  "no-llms-txt": () => "Add /llms.txt: a short plain-text summary of the business and links to its key pages, for AI tools (format: llmstxt.org).",
  "no-lang": () => 'Add the page language to <html>, e.g. <html lang="en">.',
};

export const SCREENS_CHECKED = "Screens checked: Small Android 360×800, iPhone SE 375×667, iPhone 15 393×852, iPhone Pro Max 430×932, iPad 768×1024 and 1024×768, laptop 1366×768, desktop 1920×1080, ultrawide 2560×1080.";

/** One page's fixes in priority sections (FIX FIRST, THEN, WHEN THERE'S TIME), or a line saying there are none. */
export function fixSections(run) {
  const all = [...groupScreenIssues(run.audit), ...(run.seo?.issues ?? []).map(i => ({ ...i, screens: [] }))]
    .map(i => i.key === "broken-images" ? { ...i, repairs: run.repairs ?? [] } : i);
  const section = (severity, heading) => {
    const items = all.filter(i => i.severity === severity);
    if (!items.length) return "";
    // Plain text, no markdown syntax: it's read in iMessage before it's pasted,
    // and coding agents read it the same either way.
    return `${heading.toUpperCase()}\n\n` + items.map((i, k) => {
      const where = i.screens.length ? ` (${i.screens.length === 9 ? "all 9 screens" : i.screens.join(", ")})` : "";
      return `${k + 1}. ${i.title}${where}\nFix: ${(FIX[i.key] ?? (() => "See the evidence above."))(i)}`;
    }).join("\n\n") + "\n\n";
  };
  return `${section("high", "Fix first")}${section("medium", "Then")}${section("low", "When there's time")}` || "Nothing to fix on this page.\n\n";
}

export function fixPrompt(run) {
  const host = new URL(run.audit.finalUrl ?? run.url).hostname.replace(/^www\./, "");
  return `FIX LIST FOR ${host.toUpperCase()}

You're working on the website ${run.audit.finalUrl ?? run.url}. On ${run.date}, an automated check opened the page on 9 screen sizes (360 to 2560 wide) and checked its SEO and how well AI tools can read it. Every item below was measured, not guessed.

Fix them in this codebase. For each one, find the code responsible and make the smallest change that fixes it. Don't change the copy, routes, forms or tracking unless the fix says to. When you're done, check the page at 375px and 1440px wide.

${fixSections(run)}${SCREENS_CHECKED}
`.replace(/\n{3,}/g, "\n\n");
}

/** Every issue, screens then Google and AI, worst first, with short human titles. */
export function allIssues(run) {
  const screens = groupScreenIssues(run.audit);
  const seo = (run.seo?.issues ?? []).map(i => ({ ...i, screens: [], screenIds: [] }));
  return [...screens, ...seo]
    .map(i => ({ ...i, short: shortTitle(i) }))
    .sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

/** The results text, built here so it reads the same every time. */
export function resultMessage(run) {
  const host = new URL(run.audit.finalUrl ?? run.url).hostname.replace(/^www\./, "");
  const g = groups(run.audit.screens);
  const parts = [["phones", g.phones], ["tablets", g.tablets], ["computers", g.computers]].filter(([, r]) => r);
  const same = parts.every(([, r]) => r.text === parts[0][1].text);
  const scores = same ? `${parts[0][1].text} on every screen` : parts.map(([name, r]) => `${r.text} on ${name}`).join(", ");
  const every = allIssues(run);
  const big = every.filter(i => i.severity !== "low").length;
  const found = big ? `${big} thing${big === 1 ? "" : "s"} to fix, ${scores}` : every.length ? `nothing broken, ${scores}` : `nothing to fix, ${scores}`;
  return `${host} fit check attached: ${found}. Send the PDF to your coding agent as is; it has the fix list. ${pagesInvite(run.pages) ? `Reply ${pagesInvite(run.pages)}, or text` : "Text"} the URL again after you deploy.`;
}

/** The lines the text no longer carries, for the model to answer questions from. */
export function issueLines(run) {
  return allIssues(run).map(i => `${DOT[i.severity]} ${i.short}`);
}

/** "pages to check /about, /services and /contact too": the site's other main pages, found in this page's menu. */
export function pagesInvite(pages) {
  if (!pages?.length) return "";
  const paths = pages.map(p => p.label ?? p.path);
  const named = paths.length === 1 ? paths[0] : `${paths.slice(0, -1).join(", ")} and ${paths.at(-1)}`;
  return named.length <= 60 ? `pages to check ${named} too` : `pages to check ${paths.length} more pages from your menu`;
}

/** ", or pages to check … too", for the end of a "Reply fix …" sentence. */
export const pagesOffer = pages => pagesInvite(pages) ? `, or ${pagesInvite(pages)}` : "";

/** A compact summary for the agent to explain in a text message. */
export function agentSummary(run) {
  return {
    site: run.audit.finalUrl ?? run.url,
    scores: run.audit.screens.map(s => `${s.label} ${s.width}×${s.height}: ${s.score}`),
    screenIssues: groupScreenIssues(run.audit).map(i => ({ severity: i.severity, title: i.title, screens: i.screens.length === 9 ? "all 9" : i.screens })),
    seoAndAi: (run.seo?.issues ?? []).map(i => ({ severity: i.severity, area: i.area, title: i.title })),
    google: { title: run.seo?.page?.title, description: run.seo?.page?.description },
    aiCrawlers: (run.seo?.crawlers ?? []).map(c => `${c.name}: ${c.robotsAllowed ? "allowed" : "blocked by robots.txt"}${c.firewall ? `, turned away by the server (${c.status})` : ""}`),
    readableWithoutJavaScript: run.seo?.noJs ? `${run.seo.noJs.share}%` : null,
    repairsChecked: run.repairs ?? [],
  };
}

/** Every broken image in a run, one per src, from the measurements (an issue's evidence keeps only four). */
const brokenImages = run => {
  const seen = new Map();
  for (const s of run.audit.screens) for (const img of s.measurements?.images?.broken ?? []) if (img?.src && !seen.has(img.src)) seen.set(img.src, img);
  return [...seen.values()];
};

/**
 * What changed between two checks of the same page, problem by problem: fixed,
 * still there, new. Broken images are compared image by image, since they're
 * named one by one ("the Logo image"), and fixing one of two is progress.
 */
export function diffRuns(previous, current) {
  const before = allIssues(previous), after = allIssues(current);
  const was = new Set(before.map(i => i.key)), is = new Set(after.map(i => i.key));
  const seoKeys = run => (run.seo?.issues ?? []).map(i => i.key).sort().join(",");
  const d = {
    scores: { before: groups(previous.audit.screens), after: groups(current.audit.screens) },
    fixed: before.filter(i => !is.has(i.key)),
    still: after.filter(i => was.has(i.key)),
    added: after.filter(i => !was.has(i.key)),
    googleAndAiUnchanged: seoKeys(previous) === seoKeys(current),
  };
  const b = before.find(i => i.key === "broken-images"), a = after.find(i => i.key === "broken-images");
  if (b && a) {
    const bList = brokenImages(previous).length ? brokenImages(previous) : b.evidence ?? [];
    const aList = brokenImages(current).length ? brokenImages(current) : a.evidence ?? [];
    const bSrcs = new Set(bList.map(e => e.src)), aSrcs = new Set(aList.map(e => e.src));
    const part = (issue, list, keep) => {
      const evidence = list.filter(keep);
      return evidence.length ? [{ ...issue, evidence, short: shortTitle({ ...issue, evidence }) }] : [];
    };
    d.fixed = [...part(b, bList, e => !aSrcs.has(e.src)), ...d.fixed];
    d.still = d.still.flatMap(i => i.key === "broken-images" ? part(a, aList, e => bSrcs.has(e.src)) : [i]);
    d.added = [...part(a, aList, e => !bSrcs.has(e.src)), ...d.added];
  }
  return d;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const named = (items, max) => {
  const list = items.map(diffName);
  return list.length <= max ? list.join(", ") : `${list.slice(0, max).join(", ")} and ${list.length - max} more`;
};
/** "buttons too small to tap, plus 2 small things in the report": the real problems by name, the small ones by count. */
const listed = (items, max) => {
  const big = items.filter(i => i.severity !== "low"), small = items.length - big.length;
  const smallText = small ? `${small} small thing${small === 1 ? "" : "s"} in the report` : "";
  if (!big.length) return smallText || "nothing";
  return smallText ? `${named(big, max)}, plus ${smallText}` : named(big, max);
};
const shortDate = iso => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The re-check text (messages.md, "Re-check after a deploy"): scores then and now, fixed, still there, new. */
export function recheckMessage(run, previous) {
  const url = new URL(run.audit.finalUrl ?? run.url);
  const page = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`;
  const d = diffRuns(previous, run);
  const both = ["phones", "tablets", "computers"].filter(g => d.scores.before[g] && d.scores.after[g]).map(g => [g, d.scores.before[g], d.scores.after[g]]);
  const changed = both.filter(([, b, a]) => b.text !== a.text);
  const same = both.filter(([, b, a]) => b.text === a.text);
  let scores;
  if (changed.length) {
    scores = changed.map(([g, b, a], k) => `${k ? g : `${cap(g)} went`} from ${b.text} to ${a.text}`).join(", ") + ".";
    if (same.length) scores += ` ${cap(same.map(([g]) => g).join(" and "))} unchanged.`;
  } else {
    scores = `Scores unchanged: ${both.map(([g, , a]) => `${a.text} on ${g}`).join(", ")}.`;
  }
  const since = previous.audit.finishedAt ? ` (since ${shortDate(previous.audit.finishedAt)})` : "";
  const left = d.still.length + d.added.length;
  const invite = pagesInvite(run.pages);
  const tail = left ? `The PDF has what's left${invite ? `; reply ${invite}` : ""}.` : `Nothing left to fix on this page.${invite ? ` Reply ${invite}.` : ""}`;
  return `${page} again${since}: fixed ${d.fixed.length}, still there ${d.still.length}, new ${d.added.length}. ${scores} ${tail}`;
}

/** The re-check lines the text no longer carries, for the model to answer questions from. */
export function recheckLines(run, previous) {
  const d = diffRuns(previous, run);
  return [
    `Fixed: ${d.fixed.length ? named(d.fixed, 6) : d.still.length ? "nothing yet" : "nothing"}.`,
    `Still there: ${listed(d.still, 4)}.`,
    `New: ${listed(d.added, 4)}.`,
    ...(d.googleAndAiUnchanged ? ["Google and AI unchanged."] : []),
  ];
}
