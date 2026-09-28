// The "fix" reply and the "commands" text, built here so they read the same
// every time (prompt/RO.md). One line, then the file; the value is in the file.
export function fixReply(host: string, file: string, pages = 0): string {
  const what = pages > 1 ? `${host}, ${pages} pages` : host;
  return [
    `Fix list for ${what} attached. Give it to your coding agent as is, reply "send to my mac" to save it on your Mac (Plow Latch), or "send to my agent" with your agent's number. Text me the site again after you deploy and I'll show you what changed.`,
    `MEDIA:${file}`,
  ].join("\n");
}

/** The first-contact greeting, with the person's first name when Plow gave one. */
export function greeting(name?: string): string {
  const raw = (name ?? "").trim().split(/\s+/)[0];
  const who = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
  return `Hi${who ? ` ${who}` : ""}. I am your website maxxing agent. Text me a website address whenever you want a fit check, or text "commands" to see a list of what I can do.`;
}

/** The "commands" text: an emoji per action, so a reply of just the emoji works too. */
export const COMMANDS = [
  "What I can do. Reply with the word or just the emoji.",
  "",
  "🔍 A website URL, or report for the last site",
  "Fit check on 9 screens, Google and AI readability. PDF with the fix list. About a minute.",
  "",
  "📄 pages",
  "The same check on up to 4 more pages from that site's menu. About a minute per page.",
  "",
  "🔁 The same URL again",
  "What got fixed, what's still there, what's new since last time.",
  "",
  "🛠️ fix",
  "The fix list as a file, for your coding agent.",
  "",
  "💻 send to my mac",
  "Saves the fix list in ~/Plow/sitemaxxing on your Mac, if Plow Latch is on it. Then tell your coding agent to apply it.",
  "",
  "📤 send to my agent +1 555 000 0000",
  "Texts the fix list to your coding agent's Plow number.",
  "",
  "📊 status",
  "The last check.",
  "",
  "🎨 redesign (owner)",
  "Choose pages and approve one sample before generating more. Opens your private website workspace; no generation starts by text.",
  "",
  "🖼️ assets (owner)",
  "Create a logo or illustrations. Connect your image provider on the website, never by text. Provider charges apply.",
  "",
  "📦 package (owner)",
  "Bundle the report, fix prompt and available designs into a ZIP and protected page. No image generation needed.",
].join("\n");
