const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("release versions follow origin tags despite higher local versions and unpushed tags", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zotero-release-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, "origin.git");
  const checkout = path.join(root, "checkout");
  const git = (...args) => execFileSync("git", args, { cwd: checkout, encoding: "utf8", stdio: "pipe" });
  fs.mkdirSync(checkout);
  execFileSync("git", ["init", "--bare", remote], { stdio: "pipe" });
  git("init", "--initial-branch=main");
  git("remote", "add", "origin", remote);
  fs.mkdirSync(path.join(checkout, "scripts"));
  fs.copyFileSync(path.join(__dirname, "../scripts/prepare-auto-release.mjs"),
    path.join(checkout, "scripts/prepare-auto-release.mjs"));
  const setLocalVersion = () => {
    for (const file of ["package.json", "manifest.json"]) {
      fs.writeFileSync(path.join(checkout, file), JSON.stringify({ version: "9999.365.99" }));
    }
  };
  const run = () => execFileSync(process.execPath, ["scripts/prepare-auto-release.mjs"], {
    cwd: checkout, encoding: "utf8",
  }).trim();
  const now = new Date();
  const year = now.getUTCFullYear();
  const day = Math.floor((Date.UTC(year, now.getUTCMonth(), now.getUTCDate()) - Date.UTC(year, 0, 0)) / 86400000);
  const prefix = `${year}.${day}`;

  setLocalVersion();
  assert.equal(run(), `${prefix}.1`);

  git("-c", "user.name=Verification", "-c", "user.email=verification@example.invalid",
    "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${root}`, "commit", "--allow-empty", "-m", "Fixture");
  git("tag", `v${prefix}.7`);
  git("push", "origin", `refs/tags/v${prefix}.7`);
  git("tag", "v9999.365.99");
  setLocalVersion();
  assert.equal(run(), `${prefix}.8`);
  for (const file of ["package.json", "manifest.json"]) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(checkout, file), "utf8")).version, `${prefix}.8`);
  }
});
