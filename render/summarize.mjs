// Turn a run's raw results into (1) a short summary for the agent to explain
// and (2) the fix prompt for the owner's own coding agent. Pure functions over
// audit.json and seo.json: nothing here is written by a model, so a fix can
// only say what was measured.

const RANK = { high: 3, medium: 2, low: 1 };

/** One entry per problem, with every screen it appears on, worst first. */
export function groupScreenIssues(audit) {
  const byKey = new Map();
  for (const screen of audit.screens) {
    for (const issue of screen.issues) {
      const entry = byKey.get(issue.key) ?? { key: issue.key, severity: issue.severity, title: issue.title, screens: [], evidence: issue.evidence, area: "screens" };
      entry.screens.push(`${screen.label} ${screen.width}×${screen.height}`);
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
  unreachable: () => "The homepage didn't load for a normal visitor. Check the server, DNS and any redirects.",
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
  thin: () => "The homepage has almost no readable text. Add a real headline that says what the business does, plus a few sentences on who it serves, where, and how to get in touch, using the owner's own information.",
  "js-only": i => `Most of the text only appears after JavaScript runs (${i.evidence?.share}% visible without it). Render the main content on the server or pre-render the page.`,
  "ai-blocked": i => `robots.txt blocks: ${list(i.evidence).join(", ")}. If the owner wants to appear in AI answers, allow them. (Leave as is if blocking them was a choice.)`,
  "no-schema": () => 'Add JSON-LD structured data (<script type="application/ld+json">): Organization or LocalBusiness with the name, URL, logo, address, phone and social links shown on the site.',
  "no-llms-txt": () => "Add /llms.txt: a short plain-text summary of the business and links to its key pages, for AI tools (format: llmstxt.org).",
  "no-lang": () => 'Add the page language to <html>, e.g. <html lang="en">.',
};

export function fixPrompt(run) {
  const host = new URL(run.audit.finalUrl ?? run.url).hostname.replace(/^www\./, "");
  const all = [...groupScreenIssues(run.audit), ...(run.seo?.issues ?? []).map(i => ({ ...i, screens: [] }))]
    .map(i => i.key === "broken-images" ? { ...i, repairs: run.repairs ?? [] } : i);
  const section = (severity, heading) => {
    const items = all.filter(i => i.severity === severity);
    if (!items.length) return "";
    return `## ${heading}\n\n` + items.map(i => {
      const where = i.screens.length ? ` (${i.screens.length === 9 ? "all 9 screens" : i.screens.join(", ")})` : "";
      return `- **${i.title}**${where}\n  Fix: ${(FIX[i.key] ?? (() => "See the evidence above."))(i)}`;
    }).join("\n") + "\n\n";
  };
  return `# Fix list for ${host}

You're working on the website ${run.audit.finalUrl ?? run.url}. On ${run.date}, an automated check opened its homepage on 9 screen sizes (360 to 2560 wide) and checked its SEO and how well AI tools can read it. Every item below was measured, not guessed.

Fix them in this codebase. For each one, find the code responsible and make the smallest change that fixes it. Don't change the copy, routes, forms or tracking unless the fix says to. When you're done, check the page at 375px and 1440px wide.

${section("high", "Fix first")}${section("medium", "Then")}${section("low", "When there's time")}Screens checked: Small Android 360×800, iPhone SE 375×667, iPhone 15 393×852, iPhone Pro Max 430×932, iPad 768×1024 and 1024×768, laptop 1366×768, desktop 1920×1080, ultrawide 2560×1080.
`.replace(/\n{3,}/g, "\n\n");
}

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
