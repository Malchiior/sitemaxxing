// One picture: the site's first screen on all nine screens, each labeled with
// its size, score and top issue. Built as an HTML page and screenshotted by
// Chromium, so it needs nothing beyond the renderer.
//
//   node grid.mjs <audit-dir>        (reads audit.json, writes grid.png)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./cdp.mjs";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tone = score => score >= 90 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";

export function gridHtml(report) {
  const host = new URL(report.finalUrl ?? report.url).hostname.replace(/^www\./, "");
  const tiles = report.screens.map((s, i) => {
    const top = s.issues[0];
    return `<figure class="tile">
      <figcaption><span class="n">${i + 1}</span><b>${esc(s.label)}</b><span class="dim">${s.width}×${s.height}</span>
        <span class="score" style="background:${tone(s.score)}">${s.score}</span></figcaption>
      <div class="shot"><img src="${pathToFileURL(s.file).href}"></div>
      <p class="issue">${top ? esc(top.title) : "No issues found"}${s.issues.length > 1 ? ` <span class="more">+${s.issues.length - 1} more</span>` : ""}</p>
    </figure>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 1800px; background: #0f1115; color: #e8eaef; font: 15px/1.4 "Liberation Sans", Arial, sans-serif; padding: 36px; }
    header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px; }
    h1 { font-size: 30px; font-weight: 700; } h1 span { color: #9aa3b2; font-weight: 400; }
    .brand { color: #9aa3b2; font-size: 15px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .tile { background: #171a21; border: 1px solid #262b36; border-radius: 14px; padding: 14px; }
    figcaption { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 16px; }
    .n { width: 26px; height: 26px; border-radius: 50%; background: #262b36; display: grid; place-items: center; font-size: 13px; font-weight: 700; }
    .dim { color: #9aa3b2; }
    .score { margin-left: auto; color: #fff; font-weight: 700; border-radius: 999px; padding: 2px 12px; font-size: 15px; }
    .shot { height: 420px; background: #0b0d11; border-radius: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .shot img { max-width: 100%; max-height: 420px; border-radius: 6px; box-shadow: 0 0 0 1px #2a2f3a; }
    .issue { margin-top: 12px; min-height: 42px; color: #d6d9e0; }
    .more { color: #9aa3b2; }
  </style></head><body>
    <header><h1>${esc(host)} <span>on 9 screens</span></h1><div class="brand">Sitemaxxing fit check · ${new Date(report.finishedAt ?? Date.now()).toISOString().slice(0, 10)}</div></header>
    <div class="grid">${tiles}</div>
  </body></html>`;
}

export async function renderGrid(auditDir) {
  const report = JSON.parse(readFileSync(join(auditDir, "audit.json"), "utf8"));
  const htmlFile = join(auditDir, "grid.html");
  writeFileSync(htmlFile, gridHtml(report));
  const browser = await launch();
  try {
    await browser.send("Page.enable");
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1800, height: 1000, deviceScaleFactor: 1, mobile: false });
    const loaded = browser.waitFor("Page.loadEventFired", 15_000);
    await browser.send("Page.navigate", { url: pathToFileURL(htmlFile).href });
    await loaded;
    const height = await browser.evaluate("document.documentElement.scrollHeight");
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1800, height, deviceScaleFactor: 1, mobile: false });
    const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const out = join(auditDir, "grid.png");
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    return out;
  } finally {
    browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await renderGrid(process.argv[2]));
}
