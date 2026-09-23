// A minimal Chrome DevTools Protocol client over headless Chromium. No npm
// dependencies: Node's built-in WebSocket and fetch.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "ro-chrome-"));
  const chrome = spawn("chromium", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars",
    "--mute-audio", "--no-first-run", "--disable-extensions", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const wsUrl = await new Promise((ok, fail) => {
    let buf = "";
    const timer = setTimeout(() => fail(new Error("Chromium did not start within 15s")), 15_000);
    chrome.on("error", fail);
    chrome.stderr.on("data", chunk => {
      buf += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (match) { clearTimeout(timer); ok(match[1]); }
    });
  });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok, { once: true }); ws.addEventListener("error", fail, { once: true }); });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(`${msg.error.message}`)) : ok(msg.result);
    } else if (msg.method) for (const fn of listeners) fn(msg);
  });

  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = nextId++;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const waitFor = (method, ms) => new Promise(ok => {
    const timer = setTimeout(() => { listeners.delete(fn); ok(null); }, ms);
    const fn = msg => { if (msg.method === method) { clearTimeout(timer); listeners.delete(fn); ok(msg.params); } };
    listeners.add(fn);
  });
  /** Evaluate an expression in the page and return its value (awaits promises). */
  const evaluate = async expression => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(`page script failed: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  };
  const close = () => {
    try { ws.close(); } catch { /* already closed */ }
    chrome.kill("SIGKILL");
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
  };
  return { send, waitFor, evaluate, close };
}
