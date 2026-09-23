import { mkdir, readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

// Same build as Plow's build.ts: strip types and point relative imports at the
// .js siblings. Boot files land beside Plow's in /opt/plow/boot; the plugin
// builds into its own dist/.
const strip = (source: string) => stripTypeScriptTypes(source.replaceAll(/(from "\.\/[^"\n]+)\.ts"/g, '$1.js"'));

for (const name of ["ro-config", "ro-card", "ro-main", "ro-probe"]) {
  await writeFile(`/opt/plow/boot/${name}.js`, strip(await readFile(`/opt/plow/boot/${name}.ts`, "utf8")));
}
await writeFile("/opt/plow/ro-probe", '#!/usr/bin/env node\nimport "./boot/ro-probe.js";\n', { mode: 0o755 });

await mkdir("/opt/ro/plugins/ro/dist", { recursive: true });
for (const name of ["index", "url-guard", "plow-api", "runs", "replies"]) {
  await writeFile(`/opt/ro/plugins/ro/dist/${name}.js`, strip(await readFile(`/opt/ro/plugins/ro/${name}.ts`, "utf8")));
}
