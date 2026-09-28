// Run: node --test tests/latch.test.ts
// "send to my mac" against a fake Latch bridge: every outcome is a status and
// a reply, never a throw, and a missing bridge (no Mac on the account) reads
// as "not connected".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";

let server: Server;
let mode: "completed" | "sse" | "pending" | "error" | "offline" | "garbage" = "completed";
let seen: { auth?: string; name?: string; args?: Record<string, unknown> } = {};

before(async () => {
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const rpc = JSON.parse(body);
    seen = { auth: req.headers.authorization, name: rpc.params.name, args: rpc.params.arguments };
    const json = (result: unknown) => JSON.stringify({ jsonrpc: "2.0", id: 1, result });
    const text = (o: unknown) => ({ content: [{ type: "text", text: JSON.stringify(o) }] });
    switch (mode) {
      case "completed": res.end(json({ structuredContent: { status: "completed", path: "/Users/devin/Plow/sitemaxxing/sbeoc.com-fix.md" } })); break;
      case "sse": res.setHeader("content-type", "text/event-stream"); res.end(`event: message\ndata: ${json(text({ status: "completed", path: "/Users/devin/Plow/sitemaxxing/sbeoc.com-fix.md" }))}\n\n`); break;
      case "pending": res.end(json({ structuredContent: { status: "pending", handle: "h1", reason: "approval" } })); break;
      case "error": res.end(json({ isError: true, ...text({ diagnosis: { cause: "deny_mode" } }) })); break;
      case "offline": res.end(json({ isError: true, ...text({ diagnosis: { cause: "device not connected" } }) })); break;
      case "garbage": res.end("<html>"); break;
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  process.env.RO_LATCH_BRIDGE = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.PLOW_MCP_BRIDGE_TOKEN = "bridge-secret";
});
after(() => server.close());

const { writeToMac, macReply, macPath } = await import("../plugins/ro/latch.ts");

test("writes the fix list into ~/Plow/sitemaxxing through plow_write_file with the bridge token", async () => {
  mode = "completed";
  const outcome = await writeToMac("sbeoc.com", "# Fix list\n");
  assert.deepEqual(outcome, { status: "completed", path: "/Users/devin/Plow/sitemaxxing/sbeoc.com-fix.md" });
  assert.equal(seen.auth, "Bearer bridge-secret");
  assert.equal(seen.name, "plow_write_file");
  assert.equal(seen.args?.path, "~/Plow/sitemaxxing/sbeoc.com-fix.md");
  assert.equal(seen.args?.content, "# Fix list\n");
  assert.match(macReply("sbeoc.com", outcome), /^Saved the fix list for sbeoc\.com on your Mac at \/Users\/devin\/Plow\/sitemaxxing\/sbeoc\.com-fix\.md\. .*apply \/Users\/devin\/Plow\/sitemaxxing\/sbeoc\.com-fix\.md\. Text me the site again/);
});

test("reads an SSE-framed reply too", async () => {
  mode = "sse";
  assert.equal((await writeToMac("sbeoc.com", "x")).status, "completed");
});

test("a pending approval and a refusal each get their own line", async () => {
  mode = "pending";
  const pending = await writeToMac("sbeoc.com", "x");
  assert.equal(pending.status, "pending");
  assert.match(macReply("sbeoc.com", pending), /approve saving ~\/Plow\/sitemaxxing\/sbeoc\.com-fix\.md.*Plow Latch/);
  mode = "error";
  const refused = await writeToMac("sbeoc.com", "x");
  assert.deepEqual(refused, { status: "refused", cause: "deny_mode" });
  assert.match(macReply("sbeoc.com", refused), /wouldn't take the file \(deny_mode\)/);
});

test("no Mac: an offline device, a garbage reply, a dead bridge or no token all read as not connected", async () => {
  mode = "offline";
  assert.equal((await writeToMac("sbeoc.com", "x")).status, "not-connected");
  mode = "garbage";
  assert.equal((await writeToMac("sbeoc.com", "x")).status, "not-connected");
  const live = process.env.RO_LATCH_BRIDGE;
  process.env.RO_LATCH_BRIDGE = "http://127.0.0.1:1";
  assert.equal((await writeToMac("sbeoc.com", "x")).status, "not-connected");
  process.env.RO_LATCH_BRIDGE = live;
  delete process.env.PLOW_MCP_BRIDGE_TOKEN;
  assert.equal((await writeToMac("sbeoc.com", "x")).status, "not-connected");
  process.env.PLOW_MCP_BRIDGE_TOKEN = "bridge-secret";
  assert.match(macReply("sbeoc.com", { status: "not-connected" }), /Open Plow Latch on it \(plow\.co\/latch\) and reply "send to my mac" again/);
});

test("the Mac path is safe for any host", () => {
  assert.equal(macPath("sbeoc.com"), "~/Plow/sitemaxxing/sbeoc.com-fix.md");
  assert.equal(macPath("a/b:c"), "~/Plow/sitemaxxing/a_b_c-fix.md");
});
