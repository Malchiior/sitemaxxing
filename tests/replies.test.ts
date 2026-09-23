// Run: node --test tests/replies.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixReply } from "../plugins/ro/replies.ts";

const prompt = "FIX LIST FOR SBEOC.COM\n\nFIX FIRST\n\n1. The page scrolls sideways\nFix: make it fit.\n";

test("the fix reply: intro, the list word for word, the re-check invitation, then the file", () => {
  const reply = fixReply("sbeoc.com", prompt, "/runs/1/FIX-PROMPT.md");
  const lines = reply.split("\n");
  assert.equal(lines[0], `Here's the fix list for sbeoc.com, written for your coding agent. Paste the whole thing into Claude Code, Codex or Cursor in the site's repo. It's also attached as a file. Or reply "send to my agent" with your agent's number and I'll text it there.`);
  assert.ok(reply.includes(`\n\n${prompt.trim()}\n\n`), "the fix list is in the middle, untouched");
  assert.equal(lines.at(-2), "Text me the site again after you deploy and I'll show you what changed.");
  assert.equal(lines.at(-1), "MEDIA:/runs/1/FIX-PROMPT.md");
});

test("after a pages check the intro says how many pages the list covers", () => {
  assert.match(fixReply("sbeoc.com", prompt, "/x", 5), /^Here's the fix list for sbeoc\.com, 5 pages, written/);
  assert.match(fixReply("sbeoc.com", prompt, "/x", 1), /^Here's the fix list for sbeoc\.com, written/);
});
