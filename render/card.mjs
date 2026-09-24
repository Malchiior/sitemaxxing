import { themeCard, reportIcon } from "./theme.mjs";
// The report card: one portrait image (1080×1350) that reads on a phone and
// shares well. For one page: the site on a laptop, a tablet and a phone, three
// scores, the top issues, how Google shows it, and whether AI can read it. For
// a pages run: one row per page with its screens, scores and top issues.
// Every word and number comes from the run.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./cdp.mjs";
import { groups } from "./labels.mjs";

const ICON = process.env.RO_ICON ?? reportIcon;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tone = score => score >= 90 ? "#4ade80" : score >= 70 ? "#fbbf24" : "#f87171";
const src = file => pathToFileURL(file).href;

/** A domain name that fits on one or two lines: smaller the longer it is. */
export const hostSize = host => host.length <= 16 ? 64 : host.length <= 24 ? 50 : host.length <= 34 ? 40 : 32;

const BASE_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: 1080px; height: 1350px; overflow: hidden; background: #131b33; color: #f5efe3;
      font-family: "Liberation Sans", Arial, sans-serif; padding: 52px 56px; display: flex; flex-direction: column; }
    header { display: flex; align-items: center; gap: 22px; flex: none; }
    header img { width: 92px; height: 92px; border-radius: 22px; flex: none; }
    header > div { min-width: 0; }
    .label { font-size: 26px; letter-spacing: .14em; color: #f07a63; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    h1 { line-height: 1.05; font-weight: 800; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .dot { flex: none; width: 22px; height: 22px; border-radius: 50%; }
    .dot.high { background: #f87171; } .dot.medium { background: #fbbf24; } .dot.low { background: #94a3b8; } .dot.ok { background: #4ade80; }
`;

export function cardHtml(run, issues) {
  const host = new URL(run.audit.finalUrl ?? run.url).hostname.replace(/^www\./, "");
  const shot = id => run.audit.screens.find(s => s.id === id);
  const g = groups(run.audit.screens);
  const score = (label, range) => range ? `<div class="score"><b style="color:${tone(range.lo)}">${range.text}</b><span>${label}</span></div>` : "";
  const top = issues.filter(i => i.severity !== "low").slice(0, 4);
  const list = (top.length ? top : issues.slice(0, 2)).map(i =>
    `<li><i class="dot ${i.severity}"></i><span>${esc(i.short)}</span></li>`).join("") || `<li><i class="dot ok"></i><span>Nothing broken on any screen</span></li>`;
  const page = run.seo?.page ?? {};
  const crawler = name => run.seo?.crawlers?.find(c => c.name === name);
  const aiOk = ["ChatGPT", "Claude", "Perplexity"].map(name => {
    const c = crawler(name);
    const ok = c && c.robotsAllowed && !c.firewall;
    return `<span class="${ok ? "yes" : "no"}">${ok ? "✓" : "✗"} ${name}</span>`;
  }).join("");
  const readable = run.seo?.noJs ? `${run.seo.noJs.share}% readable without JavaScript` : "";
  const schema = page.structuredData?.length ? "structured data ✓" : "no structured data";
  return themeCard(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    h1 { font-size: ${hostSize(host)}px; }
    .scores { display: flex; gap: 18px; margin-top: 30px; flex: none; }
    .score { flex: 1; background: #1c2645; border-radius: 22px; padding: 18px 20px; text-align: center; }
    .score b { display: block; font-size: 64px; line-height: 1; font-weight: 800; }
    .score span { display: block; margin-top: 8px; font-size: 28px; color: #c9c3b8; }
    .devices { position: relative; height: 400px; margin-top: 30px; flex: none; }
    .frame { position: absolute; background: #0b1020; border: 3px solid #3a4468; overflow: hidden; }
    .frame img { display: block; width: 100%; }
    .laptop { left: 150px; top: 0; width: 668px; height: 376px; border-radius: 14px; }
    .tablet { left: 0; bottom: 0; width: 230px; height: 306px; border-radius: 18px; }
    .phone { right: 0; bottom: 0; width: 150px; height: 325px; border-radius: 24px; }
    ul { list-style: none; margin: 26px 0 22px; display: grid; gap: 10px; align-content: start; flex: 1 1 auto; min-height: 0; overflow: hidden; }
    li { font-size: 30px; line-height: 1.25; display: flex; align-items: flex-start; gap: 18px; min-width: 0; }
    li .dot { margin-top: 8px; }
    li span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
    .google { flex: none; background: #fff; color: #202124; border-radius: 22px; padding: 20px 26px; }
    .google .site { font-size: 22px; color: #4d5156; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .google .t { font-size: 30px; color: #1558d6; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .google .d { font-size: 22px; color: #4d5156; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ai { flex: none; margin-top: 16px; font-size: 24px; color: #c9c3b8; display: flex; flex-wrap: wrap; gap: 8px 22px; max-height: 76px; overflow: hidden; }
    .ai .yes { color: #4ade80; } .ai .no { color: #f87171; }
  </style></head><body>
    <header><img src="${src(ICON)}"><div><div class="label">SITEMAXXING FIT CHECK</div><h1>${esc(host)}</h1></div></header>
    <div class="scores">${score("phones", g.phones)}${score("tablets", g.tablets)}${score("computers", g.computers)}</div>
    <div class="devices">
      <div class="frame laptop"><img src="${src(shot("laptop").foldJpeg)}"></div>
      <div class="frame tablet"><img src="${src(shot("ipad-portrait").foldJpeg)}"></div>
      <div class="frame phone"><img src="${src(shot("iphone").foldJpeg)}"></div>
    </div>
    <ul>${list}</ul>
    <div class="google"><div class="site">Google · ${esc(host)}</div>
      <div class="t">${esc(page.title || host)}</div>
      <div class="d">${page.description ? esc(page.description) : "<i>No description set, so Google picks text from the page.</i>"}</div></div>
    <div class="ai">${aiOk}<span>${esc(readable)}</span><span>${esc(schema)}</span></div>
  </body></html>`);
}

/** The pages card: one row per page (the page checked first, then the others), each with its screens, scores and top two issues. */
export function pagesCardHtml(pr) {
  const rows = pr.pages.map(p => {
    if (!p.audit) return `<div class="row skipped"><div class="info"><div class="top"><b class="path">${esc(p.label)}</b></div><div class="why">Couldn't check it: ${esc(p.skipped)}.</div></div></div>`;
    const shot = id => p.audit.screens.find(s => s.id === id);
    const g = groups(p.audit.screens);
    const score = (label, range) => range ? `<span><i style="color:${tone(range.lo)}">${range.text}</i> ${label}</span>` : "";
    const top = (p.issues ?? []).filter(i => i.severity !== "low").slice(0, 2);
    const list = (top.length ? top : (p.issues ?? []).slice(0, 1)).map(i => `<li><i class="dot ${i.severity}"></i><span>${esc(i.short)}</span></li>`).join("")
      || `<li><i class="dot ok"></i><span>Nothing broken on any screen</span></li>`;
    return `<div class="row">
      <div class="shots"><div class="lap"><img src="${src(shot("laptop").foldJpeg)}"></div><div class="ph"><img src="${src(shot("iphone").foldJpeg)}"></div></div>
      <div class="info">
        <div class="top"><b class="path">${esc(p.label)}</b><span class="scores">${score("phones", g.phones)}${score("tablets", g.tablets)}${score("computers", g.computers)}</span></div>
        <ul>${list}</ul>
      </div></div>`;
  }).join("");
  const n = pr.pages.filter(p => p.audit).length;
  return themeCard(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    h1 { font-size: ${hostSize(pr.host)}px; }
    .rows { display: flex; flex-direction: column; gap: 12px; margin-top: 28px; flex: 1 1 auto; min-height: 0; overflow: hidden; }
    .row { display: flex; gap: 20px; background: #1c2645; border-radius: 20px; padding: 14px 18px; height: 212px; flex: none; overflow: hidden; }
    .row.skipped { height: auto; }
    .shots { display: flex; gap: 10px; flex: none; }
    .lap, .ph { background: #0b1020; border: 2px solid #3a4468; overflow: hidden; height: 172px; }
    .lap { width: 306px; border-radius: 10px; } .ph { width: 79px; border-radius: 14px; }
    .lap img, .ph img { display: block; width: 100%; }
    .info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
    .top { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .path { font-size: 30px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .scores { font-size: 23px; color: #c9c3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; gap: 18px; }
    .scores i { font-style: normal; font-weight: 800; }
    .why { font-size: 24px; color: #c9c3b8; margin-top: 6px; }
    ul { list-style: none; margin-top: 8px; display: grid; gap: 4px; align-content: start; min-height: 0; overflow: hidden; }
    li { font-size: 22px; line-height: 1.2; display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
    li .dot { width: 18px; height: 18px; margin-top: 4px; }
    li span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  </style></head><body>
    <header><img src="${src(ICON)}"><div><div class="label">SITEMAXXING FIT CHECK · ${n} PAGES</div><h1>${esc(pr.host)}</h1></div></header>
    <div class="rows">${rows}</div>
  </body></html>`);
}

async function shoot(html, dir) {
  const file = join(dir, "card.html");
  writeFileSync(file, html);
  const browser = await launch();
  try {
    await browser.send("Page.enable");
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false });
    const loaded = browser.waitFor("Page.loadEventFired", 15_000);
    await browser.send("Page.navigate", { url: pathToFileURL(file).href });
    await loaded;
    await browser.evaluate("Promise.all([document.fonts.ready, ...Array.from(document.images, image => image.decode().catch(() => {}))])");

    const png = await browser.send("Page.captureScreenshot", { format: "png" });
    const jpg = await browser.send("Page.captureScreenshot", { format: "jpeg", quality: 80 });
    writeFileSync(join(dir, "card.png"), Buffer.from(png.data, "base64"));
    writeFileSync(join(dir, "card.jpg"), Buffer.from(jpg.data, "base64"));
    return join(dir, "card.png");
  } finally {
    browser.close();
  }
}

/** Writes card.png (for texting) and card.jpg (for the PDF). */
export const renderCard = (run, issues, dir) => shoot(cardHtml(run, issues), dir);
export const renderPagesCard = (pr, dir) => shoot(pagesCardHtml(pr), dir);
