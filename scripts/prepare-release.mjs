#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [version, repository, tag, xpiPath] = process.argv.slice(2);
if (!version || !repository || !tag || !xpiPath) {
  throw new Error(
    "Usage: prepare-release.mjs <version> <owner/repository> <tag> <xpi-path>",
  );
}
if (tag !== `v${version}`) throw new Error(`Tag ${tag} does not match version ${version}`);
if (!/^[^/\s]+\/[^/\s]+$/u.test(repository)) {
  throw new Error("Repository must use the owner/name form");
}

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));
const packageJSON = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
if (manifest.version !== version || packageJSON.version !== version) {
  throw new Error("Tag, manifest.json, and package.json versions must match");
}

const xpi = readFileSync(resolve(projectRoot, xpiPath));
const digest = createHash("sha256").update(xpi).digest("hex");
const updatesPath = resolve(projectRoot, "updates.json");
const updates = JSON.parse(readFileSync(updatesPath, "utf8"));
const entries = updates.addons?.[manifest.applications.zotero.id]?.updates;
if (!Array.isArray(entries) || !entries.length) {
  throw new Error("updates.json does not contain the Zotero add-on entry");
}

entries[0] = {
  ...entries[0],
  version,
  update_link: `https://github.com/${repository}/releases/download/${tag}/zotero-codex-sidebar-${version}.xpi`,
  update_hash: `sha256:${digest}`,
};
writeFileSync(updatesPath, `${JSON.stringify(updates, null, 2)}\n`);

console.log(`Prepared Zotero update manifest for ${version}`);
console.log(`SHA-256: ${digest}`);
