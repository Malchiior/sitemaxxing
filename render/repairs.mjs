// For each broken image, a replacement URL, offered only when it's proven to
// work: first a same-alt image that loads at another screen size, then the
// URL with a pasted-in domain removed, if that URL actually returns an image.
import { groupScreenIssues, repairedImageUrl } from "./summarize.mjs";

const loadsAsImage = async candidate => {
  try {
    const res = await fetch(candidate, { method: "GET", signal: AbortSignal.timeout(10_000) });
    return res.ok && /^image\//.test(res.headers.get("content-type") ?? "");
  } catch { return false; }
};

export async function imageRepairs(auditResult, url) {
  const origin = new URL(auditResult.finalUrl ?? url).origin;
  const working = auditResult.screens.flatMap(s => s.measurements.images.working.map(w => ({ ...w, screen: s.label })));
  const repairs = [];
  const seen = new Set();
  for (const issue of groupScreenIssues(auditResult).filter(i => i.key === "broken-images")) {
    for (const { src, alt } of issue.evidence ?? []) {
      if (seen.has(src)) continue;
      seen.add(src);
      const twin = alt && working.find(w => w.alt.toLowerCase() === alt.toLowerCase());
      if (twin) { repairs.push(`${src} -> ${twin.src} (the working image with the same alt text, "${alt}")`); continue; }
      const candidate = repairedImageUrl(src, origin);
      if (candidate && new URL(candidate).origin === origin && await loadsAsImage(candidate)) repairs.push(`${src} -> ${candidate}`);
    }
  }
  return repairs;
}
