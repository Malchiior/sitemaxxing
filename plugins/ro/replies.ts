// The "fix" reply, built here so it reads the same every time (prompt/RO.md,
// "fix"): the intro, the fix list word for word, the closing line that
// invites the re-check, and the list as a file to attach.
export function fixReply(host: string, prompt: string, file: string, pages = 0): string {
  const what = pages > 1 ? `${host}, ${pages} pages` : host;
  return [
    `Here's the fix list for ${what}, written for your coding agent. Paste the whole thing into Claude Code, Codex or Cursor in the site's repo. It's also attached as a file. Or reply "send to my agent" with your agent's number and I'll text it there.`,
    "",
    prompt.trim(),
    "",
    "Text me the site again after you deploy and I'll show you what changed.",
    `MEDIA:${file}`,
  ].join("\n");
}
