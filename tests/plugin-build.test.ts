import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("production image builder emits all plugin modules and valid JavaScript", () => {
  const dir = mkdtempSync(join(tmpdir(), "ro-build-"));
  try {
    const normalized = dir.replaceAll("\\", "/");
    mkdirSync(join(dir, "plow", "boot"), { recursive: true });
    mkdirSync(join(dir, "ro", "plugins"), { recursive: true });
    cpSync(resolve("boot"), join(dir, "plow", "boot"), { recursive: true });
    cpSync(resolve("plugins", "ro"), join(dir, "ro", "plugins", "ro"), { recursive: true });
    mkdirSync(join(dir, "ro", "render"), { recursive: true });
    cpSync(resolve("render", "guard.mjs"), join(dir, "ro", "render", "guard.mjs"));
    const build = readFileSync("build-ro.ts", "utf8").replaceAll("/opt/plow", `${normalized}/plow`).replaceAll("/opt/ro", `${normalized}/ro`);
    writeFileSync(join(dir, "build.ts"), build);
    execFileSync(process.execPath, [join(dir, "build.ts")], { stdio: "pipe" });
    const dist = join(dir, "ro", "plugins", "ro", "dist");
    for (const expected of ["index.js", "scope.js", "access.js"]) assert.ok(existsSync(join(dist, expected)), expected);
    for (const name of readdirSync(dist).filter(n => n.endsWith(".js"))) {
      const file = join(dist, name);
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
      for (const match of readFileSync(file, "utf8").matchAll(/from "(\.\/[^"\n]+)"/g)) {
        assert.ok(existsSync(resolve(dist, match[1])), `${name} missing ${match[1]}`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
