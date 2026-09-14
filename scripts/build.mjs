#!/usr/bin/env node

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "manifest.json"), "utf8"));
const outputDirectory = resolve(projectRoot, "dist");
const output = resolve(outputDirectory, `zotero-codex-sidebar-${manifest.version}.xpi`);

mkdirSync(outputDirectory, { recursive: true });
rmSync(output, { force: true });

const zip = spawnSync(
  "zip",
  [
    "-r",
    "-X",
    output,
    "manifest.json",
    "bootstrap.js",
    "prefs.js",
    "content",
    "locale",
    "LICENSE",
  ],
  { cwd: projectRoot, encoding: "utf8" },
);

if (zip.status !== 0) {
  process.stderr.write(zip.stderr || zip.stdout);
  process.exit(zip.status || 1);
}

console.log(output);
