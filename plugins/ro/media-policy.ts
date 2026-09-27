import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { conversationPaths, ownsRun, type ConversationPaths } from "./scope.ts";

type Binding = { scope: ConversationPaths | null; owner: boolean; sessionKey: string };
export function createMediaPolicy(workspace: string) {
  const sessions = new Map<string, ConversationPaths | null>();
  const turns = new Map<string, Binding>();
  const trim = (map: Map<any, any>) => { while (map.size > 1000) map.delete(map.keys().next().value); };
  function bind(ctx: any) {
    if (!ctx.sessionKey) return;
    sessions.set(ctx.sessionKey, conversationPaths(workspace, ctx)); trim(sessions);
  }
  function turn(ctx: any, owner: boolean) {
    if (!ctx.runId || !ctx.sessionKey) return;
    turns.set(ctx.runId, { scope: conversationPaths(workspace, ctx) ?? sessions.get(ctx.sessionKey) ?? null, owner, sessionKey: ctx.sessionKey }); trim(turns);
  }
  function allowed(scope: ConversationPaths | null, url: unknown) {
    if (!scope || typeof url !== "string") return false;
    try {
      const file = realpathSync(url.startsWith("file:") ? fileURLToPath(url) : url);
      const dir = dirname(file);
      if (!ownsRun(scope, dir)) return false;
      const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
      return [summary.report, summary.card, summary.images?.card, summary.images?.grid, summary.images?.google, summary.fixPrompt, join(dir, "FIX-PROMPT.md")]
        .filter(x => typeof x === "string")
        .some(x => { try { return realpathSync(x) === file; } catch { return false; } });
    } catch { return false; }
  }
  function guard(event: any, ctx: any) {
    const payload = event.payload;
    const urls = [...(payload.mediaUrls ?? []), ...(payload.mediaUrl ? [payload.mediaUrl] : [])];
    if (!urls.length) return;
    const key = event.sessionKey ?? ctx.sessionKey;
    const binding = turns.get(event.runId ?? ctx.runId);
    if (binding && binding.sessionKey === key && binding.owner) return;
    const scope = binding && binding.sessionKey === key ? binding.scope : sessions.get(key) ?? null;
    if (urls.every(url => allowed(scope, url))) return;
    // Cancel the whole payload so a denied path is not delivered as an attachment
    // or accidentally repeated in a generated fallback message.
    return { cancel: true, reason: "Only this conversation's generated reports can be attached." };
  }
  return { bind, turn, guard };
}
