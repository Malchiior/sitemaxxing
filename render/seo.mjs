// SEO and AI-readability (AEO) check for one site. Read-only: a rendered visit
// plus a few polite GETs (robots.txt, sitemap, llms.txt, the homepage as common
// crawlers). Every finding carries its evidence.
//
//   node seo.mjs <url> <out-dir>
//
// Writes seo.json, google-preview.png and page-text.txt (what a crawler that
// doesn't run JavaScript can read, for the agent's answerability check).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";

/** Crawlers people ask about, and the token each one matches in robots.txt. */
export const CRAWLERS = [
  { name: "Google", token: "Googlebot", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { name: "ChatGPT", token: "GPTBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" },
  { name: "ChatGPT search", token: "OAI-SearchBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)" },
  { name: "Claude", token: "ClaudeBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
  { name: "Perplexity", token: "PerplexityBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
  { name: "Gemini training", token: "Google-Extended", ua: null },
  { name: "Common Crawl", token: "CCBot", ua: null },
];
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
const pause = ms => new Promise(r => setTimeout(r, ms));

async function get(url, ua = BROWSER_UA) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    const body = await res.text();
    return { status: res.status, url: res.url, body };
  } catch (error) {
    return { status: 0, url, body: "", error: error.name === "TimeoutError" ? "timed out" : String(error.message ?? error) };
  }
}

/** Visible text from raw HTML, the way a crawler that doesn't run JavaScript sees it. */
export function htmlText(html) {
  return html.replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

/** Can `token` fetch "/"? Standard robots.txt matching: its own group, else "*"; longest rule wins; Allow wins ties. */
export function robotsAllows(robots, token) {
  const groups = [];
  let current = null;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (/^user-agent$/i.test(key)) {
      if (!current || current.rules.length) groups.push(current = { agents: [], rules: [] });
      current.agents.push(value.toLowerCase());
    } else if (current && /^(allow|disallow)$/i.test(key)) {
      current.rules.push({ allow: /^allow$/i.test(key), path: value });
    }
  }
  const own = groups.filter(g => g.agents.some(a => a !== "*" && token.toLowerCase().includes(a)));
  const applicable = own.length ? own : groups.filter(g => g.agents.includes("*"));
  const rules = applicable.flatMap(g => g.rules).filter(r => r.path === "/" || r.path === "/*" || (r.path === "" && !r.allow));
  const blocking = rules.filter(r => !r.allow && (r.path === "/" || r.path === "/*"));
  const allowing = rules.filter(r => r.allow);
  return { matched: own.length ? "its own rules" : applicable.length ? "the * rules" : "no rules", allowed: !(blocking.length && !allowing.length) };
}

const looksChallenged = body => /just a moment|cf-chl|captcha|access denied|attention required|are you a robot|verify you are human/i.test(body.slice(0, 20_000));

const PAGE_FACTS = `(() => {
  const meta = n => document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]')?.getAttribute("content") ?? null;
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(s => {
    try { const d = JSON.parse(s.textContent); const items = Array.isArray(d) ? d : d["@graph"] ?? [d];
      return items.map(i => [].concat(i["@type"] ?? []).join("/")).filter(Boolean); } catch { return ["(invalid JSON-LD)"]; }
  });
  const imgs = [...document.images].filter(i => i.getBoundingClientRect().width > 40);
  const host = location.hostname;
  const links = [...document.querySelectorAll("a[href]")].map(a => { try { return new URL(a.href); } catch { return null; } }).filter(Boolean);
  // The menu, in order: links in nav and header first; on a page without
  // either, every link. pages.mjs picks the site's main pages from these.
  const menu = [...document.querySelectorAll("nav a[href], header a[href], [role=navigation] a[href]")];
  // An <a> inside an inline SVG has an animated href object, so read the attribute (pages.mjs resolves it).
  const navLinks = (menu.length ? menu : [...document.querySelectorAll("a[href]")]).slice(0, 120)
    .map(a => ({ href: typeof a.href === "string" ? a.href : a.getAttribute("href"), text: (a.innerText || a.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 40) }));
  return {
    title: document.title || null,
    description: meta("description"),
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    robotsMeta: meta("robots"),
    lang: document.documentElement.getAttribute("lang"),
    h1: [...document.querySelectorAll("h1")].map(h => h.innerText.trim().replace(/\\s+/g, " ")).filter(Boolean),
    headings: [...document.querySelectorAll("h1, h2, h3")].slice(0, 20).map(h => h.tagName + " " + h.innerText.trim().replace(/\\s+/g, " ").slice(0, 70)),
    og: { title: meta("og:title"), description: meta("og:description"), image: meta("og:image") },
    twitterCard: meta("twitter:card"),
    structuredData: jsonLd,
    images: imgs.length, missingAlt: imgs.filter(i => !(i.getAttribute("alt") || "").trim()).map(i => (i.currentSrc || i.src).split("/").pop().slice(0, 60)),
    favicon: document.querySelector('link[rel~="icon"]')?.href ?? null,
    internalLinks: new Set(links.filter(u => u.hostname === host).map(u => u.pathname)).size,
    navLinks,
    renderedText: document.body ? document.body.innerText.replace(/\\s+/g, " ").trim().length : 0,
  };
})()`;

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Google-style result, drawn with Google's measurements so truncation matches. A simulation, and labeled as one. */
export function serpHtml({ host, url, title, description, siteName, favicon }) {
  const crumbs = esc(host) + esc(new URL(url).pathname.replace(/\/$/, "").split("/").filter(Boolean).map(p => " › " + p).join(""));
  const result = (cls) => `<div class="result ${cls}">
      <div class="site"><div class="fav">${favicon ? `<img src="${esc(favicon)}">` : ""}</div>
        <div><div class="name">${esc(siteName || host)}</div><div class="crumb">${crumbs}</div></div></div>
      <div class="title" data-check="title">${esc(title || host)}</div>
      <div class="desc" data-check="desc">${description ? esc(description) : `<i>No description set, so Google picks text from the page.</i>`}</div>
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; } body { width: 1200px; background: #f1f3f4; font-family: Arial, "Liberation Sans", sans-serif; padding: 28px; color: #202124; }
    .row { display: flex; gap: 28px; align-items: flex-start; } .label { font-size: 13px; color: #5f6368; margin: 0 0 8px 4px; text-transform: uppercase; letter-spacing: .06em; }
    .panel { background: #fff; border-radius: 12px; padding: 22px 24px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .desktop .panel { width: 700px; } .mobile .panel { width: 412px; }
    .site { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; } .fav { width: 28px; height: 28px; border-radius: 50%; background: #f1f3f4; display: grid; place-items: center; overflow: hidden; }
    .fav img { width: 18px; height: 18px; } .name { font-size: 14px; color: #202124; } .crumb { font-size: 12px; color: #4d5156; }
    .desktop .title { max-width: 600px; font-size: 20px; line-height: 26px; color: #1a0dab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .desktop .desc { max-width: 600px; font-size: 14px; line-height: 22px; color: #4d5156; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mobile .title { font-size: 20px; line-height: 26px; color: #1558d6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mobile .desc { font-size: 14px; line-height: 20px; color: #4d5156; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-top: 6px; }
    .note { margin-top: 18px; font-size: 13px; color: #5f6368; }
  </style></head><body>
    <div class="row">
      <div class="desktop"><div class="label">Google, desktop</div><div class="panel">${result("d")}</div></div>
      <div class="mobile"><div class="label">Google, phone</div><div class="panel">${result("m")}</div></div>
    </div>
    <p class="note">Simulated preview from this page's title and description, drawn at Google's sizes. Google can rewrite either.</p>
  </body></html>`;
}

/** Findings about the site as a whole, not one page: reported with the homepage, not again for every page. */
export const SITE_WIDE = new Set(["google-blocked", "no-sitemap", "firewall", "ai-blocked", "no-llms-txt"]);

export function seoIssues(r) {
  const out = [];
  const add = (severity, area, key, title, evidence) => out.push({ severity, area, key, title, evidence });
  const f = r.page;
  const what = r.scope === "page" ? "The page" : "The homepage";
  if (!r.home.ok) add("high", "seo", "unreachable", `${what} answered ${r.home.status || r.home.error} to a normal visit`, r.home.url);
  if (/noindex/i.test(f.robotsMeta ?? "")) add("high", "seo", "noindex", "The page tells search engines not to index it", f.robotsMeta);
  if (!r.crawlers.find(c => c.name === "Google").robotsAllowed) add("high", "seo", "google-blocked", "robots.txt blocks Google", null);
  if (!f.title) add("high", "seo", "no-title", "The page has no title", null);
  else if (r.preview.titleCut) add("low", "seo", "title-cut", `Google cuts the title off (${f.title.length} characters)`, f.title);
  if (!f.description) add("medium", "seo", "no-description", "No meta description, so Google picks its own snippet", null);
  else if (r.preview.descCut) add("low", "seo", "description-cut", `Google cuts the description off (${f.description.length} characters)`, f.description);
  if (!f.h1.length) add("medium", "seo", "no-h1", "No H1 headline on the page", null);
  else if (f.h1.length > 1) add("low", "seo", "many-h1", `${f.h1.length} H1 headlines; one is clearer`, f.h1);
  if (f.images && f.missingAlt.length / f.images > 0.2) add("medium", "seo", "alt-text", `${f.missingAlt.length} of ${f.images} images have no alt text`, f.missingAlt.slice(0, 5));
  if (!f.og.image) add("low", "seo", "no-share-image", "No share image, so links posted on social show no picture", null);
  if (!f.canonical) add("low", "seo", "no-canonical", "No canonical link", null);
  if (!r.sitemap.found) add("low", "seo", "no-sitemap", "No sitemap found", null);
  const blockedByRobots = r.crawlers.filter(c => c.name !== "Google" && !c.robotsAllowed).map(c => c.name);
  const firewalled = r.crawlers.filter(c => c.firewall).map(c => `${c.name} (${c.status})`);
  if (firewalled.length) add("high", "aeo", "firewall", `Your server or firewall turns away ${firewalled.join(", ")}`, firewalled);
  if (f.renderedText < 300) add("high", "aeo", "thin", `${what} has only ${f.renderedText} characters of text, so Google and AI tools have almost nothing to read`, f.h1);
  else if (r.noJs.share < 50) add("high", "aeo", "js-only", `AI crawlers that don't run JavaScript see only ${r.noJs.share}% of your text`, r.noJs);
  if (blockedByRobots.length) add("medium", "aeo", "ai-blocked", `robots.txt blocks ${blockedByRobots.join(", ")} (fine if that's on purpose)`, blockedByRobots);
  if (!f.structuredData.length) add("medium", "aeo", "no-schema", "No structured data, so AI and Google have to guess what your business is", null);
  if (!r.llmsTxt.found) add("low", "aeo", "no-llms-txt", "No llms.txt (a short guide to your site for AI tools)", null);
  if (!f.lang) add("low", "seo", "no-lang", "The page doesn't declare its language", null);
  const weight = { high: 3, medium: 2, low: 1 };
  const kept = r.scope === "page" ? out.filter(i => !SITE_WIDE.has(i.key)) : out;
  return kept.sort((a, b) => weight[b.severity] - weight[a.severity]);
}

/**
 * The SEO and AI-readability check of one page. `site`, when given, is the
 * homepage check's seo.json: its robots.txt, crawler, sitemap and llms.txt
 * results are reused (they're about the site, not the page) and only findings
 * about this page are reported.
 */
export async function seo(url, outDir, site = null) {
  mkdirSync(outDir, { recursive: true });
  const origin = new URL(url).origin;
  const r = { url, scope: site ? "page" : "site" };

  // A normal visit, then the same page as each crawler, a second apart.
  const home = await get(url);
  r.home = { ok: home.status >= 200 && home.status < 400, status: home.status, url: home.url, error: home.error };
  if (site) {
    Object.assign(r, { robots: site.robots, crawlers: site.crawlers, sitemap: site.sitemap, llmsTxt: site.llmsTxt, siteCheckedAt: site.url });
  } else {
    const robots = await get(`${origin}/robots.txt`);
    const robotsTxt = robots.status === 200 && !/<html/i.test(robots.body) ? robots.body : "";
    r.robots = { found: Boolean(robotsTxt), status: robots.status };
    r.crawlers = [];
    for (const c of CRAWLERS) {
      const rule = robotsAllows(robotsTxt, c.token);
      const entry = { name: c.name, token: c.token, robotsAllowed: rule.allowed, robotsRule: rule.matched };
      if (c.ua) {
        await pause(1000);
        const res = await get(url, c.ua);
        entry.status = res.status;
        entry.firewall = r.home.ok && (res.status === 403 || res.status === 429 || res.status === 503 || res.status === 0 || looksChallenged(res.body));
      }
      r.crawlers.push(entry);
    }
    const sitemapUrl = robotsTxt.match(/^\s*sitemap:\s*(\S+)/im)?.[1] ?? `${origin}/sitemap.xml`;
    await pause(500);
    const sitemap = await get(sitemapUrl);
    r.sitemap = { url: sitemapUrl, found: sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.body), entries: (sitemap.body.match(/<loc>/gi) ?? []).length };
    await pause(500);
    const llms = await get(`${origin}/llms.txt`);
    r.llmsTxt = { found: llms.status === 200 && !/<html/i.test(llms.body) && llms.body.trim().length > 0, bytes: llms.body.length };
  }

  // The rendered page: what a browser (and Google) sees.
  const browser = await launch();
  try {
    await browser.send("Page.enable");
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    let loaded = browser.waitFor("Page.loadEventFired", 25_000);
    await browser.send("Page.navigate", { url });
    await loaded;
    await browser.evaluate("document.fonts.ready.then(() => new Promise(r => setTimeout(r, 800)))");
    r.page = await browser.evaluate(PAGE_FACTS);

    const rawText = htmlText(home.body);
    r.noJs = { rawChars: rawText.length, renderedChars: r.page.renderedText, share: r.page.renderedText ? Math.min(100, Math.round(100 * rawText.length / r.page.renderedText)) : 100 };
    writeFileSync(join(outDir, "page-text.txt"), rawText);

    const host = new URL(home.url || url).hostname.replace(/^www\./, "");
    const previewFile = join(outDir, "google-preview.html");
    writeFileSync(previewFile, serpHtml({ host, url: home.url || url, title: r.page.title, description: r.page.description, siteName: r.page.og.title?.split(/[|–-]/)[0]?.trim(), favicon: r.page.favicon }));
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 400, deviceScaleFactor: 1, mobile: false });
    loaded = browser.waitFor("Page.loadEventFired", 15_000);
    await browser.send("Page.navigate", { url: pathToFileURL(previewFile).href });
    await loaded;
    r.preview = await browser.evaluate(`(() => {
      const cut = el => el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      return { titleCut: cut(document.querySelector(".d .title")), descCut: cut(document.querySelector(".d .desc")) };
    })()`);
    const height = await browser.evaluate("document.documentElement.scrollHeight");
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1200, height, deviceScaleFactor: 1, mobile: false });
    const shot = await browser.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(outDir, "google-preview.png"), Buffer.from(shot.data, "base64"));
  } finally {
    browser.close();
  }
  r.issues = seoIssues(r);
  writeFileSync(join(outDir, "seo.json"), JSON.stringify(r, null, 2));
  return r;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , url, outDir] = process.argv;
  const r = await seo(url, outDir);
  console.log(`title: ${r.page.title}\ndescription: ${r.page.description}\nno-JS text visible: ${r.noJs.share}% (${r.noJs.rawChars}/${r.noJs.renderedChars} chars)`);
  console.log("crawlers:", r.crawlers.map(c => `${c.name}: robots ${c.robotsAllowed ? "allows" : "BLOCKS"}${c.status !== undefined ? `, server ${c.status}${c.firewall ? " FIREWALLED" : ""}` : ""}`).join(" | "));
  console.log(`sitemap: ${r.sitemap.found ? r.sitemap.entries + " entries" : "none"} | llms.txt: ${r.llmsTxt.found ? "yes" : "no"} | structured data: ${r.page.structuredData.join(", ") || "none"}`);
  for (const i of r.issues) console.log(`[${i.severity}] [${i.area}] ${i.title}`);
}
