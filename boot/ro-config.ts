import type { renderConfig } from "./config.ts";

type Config = ReturnType<typeof renderConfig>;

/** Sitemaxxing's tools (plugins/ro). */
export const RO_TOOLS = ["ro_check", "ro_fix_prompt", "ro_status"];
export const RO_PLUGIN_PATH = "/opt/ro/plugins/ro";
/**
 * OpenClaw's default output cap for a model with no maxTokens is 8,192, which
 * truncates long replies mid tool call ("incomplete or malformed tool call").
 * Both models Plow serves allow far more (GLM 5.2: 131k, Sonnet 5: 128k).
 */
export const MAX_OUTPUT_TOKENS = 32_768;

/** Plow names a locally minted agent this; a real install is named from the listing. */
export const GENERIC_NAME = "plow-agent";
export const PRODUCT_NAME = "Sitemaxxing";

/**
 * Plow's rendered config plus our tools, a real output cap, and block
 * streaming: each finished block of text goes out as it's written, so "Fit
 * check for sbeoc.com... About a minute." reaches the person before the check
 * runs instead of arriving with the results. Everything Plow set is kept.
 */
export function withRo(config: Config) {
  const plow = config.models.providers.plow;
  const main = config.agents.entries.main;
  const name = main.identity.name === GENERIC_NAME ? PRODUCT_NAME : main.identity.name;
  return {
    ...config,
    agents: {
      ...config.agents,
      entries: { ...config.agents.entries, main: { ...main, identity: { ...main.identity, name } } },
      defaults: { ...config.agents.defaults, blockStreamingDefault: "on", blockStreamingBreak: "text_end" },
    },
    models: { ...config.models, providers: { ...config.models.providers, plow: {
      ...plow, models: plow.models.map(model => ({ ...model, maxTokens: MAX_OUTPUT_TOKENS })),
    } } },
    plugins: {
      ...config.plugins,
      load: { ...config.plugins.load, paths: [...config.plugins.load.paths, RO_PLUGIN_PATH] },
      entries: { ...config.plugins.entries, ro: { enabled: true } },
    },
    tools: { ...config.tools, alsoAllow: [...new Set([...config.tools.alsoAllow, ...RO_TOOLS, "cron"])] },
  };
}
