// Sitemaxxing's tools. The rules that matter are here, in code:
// - ro_check opens public websites only (url-guard), one at a time, capped per
//   hour, and every number it reports was measured by render/check.mjs.
// - ro_check_pages checks up to four more pages of the site just checked (found
//   in its menu by that check, so the same public-site rule holds), under the
//   same one-at-a-time rule, and counts once against the hourly cap.
// - A page checked before is compared with that check (runs.ts finds it), and
//   the results text says what changed, built in code.
// - ro_fix_prompt returns the prompt render/summarize.mjs built from those
//   measurements, word for word; the model doesn't write fixes.
// - Only the owner can send results to another number (plow_start_thread),
//   recognised by the host, not by name.
import { toolAccess } from "./access.ts";
import { randomUUID } from "node:crypto";
import { conversationPaths, latestRun, saveLatest, ownsRun } from "./scope.ts";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { checkableUrl, UrlRefused } from "./url-guard.ts";
import { ownerChatUid, sendFile, sendText } from "./plow-api.ts";
import { earlierRuns } from "./runs.ts";
import { COMMANDS, fixReply, greeting } from "./replies.ts";
import { publishReport, withReportLink } from "./report-link.ts";

const WORKSPACE = process.env.RO_WORKSPACE ?? "/var/lib/plow/workspace";
const CARD = join(WORKSPACE, "ro", "contact.vcf");
const CARD_SENT = join(WORKSPACE, "ro", "contact-card-sent");
const CHECK_SCRIPT = process.env.RO_CHECK_SCRIPT ?? "/opt/ro/render/check.mjs";
const PAGES_SCRIPT = process.env.RO_PAGES_SCRIPT ?? "/opt/ro/render/check-pages.mjs";
const CHECK_TIMEOUT_MS = 4 * 60_000;
const PAGES_TIMEOUT_MS = 12 * 60_000;
const MAX_PER_HOUR = 12;

/** What's running now, and how long to tell the next person to wait. */
let running: { what: string; wait: string } | null = null;
const recent: number[] = [];

type Result = { content: { type: "text"; text: string }[]; details: Record<string, unknown>; isError?: boolean };
const ok = (text: string, details: Record<string, unknown> = {}): Result => ({ content: [{ type: "text", text }], details });
const fail = (text: string): Result => ({ isError: true, content: [{ type: "text", text }], details: {} });

const readSummary = (dir: string) => JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

/** One check at a time, and at most MAX_PER_HOUR an hour: the refusal, or null to go ahead. */
function refusal(host: string): Result | null {
  if (running) return fail(`One check at a time. ${running.what} is running now; send ${host} again in ${running.wait}.`);
  const hourAgo = Date.now() - 3_600_000;
  while (recent.length && recent[0] < hourAgo) recent.shift();
  if (recent.length >= MAX_PER_HOUR) {
    const minutes = Math.max(1, Math.ceil((recent[0] + 3_600_000 - Date.now()) / 60_000));
    return fail(`That's ${MAX_PER_HOUR} checks this hour, which is the limit. Send it again in ${minutes} minute${minutes === 1 ? "" : "s"} and I'll run it.`);
  }
  return null;
}

/** Why a check failed, in words for the person (messages.md, Failures). */
function failureText(host: string, stderr: string, timedOut: boolean): string {
  if (/blocked: bot-check/.test(stderr)) return `${host} is behind a bot check (a "verify you are human" page), so I'm seeing that instead of your site. If you can allow it for a few minutes, send the address again.`;
  if (/blocked: login/.test(stderr)) return `${host} asks for a login before showing anything. Send me a page anyone can see.`;
  if (timedOut || /couldn't load|ERR_|timed out|timeout/i.test(stderr)) return `Couldn't reach ${host}; it didn't load. Send it again when it's up.`;
  return `Couldn't finish checking ${host}. Send it again in a minute.`;
}

/** Why a pages run failed: every page skipped (with the reasons), out of time, or something else. Never a loop back to the same failure. */
function pagesFailureText(host: string, stderr: string, timedOut: boolean): string {
  const none = /^no page loaded: (.+)$/m.exec(stderr);
  if (none) return `None of ${host}'s other pages could be checked: ${none[1]}. Text me any page's address and I'll check that one.`;
  if (timedOut) return `${host}'s other pages took too long to check, so I stopped. Text me one page's address and I'll check that one.`;
  return `Couldn't finish checking ${host}'s other pages. Reply pages to try again in a minute.`;
}

function runScript(script: string, args: string[], timeout: number, explain: (stderr: string, timedOut: boolean) => string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [script, ...args], { timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(explain(stderr ?? "", Boolean(error.killed))));
      else resolve(stdout);
    });
  });
}

/** Send the "On it" line to the conversation that asked, by code. True when it went out. */
async function ackNow(ctx: Record<string, any>, logger: any): Promise<boolean> {
  try {
    if (!ctx.delivery?.send) return false;
    await ctx.delivery.send({ text: "On it. About a minute." });
    return true;
  } catch (error) {
    logger?.warn?.(`ro: ack not sent: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/** The report's page on the site, if the site is configured and answers; never fails the check. */
async function linkFor(summary: Record<string, any>, kind: string, pages: number, logger: any) {
  try {
    const link = await publishReport({ host: hostOf(summary.site), kind, pages, summary: summary.message, pdf: summary.report, fix: summary.fixPrompt });
    if (link) summary.reportUrl = link.url;
    return link;
  } catch (error) {
    logger?.warn?.(`ro: report not published: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** The reply to send, between the lines, then the measured details for follow-up questions. */
function replyText(summary: Record<string, any>, acked = true): string {
  return [
    `Your reply is below, between the lines. Send it exactly as written: the one line of text, then the MEDIA line (the PDF). Nothing else.${acked ? ' (The "On it" line was already sent.)' : ""}`,
    "-----",
    summary.message,
    `MEDIA:${summary.report}`,
    "-----",
    "The measured details, for answering follow-up questions (don't send these):",
    JSON.stringify({ ...summary, message: undefined }, null, 1),
  ].join("\n");
}

export default definePluginEntry({
  id: "ro",
  name: "Sitemaxxing",
  description: "Checks a website on nine screens, for SEO and for AI readability, and builds a fix prompt from what it measured.",
  register(api) {
    api.registerTool((ctx) => {
      const scope = conversationPaths(WORKSPACE, ctx);
      return {
      name: "ro_check", label: "Check a website",
      description: "Open a public web page (the homepage, or the page sent) on 9 screens (small Android to ultrawide), measure layout problems on each, check SEO and how well AI tools can read it, and build the fix prompt. Takes about a minute. Returns the reply to send: the results text, the report card image and the PDF report. Only public websites.",
      parameters: {
        type: "object", required: ["url"], additionalProperties: false,
        properties: { url: { type: "string", description: "The website address as the person sent it, e.g. sbeoc.com or https://sbeoc.com" } },
      },
      async execute(_id: string, args: { url: string }) {
        if (!scope) return fail("Cannot identify this conversation safely. Please start a new conversation and try again.");
        let url: URL;
        try { url = await checkableUrl(args.url); }
        catch (error) { return fail(error instanceof UrlRefused ? error.message : "Couldn't read that address."); }
        const host = url.hostname.replace(/^www\./, "");
        const refused = refusal(host);
        if (refused) return refused;
        // "On it. About a minute." goes out from here, by code, the moment the
        // check starts: the same words every time, and never forgotten.
        running = { what: "A website check", wait: "about a minute" };
        try {
          const acked = await ackNow(ctx, api.logger);
          // Compare only this conversation's earlier checks.
          const earlier = earlierRuns(scope.runs, url.href);
          const previous = earlier[0] ?? null;
          const dir = join(scope.runs, `${stamp()}-${host}-${randomUUID()}`);
          mkdirSync(dir, { recursive: true });
          recent.push(Date.now());
          const summary = JSON.parse(await runScript(CHECK_SCRIPT, [url.href, dir, previous ?? "", String(earlier.length + 1)], CHECK_TIMEOUT_MS, (stderr, timedOut) => failureText(host, stderr, timedOut)));
          saveLatest(scope, dir);
          summary.message = withReportLink(summary.message, await linkFor(summary, "page", 1, api.logger));
          return ok(replyText(summary, acked), { site: summary.site, dir, previous });
        } catch (error) {
          return fail(error instanceof Error ? error.message : `Couldn't finish checking ${host}. Send it again in a minute.`);
        } finally {
          running = null;
        }
      },
      };
    }, { name: "ro_check" });

    api.registerTool((ctx) => {
      const scope = conversationPaths(WORKSPACE, ctx);
      return {
      name: "ro_check_pages", label: "Check the site's other main pages",
      description: "After a check, open up to 4 more pages from that site's menu (found by the check) on the same 9 screens, and build one report card, one PDF and one fix list covering every page. Takes about a minute per page. No arguments: it uses the most recent check. Returns the reply to send.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        if (!scope) return fail("Cannot identify this conversation safely.");
        const latest = latestRun(scope);
        if (!latest) return fail("No check yet. Text me a website address first, and I'll find its pages.");
        const summary = readSummary(latest);
        const firstDir: string = summary.kind === "pages" ? summary.firstRun : latest;
        if (!ownsRun(scope, firstDir)) return fail("That report is unavailable in this conversation. Text me the address again.");
        const host = hostOf(summary.site);
        if (summary.pages === undefined || !existsSync(join(firstDir, "audit.json"))) {
          // A run from before pages existed, or whose files are gone.
          return fail(`That check of ${host} is from before I could find its pages. Text me the address again, then reply pages.`);
        }
        const pages: { path: string }[] = summary.pages;
        if (!pages.length) {
          return fail(`I didn't find other pages in ${host}'s menu, so there's nothing more to check there. Text me any page's address and I'll check that one.`);
        }
        const refused = refusal(host);
        if (refused) return refused;
        const dir = join(scope.runs, `${stamp()}-${host}-pages-${randomUUID()}`);
        mkdirSync(dir, { recursive: true });
        running = { what: "A pages check", wait: "a few minutes" };
        recent.push(Date.now());
        try {
          const result = JSON.parse(await runScript(PAGES_SCRIPT, [firstDir, dir], PAGES_TIMEOUT_MS, (stderr, timedOut) => pagesFailureText(host, stderr, timedOut)));
          saveLatest(scope, dir);
          const n = (result.checked ?? []).filter((p: { skipped?: string }) => !p.skipped).length;
          result.message = withReportLink(result.message, await linkFor(result, "pages", n, api.logger));
          return ok(replyText(result), { site: summary.site, dir, pages: pages.map(p => p.path) });
        } catch (error) {
          return fail(error instanceof Error ? error.message : `Couldn't finish checking ${host}'s other pages.`);
        } finally {
          running = null;
        }
      },
      };
    }, { name: "ro_check_pages" });

    api.registerTool((ctx) => {
      const scope = conversationPaths(WORKSPACE, ctx);
      return {
      name: "ro_fix_prompt", label: "The fix prompt for the owner's coding agent",
      description: "Return the reply that carries the fix prompt for the most recent check, built from its measurements: an intro line, the fix list word for word (never edited or summarized, so the owner can paste it into Claude Code, Codex, Cursor or any coding agent), a closing line, and the list as a file.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        if (!scope) return fail("Cannot identify this conversation safely.");
        const dir = latestRun(scope);
        if (!dir) return fail("Nothing to fix yet. Text me a website address first.");
        const summary = readSummary(dir);
        const file = join(dir, "FIX-PROMPT.md");
        const pages = summary.kind === "pages" ? (summary.checked ?? []).filter((p: { skipped?: string }) => !p.skipped).length : 0;
        return ok([
          "Your reply is below, between the lines. Send it exactly as written: the one line of text, then the MEDIA line (the fix list as a file). Never paste the list into the text.",
          "-----",
          fixReply(hostOf(summary.site), file, pages),
          "-----",
        ].join("\n"), { file });
      },
      };
    }, { name: "ro_fix_prompt" });

    api.registerTool((ctx) => {
      const scope = conversationPaths(WORKSPACE, ctx);
      return {
      name: "ro_greeting", label: "The first-contact greeting",
      description: "The greeting for someone's first message, written ahead of time. Call it on first contact and send what it returns word for word.",
      parameters: { type: "object", additionalProperties: false, properties: { name: { type: "string", description: "The person's first name from the conversation facts, if known" } } },
      async execute(_id: string, args: { name?: string }) { return ok(greeting(args?.name)); },
      };
    }, { name: "ro_greeting" });

    api.registerTool((ctx) => {
      const scope = conversationPaths(WORKSPACE, ctx);
      return {
      name: "ro_commands", label: "What Sitemaxxing can do",
      description: "The list of things the person can text, written ahead of time. Send it word for word when they ask what you can do or text \"commands\".",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() { return ok(COMMANDS); },
      };
    }, { name: "ro_commands" });

    api.registerTool((ctx) => {
      const scope = conversationPaths(WORKSPACE, ctx);
      return {
      name: "ro_status", label: "The latest check",
      description: "The most recent check's results, from its files.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        if (!scope) return fail("Cannot identify this conversation safely.");
        const dir = latestRun(scope);
        return dir ? ok(readFileSync(join(dir, "summary.json"), "utf8")) : ok("No check yet.");
      },
      };
    }, { name: "ro_status" });

    api.registerTool((ctx) => {
      const scope = conversationPaths(WORKSPACE, ctx);
      return {
      name: "ro_contact_card", label: "Send your contact card",
      description: "On first contact with the owner, send your contact card so they can save you with one tap. Sends at most once; calling it again does nothing.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        if (ctx.senderIsOwner !== true) return fail("Only the owner can request the contact card.");
        if (!existsSync(CARD)) return ok("No contact card for this line; nothing sent.");
        try {
          const chat = await ownerChatUid();
          const sent = existsSync(CARD_SENT) ? readFileSync(CARD_SENT, "utf8").split("\n") : [];
          if (sent.includes(chat)) return ok("Contact card already sent; nothing to do.");
          await sendFile(chat, CARD, "text/vcard");
          writeFileSync(CARD_SENT, [...sent, chat].filter(Boolean).join("\n"));
          return ok("Contact card sent. Don't mention it.");
        } catch (error) {
          // Never worth an error in the conversation: the card is a nicety.
          api.logger?.warn?.(`ro: contact card not sent: ${error instanceof Error ? error.message : String(error)}`);
          return ok("Contact card couldn't be sent this time; carry on without mentioning it.");
        }
      },
      };
    }, { name: "ro_contact_card" });

    api.on("before_tool_call", async (event, ctx) => {
      // Enforce at the host hook, not in a prompt: unknown identity gets guest
      // privileges. MEDIA attachments returned by ro tools are not tool calls.
      return toolAccess(event.toolName, ctx.requester);
    });
  },
});
