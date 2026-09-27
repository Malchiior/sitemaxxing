import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";

// Factory context is host supplied, never model-controlled tool arguments.
// Session UUID changes on /new or /reset: intentionally do not revive old state.
export function conversationPaths(workspace: string, ctx: { sessionId?: string; sessionKey?: string; agentId?: string } | undefined) {
  if (!ctx?.sessionId?.trim() || !ctx?.sessionKey?.trim()) return null;
  const key = createHash("sha256").update(JSON.stringify([ctx.agentId ?? "", ctx.sessionKey, ctx.sessionId])).digest("hex");
  const root = join(workspace, "ro", "conversations", key);
  return { root, runs: join(root, "runs"), latest: join(root, "latest") };
}
export type ConversationPaths = NonNullable<ReturnType<typeof conversationPaths>>;
export function ownsRun(paths: ConversationPaths, dir: string): boolean {
  try {
    const rel = relative(realpathSync(paths.runs), realpathSync(dir));
    return Boolean(rel) && !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\");
  } catch { return false; }
}
export function latestRun(paths: ConversationPaths): string | null {
  try {
    const dir = readFileSync(paths.latest, "utf8").trim();
    return ownsRun(paths, dir) && existsSync(join(dir, "summary.json")) ? dir : null;
  } catch { return null; }
}
export function saveLatest(paths: ConversationPaths, dir: string) {
  if (!ownsRun(paths, dir)) throw new Error("Report does not belong to this conversation.");
  writeFileSync(paths.latest, dir);
}
