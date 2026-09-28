// The one thing Sitemaxxing does through Plow Latch (the owner's Mac app):
// put the fix list where their coding agent can read it, ~/Plow/sitemaxxing/.
// Latch auto-approves writes inside ~/Plow, so nothing pops up on the Mac.
// Plow's base image runs a local bridge to the Mac's MCP server whenever the
// account has a Mac (plow-openclaw-agent/boot/mcp-bridge.ts); the relay is
// stateless, so one tools/call is the whole exchange. Optional by design:
// without a Mac the bridge isn't running and the reply says so.
const bridge = () => process.env.RO_LATCH_BRIDGE ?? "http://127.0.0.1:18790";

export type MacWrite =
  | { status: "completed"; path: string }
  | { status: "pending"; path: string }
  | { status: "not-connected" }
  | { status: "refused"; cause: string };

/** The Mac-side path for a site's fix list. Latch resolves ~ to the owner's home. */
export const macPath = (host: string) => `~/Plow/sitemaxxing/${host.replace(/[^a-z0-9.-]/gi, "_")}-fix.md`;

/** Write the fix list to the owner's Mac. Never throws: every outcome is a status. */
export async function writeToMac(host: string, content: string): Promise<MacWrite> {
  const token = process.env.PLOW_MCP_BRIDGE_TOKEN;
  if (!token) return { status: "not-connected" };
  const path = macPath(host);
  let raw: string;
  try {
    const response = await fetch(bridge(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "plow_write_file", arguments: {
        path, content, goal: `Save the Sitemaxxing fix list for ${host} where the owner's coding agent can read it`,
      } } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { status: "not-connected" };
    raw = await response.text();
  } catch {
    return { status: "not-connected" };
  }
  try {
    if (/^(event:|data:)/m.test(raw)) raw = raw.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trim()).join("\n");
    const result = JSON.parse(raw).result;
    const payload = result.structuredContent ?? JSON.parse(result.content.find((c: { type: string }) => c.type === "text").text);
    if (result.isError) {
      const cause = String(payload?.diagnosis?.cause ?? payload?.error ?? "error");
      return /not.?connected|offline|no device|unreachable/i.test(cause) ? { status: "not-connected" } : { status: "refused", cause };
    }
    const status = payload.status ?? "completed";
    if (status === "completed") return { status: "completed", path: String(payload.path ?? path) };
    if (status === "pending") return { status: "pending", path };
    return { status: "refused", cause: String(status) };
  } catch {
    return { status: "not-connected" };
  }
}

/** The reply for each outcome (prompt/RO.md, "send to my mac"). */
export function macReply(host: string, outcome: MacWrite): string {
  switch (outcome.status) {
    case "completed":
      return `Saved the fix list for ${host} on your Mac at ${outcome.path}. Open your coding agent in the site's repo and tell it: apply ${outcome.path}. Text me the site again after you deploy and I'll show you what changed.`;
    case "pending":
      return `Your Mac is asking you to approve saving ${outcome.path}. Approve it in Plow Latch and the file is there; then tell your coding agent to apply it.`;
    case "not-connected":
      return `Your Mac isn't connected. Open Plow Latch on it (plow.co/latch) and reply "send to my mac" again, or give your coding agent the file above.`;
    case "refused":
      return `Your Mac wouldn't take the file (${outcome.cause}). Give your coding agent the file above instead.`;
  }
}
