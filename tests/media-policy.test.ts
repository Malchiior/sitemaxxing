import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { conversationPaths } from "../plugins/ro/scope.ts";
import { createMediaPolicy } from "../plugins/ro/media-policy.ts";
test("outbound MEDIA permits own PDF/fix but blocks other chats, known workspace files and remote URLs", () => {
 const root = mkdtempSync(join(tmpdir(), "media-policy-"));
 try {
  const policy = createMediaPolicy(root);
  function fixture(id: string) {
   const ctx = { sessionId: id, sessionKey: id, runId: `${id}-run` };
   const scope = conversationPaths(root, ctx)!;
   const dir = join(scope.runs, "run"); mkdirSync(dir, { recursive: true });
   const report = join(dir, "report.pdf"); const fix = join(dir, "FIX-PROMPT.md");
   const redesign = join(dir, "REDESIGN-PROMPT.md"); writeFileSync(redesign, "brief");
   writeFileSync(report, "pdf"); writeFileSync(fix, "fix");
   writeFileSync(join(dir, "summary.json"), JSON.stringify({ report, fixPrompt: fix }));
   policy.bind(ctx); policy.turn(ctx, false); return { ctx, report, fix, redesign };
  }
  const a = fixture("alice"), b = fixture("bob");
  const secret = join(root, "MEMORY.md"); writeFileSync(secret, "private");
  const guard = (url: string, ctx = a.ctx) => policy.guard({ payload: { mediaUrls: [url] }, sessionKey: ctx.sessionKey, runId: ctx.runId }, {});
  assert.equal(guard(a.report), undefined);
  assert.equal(guard(a.redesign), undefined);
  assert.equal(guard(pathToFileURL(a.fix).href), undefined);
  for (const url of [b.report, b.fix, b.redesign, secret, "https://example.com/file.pdf", join(root, "missing.pdf")]) assert.equal(guard(url)?.cancel, true);
  assert.equal(policy.guard({ payload: { mediaUrl: a.report } }, {})?.cancel, true);
  policy.turn(a.ctx, true); assert.equal(guard(secret), undefined);
  // Privilege does not transfer to another run or another conversation.
  assert.equal(guard(secret, { ...a.ctx, runId: "guest-next" })?.cancel, true);
  assert.equal(guard(secret, { ...b.ctx, runId: a.ctx.runId })?.cancel, true);
  assert.equal(policy.guard({ payload: { text: "Hello" } }, {}), undefined);
 } finally { rmSync(root, { recursive: true, force: true }); }
});
