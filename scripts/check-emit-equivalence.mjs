#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const projectRoot = resolve(import.meta.dirname, "..");
const migrationBase = "308f16024329ead4912bdcdcb18f492c05eafd28";
const reference = process.argv[2] || migrationBase;

function canonical(name, text) {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(file);
}

function baseline(name) {
  const result = spawnSync("git", ["show", `${reference}:content/${name}.js`], { cwd: projectRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`No content/${name}.js at ${reference}`);
  return result.stdout;
}

function emittedPath(name) {
  const path = resolve(projectRoot, "content", `${name}.js`);
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(`content/${name}.js is missing. Run npm run compile first.`);
  }
}

const sources = readdirSync(resolve(projectRoot, "src"))
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
  .map((file) => file.slice(0, -3))
  .sort();

let failures = 0;
for (const name of sources) {
  const before = canonical(name, baseline(name));
  const after = canonical(name, emittedPath(name));
  if (before === after) {
    console.log(`${name}: emitted JavaScript matches ${reference.slice(0, 7)}`);
    continue;
  }
  failures++;
  console.log(`${name}: emitted JavaScript differs from ${reference.slice(0, 7)}`);
  const index = [...before].findIndex((token, position) => token !== after[position]);
  console.log(`  first difference at ${index}`);
  console.log(`  before: ${before.slice(Math.max(0, index - 60), index + 60)}`);
  console.log(`  after:  ${after.slice(Math.max(0, index - 60), index + 60)}`);
}

if (failures > 0) {
  process.stderr.write(`${failures} of ${sources.length} migrated files changed the shipped JavaScript\n`);
  process.exit(1);
}
console.log(`${sources.length} migrated files emit the same JavaScript tokens as the reference build`);
