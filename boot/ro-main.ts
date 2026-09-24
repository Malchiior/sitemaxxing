import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { renderConfig } from "./config.ts";
import { identityFromApi } from "./identity.ts";
import { renderPrompt } from "./prompt.ts";
import { startGateway } from "./process.ts";
import { PRODUCT_NAME, withRo } from "./ro-config.ts";
import { contactCard } from "./ro-card.ts";

// Plow's boot sequence (boot/main.ts in plow-openclaw-agent), reusing its
// modules, with three additions: our tools and output cap in the config, our prompt
// after Plow's base prompt, and the Agent Index reporter beside the gateway.

// Only what the reporter uses. The gateway and MCP bridge tokens stay out.
const REPORTER_ENV = ["PATH", "LANG", "TZ", "PLOW_API_BASE", "PLOW_AGENT_TOKEN", "OPENCLAW_STATE_DIR",
  "AGENT_ID", "AGENT_NAME", "AGENT_BLURB", "AGENT_REPO", "AGENT_RUNTIME"];

function startReporter() {
  let stopping = false;
  const env = Object.fromEntries(REPORTER_ENV.filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const launch = () => {
    const child = spawn("/bin/sh", ["/opt/ro/reporter/run.sh"], { stdio: ["ignore", "inherit", "inherit"], env });
    child.on("error", error => console.error(`ro-boot: reporter failed to start: ${error.message}`));
    child.on("close", (code, signal) => {
      if (stopping) return;
      // The loop never exits on its own; if it died, usage stops counting.
      console.error(`ro-boot: reporter exited code=${code} signal=${signal}; restarting in 60s`);
      setTimeout(launch, 60_000).unref();
    });
    const stop = () => { stopping = true; child.kill("SIGTERM"); };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  };
  launch();
}

// Baked-in settings for the hosted report page (see Dockerfile). Environment
// set on the container wins.
try {
  for (const line of (await readFile("/opt/ro/.env.report", "utf8")).split("\n")) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch { /* not baked in: texts go out without the report link */ }

try {
  const base = process.env.PLOW_API_BASE?.replace(/\/$/, "");
  if (!base) throw new Error("PLOW_API_BASE is required");
  process.env.PLOW_AGENT_TOKEN ||= "proxied";
  process.env.OPENCLAW_GATEWAY_TOKEN = randomBytes(32).toString("hex");
  process.env.PLOW_MCP_BRIDGE_TOKEN = randomBytes(32).toString("hex");
  const identity = await identityFromApi(base, process.env.PLOW_AGENT_TOKEN);
  const config = withRo(renderConfig(identity, base));
  await mkdir("/var/lib/plow/workspace", { recursive: true });
  for (const name of ["BOOTSTRAP.md", "SOUL.md", "IDENTITY.md", "USER.md"]) {
    await rm(`/var/lib/plow/workspace/${name}`, { force: true });
  }
  const prompt = [
    await readFile("/opt/plow/prompt/AGENTS.md", "utf8"),
    await readFile("/opt/plow/prompt/RO.md", "utf8"),
  ].join("\n");
  await writeFile("/var/lib/plow/workspace/AGENTS.md", await renderPrompt(prompt, identity.mcp_url, process.env.PLOW_AGENT_TOKEN));
  await writeFile("/var/lib/plow/openclaw.json", JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  // This line's own contact card, attached to the first reply (prompt/RO.md).
  const photo = await readFile("/opt/ro/assets/contact-photo.jpg").catch(() => undefined);
  // The card is the product, not the line: a one-click install names the agent after its line ("Alder").
  const card = contactCard(PRODUCT_NAME, (identity.line as { provider_key?: string }).provider_key, photo);
  await mkdir("/var/lib/plow/workspace/ro", { recursive: true });
  if (card) await writeFile("/var/lib/plow/workspace/ro/contact.vcf", card);
  else await rm("/var/lib/plow/workspace/ro/contact.vcf", { force: true });
  console.log(`ro-boot: identity resolved to ${identity.line.uid}`);
  startReporter();
  await startGateway(false, identity.mcp_url ?? undefined);
} catch (error) {
  console.error(`ro-boot: parked: ${error instanceof Error ? error.message : String(error)}`);
  setInterval(() => {}, 2 ** 30);
}
