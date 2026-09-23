// Resolution Optimizer's tools. The rules that matter are here, in code:
// - ro_check opens public websites only (url-guard), one at a time, capped per
//   hour, and every number it reports was measured by render/check.mjs.
// - ro_fix_prompt returns the prompt render/summarize.mjs built from those
//   measurements, word for word; the model doesn't write fixes.
// - Only the owner can send results to another number (plow_start_thread),
//   recognised by the host, not by name.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { checkableUrl, UrlRefused } from "./url-guard.ts";

const WORKSPACE = process.env.RO_WORKSPACE ?? "/var/lib/plow/workspace";
const RUNS = join(WORKSPACE, "ro", "runs");
const LATEST = join(WORKSPACE, "ro", "latest");
const CHECK_SCRIPT = process.env.RO_CHECK_SCRIPT ?? "/opt/ro/render/check.mjs";
const CHECK_TIMEOUT_MS = 4 * 60_000;
const MAX_PER_HOUR = 12;

let running: string | null = null;
const recent: number[] = [];

type Result = { content: { type: "text"; text: string }[]; details: Record<string, unknown>; isError?: boolean };
const ok = (text: string, details: Record<string, unknown> = {}): Result => ({ content: [{ type: "text", text }], details });
const fail = (text: string): Result => ({ isError: true, content: [{ type: "text", text }], details: {} });

function latestRun(): string | null {
  if (!existsSync(LATEST)) return null;
  const dir = readFileSync(LATEST, "utf8").trim();
  return existsSync(join(dir, "summary.json")) ? dir : null;
}

/** Why a check failed, in words for the person (messages.md, Failures). */
function failureText(host: string, stderr: string, timedOut: boolean): string {
  if (/blocked: bot-check/.test(stderr)) return `${host} is behind a bot check (a "verify you are human" page), so I'm seeing that instead of your site. If you can allow it for a few minutes, send the address again.`;
  if (/blocked: login/.test(stderr)) return `${host} asks for a login before showing anything. Send me a page anyone can see.`;
  if (timedOut || /couldn't load|ERR_|timed out|timeout/i.test(stderr)) return `Couldn't reach ${host}; it didn't load. Send it again when it's up.`;
  return `Couldn't finish checking ${host}. Send it again in a minute.`;
}

function runCheck(url: string, dir: string, host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [CHECK_SCRIPT, url, dir], { timeout: CHECK_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(failureText(host, stderr ?? "", Boolean(error.killed))));
      else resolve(stdout);
    });
  });
}

export default definePluginEntry({
  id: "ro",
  name: "Resolution Optimizer",
  description: "Checks a website on nine screens, for SEO and for AI readability, and builds a fix prompt from what it measured.",
  register(api) {
    api.registerTool({
      name: "ro_check", label: "Check a website",
      description: "Open a public website's homepage on 9 screens (small Android to ultrawide), measure layout problems on each, check SEO and how well AI tools can read it, and build the fix prompt. Takes about a minute. Returns the measured results and the two images to send (the 9-screen grid and the Google preview). Only public websites.",
      parameters: {
        type: "object", required: ["url"], additionalProperties: false,
        properties: { url: { type: "string", description: "The website address as the person sent it, e.g. sbeoc.com or https://sbeoc.com" } },
      },
      async execute(_id: string, args: { url: string }) {
        let url: URL;
        try { url = await checkableUrl(args.url); }
        catch (error) { return fail(error instanceof UrlRefused ? error.message : "Couldn't read that address."); }
        const host = url.hostname.replace(/^www\./, "");
        if (running) return fail(`One check at a time. ${running} is running now; send ${host} again in about a minute.`);
        const hourAgo = Date.now() - 3_600_000;
        while (recent.length && recent[0] < hourAgo) recent.shift();
        if (recent.length >= MAX_PER_HOUR) {
          const minutes = Math.max(1, Math.ceil((recent[0] + 3_600_000 - Date.now()) / 60_000));
          return fail(`That's ${MAX_PER_HOUR} checks this hour, which is the limit. Send it again in ${minutes} minute${minutes === 1 ? "" : "s"} and I'll run it.`);
        }
        const dir = join(RUNS, `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}-${host}`);
        mkdirSync(dir, { recursive: true });
        running = host;
        recent.push(Date.now());
        try {
          const summary = JSON.parse(await runCheck(url.href, dir, host));
          writeFileSync(LATEST, dir);
          return ok(`${JSON.stringify(summary, null, 1)}\n\nAttach the images with these lines in your reply:\nMEDIA:${summary.images.grid}\nMEDIA:${summary.images.google}`,
            { site: summary.site, dir });
        } catch (error) {
          return fail(error instanceof Error ? error.message : `Couldn't finish checking ${host}. Send it again in a minute.`);
        } finally {
          running = null;
        }
      },
    });

    api.registerTool({
      name: "ro_fix_prompt", label: "The fix prompt for the owner's coding agent",
      description: "Return the fix prompt for the most recent check, built from its measurements. Send it word for word, never edited or summarized, so the owner can paste it into Claude Code, Codex, Cursor or any coding agent.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        const dir = latestRun();
        if (!dir) return fail("No check yet. Send a website address first.");
        const file = join(dir, "FIX-PROMPT.md");
        return ok(`${readFileSync(file, "utf8")}\n\n(To also attach it as a file: MEDIA:${file})`, { file });
      },
    });

    api.registerTool({
      name: "ro_status", label: "The latest check",
      description: "The most recent check's results, from its files.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        const dir = latestRun();
        return dir ? ok(readFileSync(join(dir, "summary.json"), "utf8")) : ok("No check yet.");
      },
    });

    api.on("before_tool_call", async (event, ctx) => {
      if (event.toolName !== "plow_start_thread") return;
      // Starting a thread with a new number sends the report outside this
      // conversation. The owner decides that, recognised by the host.
      const requester = ctx.requester;
      api.logger?.info?.(`ro: plow_start_thread requester known=${Boolean(requester?.senderId)} owner=${Boolean(requester?.senderIsOwner)}`);
      if (requester?.senderId && !requester.senderIsOwner) {
        return { block: true, blockReason: "Only the owner can send results to another number." };
      }
      return;
    });
  },
});
