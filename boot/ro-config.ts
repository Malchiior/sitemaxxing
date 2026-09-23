import type { renderConfig } from "./config.ts";

type Config = ReturnType<typeof renderConfig>;

/** Resolution Optimizer's tools (plugins/ro). */
export const RO_TOOLS = ["ro_check", "ro_fix_prompt", "ro_status"];
export const RO_PLUGIN_PATH = "/opt/ro/plugins/ro";
/**
 * OpenClaw's default output cap for a model with no maxTokens is 8,192, which
 * truncates long replies mid tool call ("incomplete or malformed tool call").
 * Both models Plow serves allow far more (GLM 5.2: 131k, Sonnet 5: 128k).
 */
export const MAX_OUTPUT_TOKENS = 32_768;

/** Plow's rendered config plus our tools and a real output cap. Everything Plow set is kept. */
export function withRo(config: Config) {
  const plow = config.models.providers.plow;
  return {
    ...config,
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
