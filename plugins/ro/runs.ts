// Where earlier checks live, and how a re-check finds the one to compare
// against: the most recent finished check of the same page (same domain, with
// or without www, same path), never a pages run. Pure file reads.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** "sbeoc.com/about": one page, however it was spelled. */
export function pageKey(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "") || "/"}`;
}

/** Every earlier finished check of `url` under `runsDir`, newest first. */
export function earlierRuns(runsDir: string, url: string): string[] {
  if (!existsSync(runsDir)) return [];
  const want = pageKey(url);
  const found: string[] = [];
  // Run folders start with a timestamp, so name order is time order.
  for (const name of readdirSync(runsDir).sort().reverse()) {
    const dir = join(runsDir, name);
    if (!["summary.json", "audit.json", "seo.json"].every(file => existsSync(join(dir, file)))) continue;
    try {
      const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
      if (summary.kind === "pages") continue;
      // As texted, or where it landed: a site that redirects sbeoc.com to www.sbeoc.com/home matches either way.
      if ([summary.requested, summary.site].filter(Boolean).some((u: string) => pageKey(u) === want)) found.push(dir);
    } catch { /* not a finished run */ }
  }
  return found;
}

/** The newest earlier check of `url`, with the files a diff needs, or null. */
export const previousRun = (runsDir: string, url: string): string | null => earlierRuns(runsDir, url)[0] ?? null;
