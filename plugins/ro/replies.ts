// The "fix" reply, built here so it reads the same every time (prompt/RO.md,
// "fix"): the intro, the fix list word for word, the closing line that
// invites the re-check, and the list as a file to attach.
export function fixReply(host: string, file: string, pages = 0): string {
  const what = pages > 1 ? `${host}, ${pages} pages` : host;
  return [
    `Fix list for ${what} attached. Give it to your coding agent as is, or reply "send to my agent" with your agent's number. Text me the site again after you deploy and I'll show you what changed.`,
    `MEDIA:${file}`,
  ].join("\n");
}

/** The "commands" text. */
export const COMMANDS = [
  "What I can do:",
  "- a website URL: fit check on 9 screens, Google and AI readability, PDF with the fix list. About a minute.",
  "- pages: the same for up to 4 more pages from that site's menu. About a minute per page.",
  "- the same URL again: what got fixed, what's still there, what's new since last time.",
  "- fix: the fix list as a file, for your coding agent.",
  "- send to my agent +1 555 000 0000: text the fix list to your coding agent's Plow number.",
  "- status: the last check.",
].join("\n");
