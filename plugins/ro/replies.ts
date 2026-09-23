// The "fix" reply and the "commands" text, built here so they read the same
// every time (prompt/RO.md). One line, then the file; the value is in the file.
export function fixReply(host: string, file: string, pages = 0): string {
  const what = pages > 1 ? `${host}, ${pages} pages` : host;
  return [
    `Fix list for ${what} attached. Give it to your coding agent as is, or reply "send to my agent" with your agent's number. Text me the site again after you deploy and I'll show you what changed.`,
    `MEDIA:${file}`,
  ].join("\n");
}

/** The first-contact greeting, with the person's first name when Plow gave one. */
export function greeting(name?: string): string {
  const who = (name ?? "").trim().split(/\s+/)[0];
  return `Hi${who ? ` ${who}` : ""}. I am your website maxxing agent. Text me a website address whenever you want a fit check, or text "commands" to see a list of what I can do.`;
}

/** The "commands" text: an emoji per action, so a reply of just the emoji works too. */
export const COMMANDS = [
  "What I can do. Reply with the word or just the emoji.",
  "",
  "🔍 A website URL",
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
  "📤 send to my agent +1 555 000 0000",
  "Texts the fix list to your coding agent's Plow number.",
  "",
  "📊 status",
  "The last check.",
].join("\n");
