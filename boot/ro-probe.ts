import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { probeIdentity } from "./probe-fixture.ts";
import { renderConfig } from "./config.ts";
import { startGateway } from "./process.ts";
import { withRo, RO_TOOLS } from "./ro-config.ts";

// Offline boot check for this image, run with no network:
// 1. Chromium renders the bundled fixture page on all nine screens, and the
//    screenshots aren't blank. A broken browser fails here, not in a demo.
// 2. The gateway boots with our config: Plow's channel registers, our plugin
//    loads, and the gateway reports ready.

const audit = await new Promise<string>((resolve, reject) => {
  execFile(process.execPath, ["/opt/ro/render/audit.mjs", "file:///opt/ro/render/fixture.html", "/tmp/ro-probe"],
    { timeout: 120_000 }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout));
});
const report = JSON.parse(await readFile("/tmp/ro-probe/audit.json", "utf8"));
if (report.screens.length !== 9) throw new Error(`expected 9 screens, rendered ${report.screens.length}`);
for (const screen of report.screens) {
  const png = await readFile(screen.file);
  if (png.length < 2_000 || screen.measurements.text.chars < 20) throw new Error(`${screen.label} rendered blank`);
}
console.log(`ro-probe: rendered 9 screens\n${audit.trim()}`);

process.env.PLOW_AGENT_TOKEN = "probe-" + randomBytes(16).toString("hex");
process.env.OPENCLAW_GATEWAY_TOKEN = randomBytes(32).toString("hex");
const config = withRo(renderConfig(probeIdentity, "http://127.0.0.1:1"));
const missing = RO_TOOLS.filter(tool => !config.tools.alsoAllow.includes(tool));
if (missing.length) throw new Error(`tools missing from config: ${missing.join(", ")}`);
const serialized = JSON.stringify(config, null, 2);
if ([process.env.PLOW_AGENT_TOKEN, process.env.OPENCLAW_GATEWAY_TOKEN].some(token => serialized.includes(token))) {
  throw new Error("Token leaked into rendered config");
}
await mkdir("/var/lib/plow/workspace", { recursive: true });
await writeFile("/var/lib/plow/openclaw.json", serialized + "\n", { mode: 0o600 });

const child = await startGateway(true);
let log = "";
let passed = false;
const timeout = setTimeout(() => {
  console.error("ro-probe: gateway readiness timed out");
  process.kill(process.pid, "SIGTERM");
}, 60_000);
const observe = (chunk: Buffer) => {
  log += chunk.toString();
  const pluginLoaded = /http server listening \(\d+ plugins: [^)]*\bro\b/.test(log);
  if (!passed && log.includes("plow channel registered") && log.includes("[gateway] ready") && pluginLoaded) {
    passed = true;
    clearTimeout(timeout);
    console.log("RO_PROBE_OK");
    process.kill(process.pid, "SIGTERM");
  }
};
child.stdout!.on("data", chunk => { process.stdout.write(chunk); observe(chunk); });
child.stderr!.on("data", chunk => { process.stderr.write(chunk); observe(chunk); });
child.on("exit", code => {
  clearTimeout(timeout);
  if (!passed || code !== 0) process.exitCode = 1;
});
