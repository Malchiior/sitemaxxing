import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerHooks } from "node:module";
import { conversationPaths, latestRun, saveLatest } from "../plugins/ro/scope.ts";
import { earlierRuns } from "../plugins/ro/runs.ts";

const workspace = mkdtempSync(join(tmpdir(), "ro-multiplayer-"));
process.env.RO_WORKSPACE = workspace;
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === "openclaw/plugin-sdk/plugin-entry") return { url: "data:text/javascript,export const definePluginEntry = x => x", shortCircuit: true };
  return next(specifier, context);
}});
const { default: plugin } = await import("../plugins/ro/index.ts");
hook.deregister();
const factories: any[] = [];
let before: any;
plugin.register({ registerTool: (f: any) => factories.push(f), on: (_n: string, fn: any) => { if (_n === "before_tool_call") before = fn; }, logger: {} } as any);
const context = (id: string) => ({ sessionId: id, sessionKey: `agent:main:plow:direct:${id}`, agentId: "main" });
const tools = (ctx: any) => Object.fromEntries(factories.map(f => { const t = f(ctx); return [t.name, t]; }));
function fixture(id: string, site: string) {
  const scope = conversationPaths(workspace, context(id))!;
  const dir = join(scope.runs, "20260927-site");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "summary.json"), JSON.stringify({ site, pages: [], message: id }));
  writeFileSync(join(dir, "audit.json"), "{}");
  writeFileSync(join(dir, "seo.json"), "{}");
  writeFileSync(join(dir, "FIX-PROMPT.md"), id);
  saveLatest(scope, dir);
  return { scope, dir };
}
test("two conversations retain independent status, fixes, pages and recheck histories", async () => {
  const a = fixture("alice", "https://alice.example/");
  const b = fixture("bob", "https://bob.example/");
  for (const [id, own, other] of [["alice", a, b], ["bob", b, a]] as const) {
    const t = tools(context(id));
    const status = await t.ro_status.execute();
    assert.match(status.content[0].text, new RegExp(`${id}.example`));
    const fix = await t.ro_fix_prompt.execute();
    assert.equal(fix.details.file, join(own.dir, "FIX-PROMPT.md"));
    const pages = await t.ro_check_pages.execute();
    assert.match(pages.content[0].text, new RegExp(`${id}.example`));
    assert.deepEqual(earlierRuns(own.scope.runs, `https://${id}.example/`), [own.dir]);
    assert.deepEqual(earlierRuns(own.scope.runs, `https://${id === "alice" ? "bob" : "alice"}.example/`), []);
    assert.throws(() => saveLatest(own.scope, other.dir));
  }
});
test("unknown context and reset sessions never fall back to the shared legacy report", async () => {
  mkdirSync(join(workspace, "ro"), { recursive: true });
  writeFileSync(join(workspace, "ro", "latest"), "legacy-private-report");
  for (const ctx of [{}, { sessionKey: "x" }, { sessionId: "x" }]) {
    assert.equal(conversationPaths(workspace, ctx), null);
    const t = tools(ctx);
    for (const name of ["ro_check", "ro_check_pages", "ro_fix_prompt", "ro_status"]) {
      assert.equal((await t[name].execute("id", { url: "https://example.com" })).isError, true);
    }
  }
  assert.equal(latestRun(conversationPaths(workspace, { ...context("alice"), sessionId: "reset" })!), null);
});
test("shared group has one scope regardless of sender; tampered pointer fails closed", () => {
  const group = { sessionId: "group", sessionKey: "agent:main:plow:group:123" };
  assert.deepEqual(conversationPaths(workspace, { ...group, requesterSenderId: "alice" } as any), conversationPaths(workspace, { ...group, requesterSenderId: "bob" } as any));
  const a = fixture("pointer", "https://example.com/");
  const b = fixture("other", "https://example.org/");
  writeFileSync(a.scope.latest, b.dir);
  assert.equal(latestRun(a.scope), null);
});
test("handoff requires explicit host-confirmed owner; unknown requester is blocked", async () => {
  for (const requester of [undefined, {}, { senderId: "bob", senderIsOwner: false }]) {
    assert.equal((await before({ toolName: "plow_start_thread" }, { requester })).block, true);
  }
  assert.equal(await before({ toolName: "plow_start_thread" }, { requester: { senderId: "alice", senderIsOwner: true } }), undefined);
});
process.on("exit", () => rmSync(workspace, { recursive: true, force: true }));

test("guest tools cannot bypass scoped reports through files, shell, memory, delegates or messages", async () => {
  const forbidden = ["read", "write", "edit", "exec", "process", "apply_patch", "browser", "memory_search", "memory_get", "sessions_list", "sessions_history", "sessions_send", "sessions_spawn", "subagents", "cron", "message", "plow_start_thread", "ro_contact_card", "future_plugin_tool"];
  for (const requester of [undefined, { senderId: "guest", senderIsOwner: false }, { senderIsOwner: true }]) {
    for (const toolName of forbidden) {
      assert.equal((await before({ toolName }, { requester })).block, true, toolName);
    }
    for (const toolName of ["ro_check", "ro_check_pages", "ro_status", "ro_fix_prompt", "ro_greeting", "ro_commands"]) {
      assert.equal(await before({ toolName }, { requester }), undefined, toolName);
    }
  }
  for (const toolName of forbidden) {
    assert.equal(await before({ toolName }, { requester: { senderId: "owner", senderIsOwner: true } }), undefined);
  }
});
