// Open one page on nine screens, screenshot what a visitor sees first on each,
// and measure what's wrong. Read-only: it loads the page like a visitor would.
//
//   node audit.mjs <url> <out-dir>
//
// Writes <out-dir>/screens/<id>.png and <out-dir>/audit.json, prints a summary line.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

/** Nine screens across the aspect ratios people actually use, smallest first. */
export const SCREENS = [
  { id: "android-small", label: "Small Android", width: 360, height: 800, dpr: 3, touch: true, mobile: true, ua: ANDROID },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667, dpr: 2, touch: true, mobile: true, ua: IPHONE },
  { id: "iphone", label: "iPhone 15", width: 393, height: 852, dpr: 3, touch: true, mobile: true, ua: IPHONE },
  { id: "iphone-max", label: "iPhone Pro Max", width: 430, height: 932, dpr: 3, touch: true, mobile: true, ua: IPHONE },
  { id: "ipad-portrait", label: "iPad portrait", width: 768, height: 1024, dpr: 2, touch: true, mobile: true, ua: IPAD },
  { id: "ipad-landscape", label: "iPad landscape", width: 1024, height: 768, dpr: 2, touch: true, mobile: true, ua: IPAD },
  { id: "laptop", label: "Laptop", width: 1366, height: 768, dpr: 1, touch: false, mobile: false, ua: DESKTOP },
  { id: "desktop", label: "Desktop", width: 1920, height: 1080, dpr: 1, touch: false, mobile: false, ua: DESKTOP },
  { id: "ultrawide", label: "Ultrawide", width: 2560, height: 1080, dpr: 1, touch: false, mobile: false, ua: DESKTOP },
];

const WEIGHT = { high: 25, medium: 10, low: 4 };
const MEASURE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "measure.js"), "utf8");

/** Turn one screen's measurements into issues a person can act on. */
export function issuesFor(screen, m) {
  const out = [];
  const add = (severity, key, title, evidence) => out.push({ severity, key, title, evidence });
  if (screen.touch && !/width\s*=\s*device-width/i.test(m.viewportMeta ?? "")) {
    add("high", "viewport", "No mobile viewport tag, so phones show a shrunken desktop page", m.viewportMeta);
  }
  if (m.overflow.px > 4) add("high", "sideways", `The page scrolls sideways by ${m.overflow.px}px`, m.overflow.elements);
  if (m.firstScreen.headlineCut) add("high", "headline-cut", "The headline runs off the edge of the screen", m.firstScreen.headline);
  if (m.covering.length) add("high", "covered", `Something covers ${m.covering[0].share}% of the screen on arrival`, m.covering);
  if (m.images.broken.length) add("high", "broken-images", `${m.images.broken.length} image(s) don't load`, m.images.broken.slice(0, 4));
  if (m.firstScreen.headline && !m.firstScreen.headlineVisible) add("medium", "headline-low", "The headline isn't on the first screen", m.firstScreen.headline);
  if (m.text.under12Pct >= 5) add("medium", "tiny-text", `${m.text.under12Pct}% of the text is smaller than 12px`, m.text.examples);
  if (screen.touch && m.tapTargets.small >= 1) add("medium", "tap-targets", `${m.tapTargets.small} button(s) or link(s) are under 24px, too small to tap (WCAG 2.2 minimum)`, m.tapTargets.examples);
  if (screen.touch && m.tapTargets.cramped >= 5) add("low", "cramped-targets", `${m.tapTargets.cramped} buttons or links are under Apple's 44px tap size`, m.tapTargets.crampedExamples);
  if (m.clipped.length) add("medium", "clipped", `Text is cut off in ${m.clipped.length} place(s)`, m.clipped);
  if (m.speed.kb > 3000) add("medium", "heavy", `The page downloads ${(m.speed.kb / 1024).toFixed(1)} MB`, m.speed);
  if (screen.touch && m.firstScreen.action && !m.firstScreen.actionVisible) add("low", "action-low", `"${m.firstScreen.action}" isn't on the first screen`, null);
  if (m.images.oversized.length) add("low", "oversized-images", `${m.images.oversized.length} image(s) are far bigger than shown`, m.images.oversized);
  return out.sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity]);
}

export const scoreOf = issues => Math.max(0, 100 - issues.reduce((sum, i) => sum + WEIGHT[i.severity], 0));

export async function audit(url, outDir) {
  mkdirSync(join(outDir, "screens"), { recursive: true });
  const browser = await launch();
  const report = { url, startedAt: new Date().toISOString(), screens: [] };
  try {
    await browser.send("Page.enable");
    await browser.send("Runtime.enable");
    await browser.send("Network.enable");
    await browser.send("Network.setCacheDisabled", { cacheDisabled: true });
    for (const screen of SCREENS) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width: screen.width, height: screen.height, deviceScaleFactor: 1, mobile: screen.mobile });
      await browser.send("Emulation.setTouchEmulationEnabled", screen.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      await browser.send("Emulation.setUserAgentOverride", { userAgent: screen.ua });
      const loaded = browser.waitFor("Page.loadEventFired", 25_000);
      const nav = await browser.send("Page.navigate", { url });
      if (nav.errorText) throw new Error(`couldn't load ${url}: ${nav.errorText}`);
      await loaded;
      // Fonts, then walk the page so lazy images load, then back to the top.
      await browser.evaluate(`(async () => {
        await document.fonts.ready;
        document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = "eager"; });
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 900));
      })()`);
      if (!report.finalUrl) report.finalUrl = await browser.evaluate("location.href");
      const shot = await browser.send("Page.captureScreenshot", { format: "png" });
      const file = join(outDir, "screens", `${screen.id}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      const measurements = await browser.evaluate(`(${MEASURE})(${JSON.stringify({ touch: screen.touch, dpr: screen.dpr })})`);
      const issues = issuesFor(screen, measurements);
      report.screens.push({ id: screen.id, label: screen.label, width: screen.width, height: screen.height, file, score: scoreOf(issues), issues, measurements });
    }
  } finally {
    browser.close();
  }
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, "audit.json"), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , url, outDir] = process.argv;
  const report = await audit(url, outDir);
  for (const s of report.screens) {
    console.log(`${s.label.padEnd(15)} ${String(s.width).padStart(4)}x${String(s.height).padEnd(4)} score ${String(s.score).padStart(3)}  ${s.issues.map(i => `[${i.severity}] ${i.title}`).join(" | ") || "no issues"}`);
  }
}
