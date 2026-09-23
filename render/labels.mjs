// Short, human words for what was measured: the card, the text and the PDF
// all say the same thing the same way. Pure functions; every number comes
// from the issue's own evidence.

const PHONES = ["android-small", "iphone-se", "iphone", "iphone-max"];
const TABLETS = ["ipad-portrait", "ipad-landscape"];
const COMPUTERS = ["laptop", "desktop", "ultrawide"];

/** "phones", "phones and iPad portrait", "all screens", "laptop and desktop"... */
export function where(screenIds) {
  const ids = new Set(screenIds);
  if (ids.size === 9) return "all screens";
  const parts = [];
  const group = (members, name, singular) => {
    const hit = members.filter(id => ids.has(id));
    if (hit.length === members.length) parts.push(name);
    else hit.forEach(id => parts.push(singular[id]));
  };
  group(PHONES, "phones", { "android-small": "small Android", "iphone-se": "iPhone SE", iphone: "iPhone 15", "iphone-max": "iPhone Pro Max" });
  group(TABLETS, "tablets", { "ipad-portrait": "iPad portrait", "ipad-landscape": "iPad landscape" });
  group(COMPUTERS, "computers", { laptop: "laptop", desktop: "desktop", ultrawide: "ultrawide" });
  return parts.length <= 2 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** Score for a group of screens: one number, or a range. */
export function scoreRange(screens, ids) {
  const scores = screens.filter(s => ids.includes(s.id)).map(s => s.score);
  if (!scores.length) return null;
  const lo = Math.min(...scores), hi = Math.max(...scores);
  return { lo, hi, text: lo === hi ? `${lo}` : `${lo}–${hi}` };
}

export const groups = screens => ({
  phones: scoreRange(screens, PHONES),
  tablets: scoreRange(screens, TABLETS),
  computers: scoreRange(screens, COMPUTERS),
});

const n = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** A short headline for one grouped issue, e.g. "Logo image missing on phones and iPad portrait". */
export function shortTitle(issue) {
  const on = issue.screenIds?.length ? ` on ${where(issue.screenIds)}` : "";
  const ev = issue.evidence;
  switch (issue.key) {
    case "viewport": return `Not set up for phones${on}`;
    case "sideways": return `Page scrolls sideways${on}`;
    case "headline-cut": return `Headline cut off${on}`;
    case "covered": return `Pop-up covers the page${on}`;
    case "broken-images": {
      const alt = Array.isArray(ev) && ev[0]?.alt ? `"${ev[0].alt}" image` : Array.isArray(ev) && ev.length > 1 ? n(ev.length, "image") : "An image";
      return `${alt} missing${on}`;
    }
    case "headline-low": return `Headline not on the first screen${on}`;
    case "tiny-text": return `Text too small to read${on}`;
    case "tap-targets": return `Buttons too small to tap${on}`;
    case "cramped-targets": return `Buttons a little small to tap${on}`;
    case "clipped": return `Text cut off${on}`;
    case "heavy": return `Heavy page: ${ev?.kb ? (ev.kb / 1024).toFixed(1) + " MB" : "slow to load"}${on}`;
    case "action-low": return `Main button not on the first screen${on}`;
    case "oversized-images": return `Images far bigger than needed${on}`;
    case "unreachable": return /^The homepage/.test(issue.title ?? "") ? "Homepage didn't load" : "Page didn't load";
    case "noindex": return "Hidden from Google (noindex)";
    case "google-blocked": return "robots.txt blocks Google";
    case "no-title": return "No page title";
    case "title-cut": return "Google cuts off your title";
    case "no-description": return "No Google description";
    case "description-cut": return "Google cuts off your description";
    case "no-h1": return "No main headline";
    case "many-h1": return "Several main headlines";
    case "alt-text": return `${Array.isArray(ev) ? n(ev.length, "image") : "Images"} missing alt text`;
    case "no-share-image": return "No image when shared on social";
    case "no-canonical": return "No canonical link";
    case "no-sitemap": return "No sitemap";
    case "firewall": return "Firewall turns away AI crawlers";
    case "thin": return "Almost no text on the page";
    case "js-only": return "AI can't see most of your text";
    case "ai-blocked": return "AI crawlers blocked in robots.txt";
    case "no-schema": return "No structured data for AI";
    case "no-llms-txt": return "No llms.txt";
    case "no-lang": return "Page language not set";
    default: return issue.title;
  }
}

export const DOT = { high: "🔴", medium: "🟡", low: "⚪" };
