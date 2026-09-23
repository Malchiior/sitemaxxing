// Run: node --test tests/replies.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, fixReply } from "../plugins/ro/replies.ts";

test("the fix reply: one line ending with the re-check invitation, then the file, never the list", () => {
  const reply = fixReply("sbeoc.com", "/runs/1/FIX-PROMPT.md");
  assert.deepEqual(reply.split("\n"), [
    `Fix list for sbeoc.com attached. Give it to your coding agent as is, or reply "send to my agent" with your agent's number. Text me the site again after you deploy and I'll show you what changed.`,
    "MEDIA:/runs/1/FIX-PROMPT.md",
  ]);
  assert.match(fixReply("sbeoc.com", "/x", 5), /^Fix list for sbeoc\.com, 5 pages attached/);
});

test("the commands text is short, plain and complete", () => {
  for (const word of ["pages", "fix", "send to my agent", "status", "same URL again"]) assert.ok(COMMANDS.includes(word), word);
  assert.doesNotMatch(COMMANDS, /[*#]/);
  assert.ok(COMMANDS.split("\n").length <= 8);
});
