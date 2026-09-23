// The full report as a PDF: tap it on a phone and it opens full screen with
// pinch-zoom; forward it to a coding agent and it can read every page. Built
// from the run's own files; Chromium prints it. For a pages run, every page
// gets its issue list and its 9 screens, then one fix list covers them all.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./cdp.mjs";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const src = file => pathToFileURL(file).href;
const tone = score => score >= 90 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";
const AREA = { screens: "On screen", seo: "Google", aeo: "AI readability" };

// Text pages (issues, fix list) flow onto a second sheet when they're long;
// picture pages are one sheet each.
const CSS = `
    @page { size: 8.5in 11in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Liberation Sans", Arial, sans-serif; color: #111827; }
    .page { width: 8.5in; height: 11in; padding: 0.45in; page-break-after: always; overflow: hidden; position: relative; }
    .page.flow { height: auto; min-height: 11in; overflow: visible; }
    .page:last-child { page-break-after: auto; }
    h2 { font-size: 22px; margin-bottom: 14px; overflow-wrap: anywhere; } h3 { font-size: 15px; margin: 16px 0 8px; color: #374151; text-transform: uppercase; letter-spacing: .06em; }
    .muted { color: #6b7280; font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
    .cover { padding: 0; background: #131b33; display: flex; align-items: center; justify-content: center; }
    .cover img { width: 100%; }
    .issue { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; page-break-inside: avoid; }
    .dot { flex: none; width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; }
    .dot.high { background: #dc2626; } .dot.medium { background: #d97706; } .dot.low { background: #9ca3af; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    figure { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
    figcaption { font-size: 11px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
    .pill { margin-left: auto; color: #fff; border-radius: 99px; padding: 1px 8px; font-weight: 700; }
    .shot { height: 250px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; }
    .shot img { max-width: 100%; max-height: 250px; }
    .google img { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; } td { padding: 6px 4px; border-bottom: 1px solid #e5e7eb; }
    .ok { color: #16a34a; } .bad { color: #dc2626; }
    .facts { font-size: 13px; line-height: 1.7; margin-top: 12px; overflow-wrap: anywhere; }
    .pair { display: flex; gap: 20px; justify-content: center; } .pair img { width: 3.55in; border: 1px solid #e5e7eb; }
    .full img { width: 100%; border: 1px solid #e5e7eb; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: "Liberation Mono", monospace; font-size: 10.5px; line-height: 1.45; }
    .foot { position: absolute; bottom: 0.25in; left: 0.45in; right: 0.45in; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; gap: 12px; }
    .foot span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

const detail = i => i.screens?.length ? `${i.title} · ${i.screens.length === 9 ? "all 9 screens" : i.screens.join(", ")}` : i.title;

/** The issue list grouped by area, or a line saying there's nothing. */
function issueRows(issues) {
  return ["screens", "seo", "aeo"].map(area => {
    const rows = issues.filter(i => (i.area ?? "screens") === area);
    if (!rows.length) return "";
    return `<h3>${AREA[area]}</h3>` + rows.map(i =>
      `<div class="issue"><i class="dot ${i.severity}"></i><div><b>${esc(i.short)}</b><div class="muted">${esc(detail(i))}</div></div></div>`).join("");
  }).join("") || `<p>Nothing to fix on any screen.</p>`;
}

/** Nine first screens with their scores, from the small thumbnails when the run has them. */
const tiles = screens => screens.map((s, i) => `<figure><figcaption><b>${i + 1}. ${esc(s.label)}</b> ${s.width}×${s.height}
      <span class="pill" style="background:${tone(s.score)}">${s.score}</span></figcaption>
      <div class="shot"><img src="${src(s.thumbJpeg ?? s.foldJpeg)}"></div></figure>`).join("");

export function reportHtml(run, issues, dir) {
  const host = new URL(run.audit.finalUrl ?? run.url).hostname.replace(/^www\./, "");
  const shot = id => run.audit.screens.find(s => s.id === id);
  const crawlers = (run.seo?.crawlers ?? []).map(c => `<tr><td>${esc(c.name)}</td>
      <td class="${c.robotsAllowed ? "ok" : "bad"}">${c.robotsAllowed ? "allowed" : "blocked"}</td>
      <td class="${c.firewall ? "bad" : "ok"}">${c.status === undefined ? "not tested" : c.firewall ? `turned away (${c.status})` : `served (${c.status})`}</td></tr>`).join("");
  const page = run.seo?.page ?? {};
  const phone = shot("iphone")?.slices ?? [];
  const laptop = shot("laptop")?.slices ?? [];
  const phonePages = [];
  for (let k = 0; k < phone.length; k += 2) phonePages.push(phone.slice(k, k + 2));
  const fix = readFileSync(join(dir, "FIX-PROMPT.md"), "utf8");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="page cover"><img src="${src(join(dir, "card.jpg"))}"></div>
    <div class="page flow"><h2>What to fix on ${esc(host)}</h2>${issueRows(issues)}<div class="foot"><span>Sitemaxxing fit check · ${esc(run.date)}</span><span>${esc(run.audit.finalUrl ?? run.url)}</span></div></div>
    <div class="page"><h2>The first screen on 9 screen sizes</h2><div class="grid">${tiles(run.audit.screens)}</div></div>
    <div class="page"><h2>How Google and AI see ${esc(host)}</h2>
      <div class="google"><img src="${src(join(dir, "google-preview.png"))}"></div>
      <h3>AI crawlers</h3><table><tr><td><b>Crawler</b></td><td><b>robots.txt</b></td><td><b>Your server</b></td></tr>${crawlers}</table>
      <div class="facts">
        Text readable without JavaScript: <b>${run.seo?.noJs?.share ?? "?"}%</b><br>
        Structured data: <b>${page.structuredData?.length ? esc(page.structuredData.join(", ")) : "none"}</b><br>
        Sitemap: <b>${run.seo?.sitemap?.found ? `${run.seo.sitemap.entries} pages` : "none found"}</b> · llms.txt: <b>${run.seo?.llmsTxt?.found ? "yes" : "no"}</b><br>
        Title: <b>${esc(page.title ?? "none")}</b><br>
        Description: <b>${esc(page.description ?? "none")}</b>
      </div></div>
    ${phonePages.map((pair, k) => `<div class="page"><h2>The whole page on an iPhone 15${phonePages.length > 1 ? ` (${k + 1} of ${phonePages.length})` : ""}</h2>
      <div class="pair">${pair.map(f => `<img src="${src(f)}">`).join("")}</div></div>`).join("")}
    ${laptop.map((f, k) => `<div class="page"><h2>The whole page on a laptop${laptop.length > 1 ? ` (${k + 1} of ${laptop.length})` : ""}</h2>
      <div class="full"><img src="${src(f)}"></div></div>`).join("")}
    <div class="page flow"><h2>Fix list for your coding agent</h2><pre>${esc(fix)}</pre></div>
  </body></html>`;
}

/** A pages run: the card, then for each page its issues and Google facts and its 9 screens, then the fix list for every page. */
export function pagesReportHtml(pr, dir) {
  const fix = readFileSync(join(dir, "FIX-PROMPT.md"), "utf8");
  const checked = pr.pages.filter(p => p.audit);
  const pages = pr.pages.map(p => {
    // Numbered like the fix list: checked pages only.
    if (!p.audit) return `<div class="page flow"><h2>${esc(p.label)}</h2><p>Couldn't check it: ${esc(p.skipped)}.</p><div class="muted">${esc(p.url)}</div></div>`;
    const title = `${checked.indexOf(p) + 1}. ${p.label}`;
    const page = p.seo?.page ?? {};
    const preview = p.seo ? `<div class="google" style="margin-top:16px"><img src="${src(join(p.dir, "google-preview.png"))}"></div>` : "";
    return `<div class="page flow"><h2>${esc(title)}: what to fix</h2><div class="muted">${esc(p.audit.finalUrl ?? p.url)}${p.home ? " · checked first, with the site-wide Google and AI checks" : ""}</div>
      ${issueRows(p.issues ?? [])}${preview}
      <div class="facts">Title: <b>${esc(page.title ?? "none")}</b><br>Description: <b>${esc(page.description ?? "none")}</b><br>
        Text readable without JavaScript: <b>${p.seo?.noJs?.share ?? "?"}%</b></div></div>
    <div class="page"><h2>${esc(title)}: the first screen on 9 screen sizes</h2><div class="grid">${tiles(p.audit.screens)}</div></div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="page cover"><img src="${src(join(dir, "card.jpg"))}"></div>
    ${pages}
    <div class="page flow"><h2>Fix list for your coding agent, ${pr.pages.filter(p => p.audit).length} pages</h2><pre>${esc(fix)}</pre></div>
  </body></html>`;
}

async function print(html, dir, name) {
  const file = join(dir, "report.html");
  writeFileSync(file, html);
  const browser = await launch();
  try {
    await browser.send("Page.enable");
    const loaded = browser.waitFor("Page.loadEventFired", 30_000);
    await browser.send("Page.navigate", { url: pathToFileURL(file).href });
    await loaded;
    const pdf = await browser.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    const out = join(dir, name);
    writeFileSync(out, Buffer.from(pdf.data, "base64"));
    return out;
  } finally {
    browser.close();
  }
}

export function renderReport(run, issues, dir) {
  const host = new URL(run.audit.finalUrl ?? run.url).hostname.replace(/^www\./, "");
  return print(reportHtml(run, issues, dir), dir, `${host}-fit-check.pdf`);
}

export const renderPagesReport = (pr, dir) => print(pagesReportHtml(pr, dir), dir, `${pr.host}-pages-fit-check.pdf`);
