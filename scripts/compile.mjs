#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const tsc = resolve(projectRoot, "node_modules/typescript/bin/tsc");
const contentRoot = resolve(projectRoot, "content");
const sourceRoot = resolve(projectRoot, "src");

if (!existsSync(tsc)) {
  process.stderr.write("TypeScript is missing. Run npm ci, then retry.\n");
  process.exit(1);
}

function pruneStaleOutput() {
  const tracked = spawnSync("git", ["ls-files", "content"], { cwd: projectRoot, encoding: "utf8" });
  if (tracked.status !== 0) {
    process.stderr.write("Cannot list tracked content files; leaving build output as is.\n");
    return;
  }
  const trackedNames = new Set(tracked.stdout.split("\n").filter(Boolean).map((file) => file.replace(/^content\//u, "")));
  for (const name of readdirSync(contentRoot)) {
    if (!name.endsWith(".js") || trackedNames.has(name)) continue;
    const source = resolve(sourceRoot, `${name.slice(0, -3)}.ts`);
    if (existsSync(source)) continue;
    rmSync(resolve(contentRoot, name));
    console.log(`Removed stale build output content/${name}`);
  }
}

pruneStaleOutput();

const result = spawnSync(process.execPath, [tsc, "-p", resolve(projectRoot, "tsconfig.json")], {
  cwd: projectRoot,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
