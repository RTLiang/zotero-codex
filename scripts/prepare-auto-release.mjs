#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const packagePath = resolve(projectRoot, "package.json");
const manifestPath = resolve(projectRoot, "manifest.json");
const packageJSON = JSON.parse(readFileSync(packagePath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function parseVersion(value) {
  const match = String(value).match(/^v?(\d{4})\.(\d{1,3})\.(\d+)$/u);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

const latest = execFileSync("git", ["tag", "--list", "v*"], { encoding: "utf8" })
  .split(/\r?\n/u)
  .map(parseVersion)
  .filter(Boolean)
  .concat([parseVersion(packageJSON.version)].filter(Boolean))
  .sort(compareVersions)
  .at(-1);

const now = new Date();
const year = now.getUTCFullYear();
const day = Math.floor((Date.UTC(year, now.getUTCMonth(), now.getUTCDate()) - Date.UTC(year, 0, 0)) / 86400000);
const currentDay = [year, day];
const latestDay = latest ? latest.slice(0, 2) : [0, 0];
const dayComparison = currentDay[0] - latestDay[0] || currentDay[1] - latestDay[1];
const version = dayComparison > 0
  ? `${year}.${day}.1`
  : `${latest[0]}.${latest[1]}.${latest[2] + 1}`;

packageJSON.version = version;
manifest.version = version;
writeFileSync(packagePath, `${JSON.stringify(packageJSON, null, 2)}\n`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(version);
