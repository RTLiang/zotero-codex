#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const tsc = resolve(projectRoot, "node_modules/typescript/bin/tsc");

if (!existsSync(tsc)) {
  process.stderr.write("TypeScript is missing. Run npm ci, then retry.\n");
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsc, "-p", resolve(projectRoot, "tsconfig.json")], {
  cwd: projectRoot,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
