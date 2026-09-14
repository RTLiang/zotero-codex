#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));
const packageJSON = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));

if (manifest.manifest_version !== 2) throw new Error("manifest_version must be 2");
if (manifest.applications?.zotero?.strict_min_version !== "10.0") {
  throw new Error("This build must target Zotero 10.0 or newer");
}
if (manifest.applications?.zotero?.strict_max_version !== "10.0.*") {
  throw new Error("This build has only been verified against Zotero 10.0.x");
}
if (!manifest.applications?.zotero?.update_url) {
  throw new Error("Zotero 10 requires applications.zotero.update_url");
}
if (packageJSON.version !== manifest.version) {
  throw new Error("package.json and manifest.json versions must match");
}

for (const file of [
  "bootstrap.js",
  "content/protocol.js",
  "content/codex-client.js",
  "content/markdown.js",
  "content/sidebar.js",
  "content/main.js",
]) {
  const result = spawnSync(process.execPath, ["--check", resolve(projectRoot, file)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

const localeFiles = [
  "locale/en-US/zotero-codex.ftl",
  "locale/zh-CN/zotero-codex.ftl",
];
const localeKeySets = localeFiles.map((file) => {
  const source = readFileSync(resolve(projectRoot, file), "utf8");
  const keys = [...source.matchAll(/^([a-z][a-z0-9-]*)\s*=/gmu)].map((match) => match[1]);
  if (keys.length !== new Set(keys).size) throw new Error(`${file} contains duplicate Fluent IDs`);
  return new Set(keys);
});

const referenceSource = [
  "content/protocol.js",
  "content/codex-client.js",
  "content/markdown.js",
  "content/sidebar.js",
].map((file) => readFileSync(resolve(projectRoot, file), "utf8")).join("\n");
const referencedKeys = new Set(
  [...referenceSource.matchAll(/["'](zotero-codex-[a-z0-9-]+)["']/gu)]
    .map((match) => match[1])
    .filter((key) => key !== "zotero-codex-sidebar"),
);

for (const key of referencedKeys) {
  for (let index = 0; index < localeKeySets.length; index++) {
    if (!localeKeySets[index].has(key)) throw new Error(`${localeFiles[index]} is missing ${key}`);
  }
}
for (const key of localeKeySets[0]) {
  if (!localeKeySets[1].has(key)) throw new Error(`${localeFiles[1]} is missing ${key}`);
}
for (const key of localeKeySets[1]) {
  if (!localeKeySets[0].has(key)) throw new Error(`${localeFiles[0]} is missing ${key}`);
}

console.log("Static checks passed");
