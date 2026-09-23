// The report card: one portrait image (1080×1350) that reads on a phone and
// shares well. The site on a laptop, a tablet and a phone, three scores, the top
// issues, how Google shows it, and whether AI can read it. Every word and
// number comes from the run.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./cdp.mjs";
import { groups } from "./labels.mjs";

const ICON = process.env.RO_ICON ?? "/opt/ro/assets/icon.png";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tone = score => score >= 90 ? "#4ade80" : score >= 70 ? "#fbbf24" : "#f87171";
const src = file => pathToFileURL(file).href;

export function cardHtml(run, issues) {
  const host = new URL(run.audit.finalUrl ?? run.url).hostname.replace(/^www\./, "");
  const shot = id => run.audit.screens.find(s => s.id === id);
  const g = groups(run.audit.screens);
  const score = (label, range) => range ? `<div class="score"><b style="color:${tone(range.lo)}">${range.text}</b><span>${label}</span></div>` : "";
  const top = issues.filter(i => i.severity !== "low").slice(0, 4);
  const list = (top.length ? top : issues.slice(0, 2)).map(i =>
    `<li><i class="dot ${i.severity}"></i>${esc(i.short)}</li>`).join("") || `<li><i class="dot ok"></i>Nothing broken on any screen</li>`;
  const page = run.seo?.page ?? {};
  const crawler = name => run.seo?.crawlers?.find(c => c.name === name);
  const aiOk = ["ChatGPT", "Claude", "Perplexity"].map(name => {
    const c = crawler(name);
    const ok = c && c.robotsAllowed && !c.firewall;
    return `<span class="${ok ? "yes" : "no"}">${ok ? "✓" : "✗"} ${name}</span>`;
  }).join("");
  const readable = run.seo?.noJs ? `${run.seo.noJs.share}% readable without JavaScript` : "";
  const schema = page.structuredData?.length ? "structured data ✓" : "no structured data";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: 1080px; height: 1350px; overflow: hidden; background: #131b33; color: #f5efe3;
      font-family: "Liberation Sans", Arial, sans-serif; padding: 52px 56px; display: flex; flex-direction: column; }
    header { display: flex; align-items: center; gap: 22px; }
    header img { width: 92px; height: 92px; border-radius: 22px; }
    .label { font-size: 26px; letter-spacing: .14em; color: #f07a63; font-weight: 700; }
    h1 { font-size: 64px; line-height: 1.05; font-weight: 800; word-break: break-all; }
    .scores { display: flex; gap: 18px; margin-top: 34px; }
    .score { flex: 1; background: #1c2645; border-radius: 22px; padding: 18px 20px; text-align: center; }
    .score b { display: block; font-size: 64px; line-height: 1; font-weight: 800; }
    .score span { display: block; margin-top: 8px; font-size: 28px; color: #c9c3b8; }
    .devices { position: relative; height: 430px; margin-top: 34px; }
    .frame { position: absolute; background: #0b1020; border: 3px solid #3a4468; overflow: hidden; }
    .frame img { display: block; width: 100%; }
    .laptop { left: 150px; top: 0; width: 668px; height: 376px; border-radius: 14px; }
    .tablet { left: 0; bottom: 0; width: 230px; height: 306px; border-radius: 18px; }
    .phone { right: 0; bottom: 0; width: 150px; height: 325px; border-radius: 24px; }
    ul { list-style: none; margin: 30px 0 26px; display: grid; gap: 12px; }
    li { font-size: 32px; line-height: 1.25; display: flex; align-items: baseline; gap: 18px; }
    .dot { flex: none; width: 22px; height: 22px; border-radius: 50%; transform: translateY(-1px); }
    .dot.high { background: #f87171; } .dot.medium { background: #fbbf24; } .dot.low { background: #94a3b8; } .dot.ok { background: #4ade80; }
    .google { margin-top: auto; background: #fff; color: #202124; border-radius: 22px; padding: 20px 26px; }
    .google .site { font-size: 22px; color: #4d5156; } .google .t { font-size: 30px; color: #1558d6; margin-top: 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .google .d { font-size: 22px; color: #4d5156; margin-top: 4px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ai { margin-top: 16px; font-size: 24px; color: #c9c3b8; display: flex; flex-wrap: wrap; gap: 8px 22px; }
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
  </body></html>`;
}

/** Writes card.png (for texting) and card.jpg (for the PDF). */
export async function renderCard(run, issues, dir) {
  const html = join(dir, "card.html");
  writeFileSync(html, cardHtml(run, issues));
  const browser = await launch();
  try {
    await browser.send("Page.enable");
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false });
    const loaded = browser.waitFor("Page.loadEventFired", 15_000);
    await browser.send("Page.navigate", { url: pathToFileURL(html).href });
    await loaded;
    await browser.evaluate("document.fonts.ready");
    const png = await browser.send("Page.captureScreenshot", { format: "png" });
    const jpg = await browser.send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
    writeFileSync(join(dir, "card.png"), Buffer.from(png.data, "base64"));
    writeFileSync(join(dir, "card.jpg"), Buffer.from(jpg.data, "base64"));
    return join(dir, "card.png");
  } finally {
    browser.close();
  }
}
