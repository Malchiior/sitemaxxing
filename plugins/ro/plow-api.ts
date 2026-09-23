// The few Plow API calls Sitemaxxing makes itself, the same way Plow's own
// plugin does (plow-openclaw-agent/plugin/transport.ts): find the owner's
// conversation, and send a file OpenClaw's attachment filter won't pass (a
// contact card).
import { readFileSync } from "node:fs";
import { basename } from "node:path";

type Participant = { type: string; role?: string; relationship?: string; line?: { uid: string } };
type Chat = { uid: string; status: string; participants: Participant[] };

async function request<T>(path: string, body?: unknown): Promise<T> {
  const base = process.env.PLOW_API_BASE?.replace(/\/$/, "");
  const token = process.env.PLOW_AGENT_TOKEN;
  if (!base || !token) throw new Error("Plow API isn't configured");
  const response = await fetch(`${base}/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Plow HTTP ${response.status}`);
  return await response.json() as T;
}

/** The owner's own conversation with this line: two participants, the owner and us. */
export async function ownerChatUid(): Promise<string> {
  const listing = await request<{ data: Chat[] }>("/chats");
  const owned = listing.data.filter(chat => chat.status === "active" && chat.participants.length === 2 &&
    chat.participants.some(p => p.type === "agent" && p.relationship === "self") &&
    chat.participants.some(p => p.type === "member" && p.role === "owner"));
  if (owned.length !== 1) throw new Error(owned.length ? "more than one owner conversation" : "no owner conversation yet");
  return owned[0].uid;
}

/** Send one line of text to a conversation. */
export async function sendText(chat: string, text: string): Promise<string> {
  const sent = await request<{ uid: string }>(`/chats/${chat}/messages`, { body: text });
  return sent.uid;
}

/** Upload a file and send it as a message with optional text. */
export async function sendFile(chat: string, path: string, contentType: string, text = ""): Promise<string> {
  const data = readFileSync(path);
  const upload = await request<{ uid: string; upload_url: string; upload_headers: Record<string, string> }>(
    `/chats/${chat}/attachments`, { filename: basename(path), content_type: contentType, size_bytes: data.length });
  const put = await fetch(upload.upload_url, { method: "PUT", headers: upload.upload_headers, body: data, signal: AbortSignal.timeout(30_000) });
  if (!put.ok) throw new Error(`upload HTTP ${put.status}`);
  const sent = await request<{ uid: string }>(`/chats/${chat}/messages`, { body: text, attachment_uids: [upload.uid] });
  return sent.uid;
}
