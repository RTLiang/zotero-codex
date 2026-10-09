#!/usr/bin/env node
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../../../..");
const argv = process.argv.slice(2);
const command = argv.shift();
function option(name, fallback = "") {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  argv.splice(i, 2);
  return value;
}
const run = path.resolve(option("--run", path.join(root, "output/verification/current")));
const windowKind = option("--window", "main");
const scratch = path.join(run, "scratch");
const statePath = path.join(run, "instance.json");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
function state() {
  const value = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(value.run, run);
  assert.equal(value.profile, path.join(scratch, "profile"));
  return value;
}
function record(action, result) {
  fs.appendFileSync(path.join(run, "actions.jsonl"), `${JSON.stringify({ time: new Date().toISOString(), action, result })}\n`);
}
function fingerprint() {
  const hash = crypto.createHash("sha256");
  function visit(relative) {
    const filename = path.join(root, relative);
    if (fs.statSync(filename).isDirectory()) {
      for (const entry of fs.readdirSync(filename).sort()) visit(path.join(relative, entry));
    } else hash.update(relative).update(fs.readFileSync(filename));
  }
  for (const entry of ["_locales", "manifest.json", "bootstrap.js", "prefs.js", "content", "locale", "LICENSE"]) visit(entry);
  return hash.digest("hex");
}

class Marionette {
  queue = [];
  waiting = [];
  buffer = Buffer.alloc(0);
  id = 0;
  constructor(port) {
    this.socket = net.connect(port, "127.0.0.1");
    this.socket.on("error", error => this.fail(error));
    this.socket.on("close", () => this.fail(new Error("Marionette connection closed")));
    this.socket.on("data", chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (true) {
        const colon = this.buffer.indexOf(":");
        if (colon < 0) return;
        const size = Number(this.buffer.subarray(0, colon).toString());
        if (!Number.isSafeInteger(size) || size < 0) return this.fail(new Error("Invalid Marionette frame"));
        if (this.buffer.length < colon + size + 1) return;
        const packet = JSON.parse(this.buffer.subarray(colon + 1, colon + size + 1));
        this.buffer = this.buffer.subarray(colon + size + 1);
        if (this.waiting.length) this.waiting.shift().resolve(packet);
        else this.queue.push(packet);
      }
    });
  }
  fail(error) { this.error = error; for (const pending of this.waiting.splice(0)) pending.reject(error); }
  next() {
    if (this.error) return Promise.reject(this.error);
    if (this.queue.length) return Promise.resolve(this.queue.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.socket.destroy(); reject(new Error("Marionette timed out after 30 seconds")); }, 30000);
      this.waiting.push({ resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    });
  }
  async call(name, parameters = {}) {
    const id = ++this.id;
    const body = Buffer.from(JSON.stringify([0, id, name, parameters]));
    this.socket.write(Buffer.concat([Buffer.from(`${body.length}:`), body]));
    const packet = await this.next();
    assert.equal(packet[1], id);
    if (packet[2]) throw new Error(`${name}: ${JSON.stringify(packet[2])}`);
    return packet[3];
  }
  async evaluate(script, args = [], async = false) {
    const response = await this.call(async ? "WebDriver:ExecuteAsyncScript" : "WebDriver:ExecuteScript", { script, args });
    return response.value;
  }
  async close() {
    try { if (!this.error) await this.call("WebDriver:DeleteSession"); }
    finally { this.socket.destroy(); }
  }
}

async function connect() {
  const s = state();
  assert.equal(s.cleaned, undefined, "Instance has already been cleaned");
  const port = Number(fs.readFileSync(path.join(s.profile, "MarionetteActivePort"), "utf8"));
  assert.ok(port > 0 && port < 65536);
  const client = new Marionette(port);
  try {
    const greeting = await client.next();
    assert.equal(greeting.marionetteProtocol, 3);
    // Zotero has no navigator:browser window. Windowless session creation skips
    // Firefox's startup wait; we then select the actual Zotero chrome window.
    const session = await client.call("WebDriver:NewSession", { "moz:windowless": true });
    assert.equal(session.capabilities["moz:processID"], s.pid);
    assert.equal(session.capabilities["moz:profile"], s.profile);
    await client.call("Marionette:SetContext", { value: "chrome" });
    const handles = await client.call("WebDriver:GetWindowHandles");
    const windows = [];
    for (const handle of handles) {
      await client.call("WebDriver:SwitchToWindow", { handle, focus: false });
      const url = await client.evaluate("return location.href;");
      windows.push({ handle, url });
    }
    const target = windows.find(w => windowKind === "preferences" ? /preferences\/preferences\.xhtml/.test(w.url) : /zoteroPane\.xhtml$/.test(w.url));
    assert.ok(target, `No ${windowKind} window: ${JSON.stringify(windows)}`);
    await client.call("WebDriver:SwitchToWindow", { handle: target.handle, focus: true });
    client.windows = windows;
    return client;
  } catch (error) { await client.close().catch(() => {}); throw error; }
}

async function doctor(client) {
  const s = state();
  const result = await client.evaluate(`
    const z = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs").Zotero;
    return {version: z.version, profile: z.Profile.dir, data: z.DataDirectory.dir,
      plugin: !!z.CodexSidebar, settings: z.CodexSidebar?.settings.read(),
      connected: z.CodexSidebar?.connected, binary: z.CodexSidebar?.binaryPath,
      url: location.href};
  `);
  assert.equal(result.profile, s.profile);
  assert.equal(result.data, path.join(scratch, "data"));
  assert.equal(result.settings?.codexHome, path.join(scratch, "runtime"));
  assert.equal(result.settings?.workingDirectory, path.join(scratch, "workspace"));
  assert.equal(result.plugin, true, "Plugin did not initialize");
  assert.match(result.version, /^10\.0\./);
  const installed = JSON.parse(fs.readFileSync(path.join(s.profile, "extensions.json"), "utf8")).addons.find(a => a.id === "codex-sidebar@zotero.local");
  assert.equal(installed?.version, s.version);
  assert.equal(installed?.active, true);
  assert.equal(fingerprint(), s.sourceHash, "Packaged source changed; cleanup and launch a new instance");
  result.build = { version: installed.version, sourceHash: s.sourceHash, xpiHash: s.xpiHash };
  return result;
}

async function launch() {
  assert.ok(!fs.existsSync(statePath), `Run already exists: ${run}. Use a fresh --run directory.`);
  fs.mkdirSync(run, { recursive: true, mode: 0o700 });
  const binary = process.env.ZOTERO_BIN || "/Applications/Zotero.app/Contents/MacOS/zotero";
  assert.ok(fs.existsSync(binary), `Set ZOTERO_BIN to Zotero 10's executable: ${binary}`);
  assert.equal(process.platform, "darwin", "This native Marionette recipe is verified on macOS only");
  const sourceHash = fingerprint();
  for (const name of ["check", "build"]) {
    const result = spawnSync("npm", ["run", name], { cwd: root, encoding: "utf8" });
    fs.writeFileSync(path.join(run, `${name}.log`), (result.stdout || "") + (result.stderr || ""));
    assert.equal(result.status, 0, `${name} failed; see ${run}/${name}.log`);
  }
  assert.equal(fingerprint(), sourceHash, "Source changed during packaging; retry with a fresh run");
  for (const dir of ["profile/extensions", "data", "runtime", "workspace"]) fs.mkdirSync(path.join(scratch, dir), { recursive: true, mode: 0o700 });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const xpi = path.join(root, "dist", `zotero-codex-sidebar-${manifest.version}.xpi`);
  fs.copyFileSync(xpi, path.join(scratch, "profile/extensions/codex-sidebar@zotero.local.xpi"));
  const codex = process.env.VERIFY_CODEX_BIN || spawnSync("which", ["codex"], { encoding: "utf8" }).stdout?.trim() || "";
  const prefs = {
    "marionette.port": 0, "extensions.autoDisableScopes": 0, "extensions.enabledScopes": 15,
    "extensions.zotero.useDataDir": true, "extensions.zotero.dataDir": path.join(scratch, "data"),
    "extensions.zotero.firstRun2": false, "extensions.zotero.firstRunGuidance": false,
    "extensions.zotero.automaticScraperUpdates": false, "extensions.zotero.sync.autoSync": false,
    "extensions.zotero.httpServer.enabled": false, "app.update.auto": false, "extensions.update.enabled": false,
    "extensions.zotero.codexSidebar.codexPath": codex,
    "extensions.zotero.codexSidebar.codexHome": path.join(scratch, "runtime"),
    "extensions.zotero.codexSidebar.workingDirectory": path.join(scratch, "workspace"),
    "intl.locale.requested": "en-US",
  };
  const profile = path.join(scratch, "profile");
  fs.writeFileSync(path.join(profile, "user.js"), Object.entries(prefs).map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join("\n"));
  const log = fs.openSync(path.join(run, "zotero.log"), "a");
  const args = ["--new-instance", "--profile", profile, "--marionette", "--remote-allow-system-access", "-ZoteroDebugText"];
  const child = spawn(binary, args, { detached: true, stdio: ["ignore", log, log] });
  child.on("error", error => record("launch-error", error.message));
  child.unref(); fs.closeSync(log);
  assert.ok(child.pid, "Zotero did not start");
  json(statePath, { run, profile, pid: child.pid, binary, args, version: manifest.version,
    sourceHash, xpiHash: crypto.createHash("sha256").update(fs.readFileSync(xpi)).digest("hex"), started: new Date().toISOString() });
  record("launch", { pid: child.pid, binary, args });
  try {
    for (let i = 0; i < 60; i++) {
      if (fs.existsSync(path.join(profile, "MarionetteActivePort")) && fs.existsSync(path.join(profile, "extensions.json"))) {
        const c = await connect();
        try {
          const result = await doctor(c);
          json(path.join(run, "doctor.json"), result);
          console.log(JSON.stringify({ run, pid: child.pid, ready: true, doctor: result }, null, 2));
          return;
        } catch (error) { if (i === 59) throw error; }
        finally { await c.close(); }
      }
      await delay(500);
    }
    throw new Error("Zotero did not become ready; inspect zotero.log");
  } catch (error) { await cleanup(); throw error; }
}

const elementScript = `
  const e = document.querySelector(arguments[0]);
  if (!e) throw new Error("Missing selector: " + arguments[0]);
  if (!e.getClientRects().length || e.closest('[hidden]')) throw new Error("Hidden element: " + arguments[0]);
  if (e.disabled) throw new Error("Disabled element: " + arguments[0]);
`;
async function drive(client, action, selector, value = "") {
  const scripts = {
    click: `${elementScript} e.scrollIntoView({block:'nearest'}); return true;`,
    fill: `${elementScript} e.focus(); e.value = arguments[1]; e.dispatchEvent(new Event('input', {bubbles:true})); return e.value;`,
    select: `${elementScript} if (![...e.options].some(o=>o.value===arguments[1])) throw new Error('Unknown option'); e.value=arguments[1]; e.dispatchEvent(new Event('change',{bubbles:true})); return e.value;`,
    key: `${elementScript} e.focus(); e.dispatchEvent(new KeyboardEvent('keydown',{key:arguments[1],bubbles:true,cancelable:true})); return true;`,
    check: `${elementScript} if(e.checked !== (arguments[1]==='true')) e.click(); return e.checked;`,
  };
  assert.ok(scripts[action], `Unknown action ${action}`);
  record("action", { action, selector, value });
  let result = await client.evaluate(scripts[action], [selector, value]);
  if (action === "click") {
    const element = await client.call("WebDriver:FindElement", { using: "css selector", value: selector });
    const id = element.value["element-6066-11e4-a52e-4f735466cecf"];
    assert.ok(id, "Marionette did not return an element reference");
    await client.call("WebDriver:PerformActions", { actions: [{ type: "pointer", id: "verification-mouse",
      parameters: { pointerType: "mouse" }, actions: [
        { type: "pointerMove", origin: element.value, x: 0, y: 0, duration: 0 },
        { type: "pointerDown", button: 0 }, { type: "pointerUp", button: 0 },
      ] }] });
    await client.call("WebDriver:ReleaseActions");
    result = true;
  }
  await delay(250);
  record("result", { action, selector, result });
  return result;
}

async function snapshot(client, label) {
  assert.match(label, /^[a-z0-9-]+$/);
  const dom = await client.evaluate(`
    return {title:document.title,url:location.href,
      text:document.documentElement.innerText,
      controls:[...document.querySelectorAll('button,input,textarea,select,toolbarbutton,menuitem,[role]')]
        .filter(e=>e.getClientRects().length&&!e.closest('[hidden]'))
        .map(e=>({tag:e.localName,id:e.id,class:e.getAttribute('class'),role:e.getAttribute('role'),
          label:e.getAttribute('aria-label')||e.getAttribute('label')||e.title,
          l10n:e.getAttribute('data-l10n-id'),text:e.textContent?.trim().slice(0,300),
          value:e.value,checked:e.checked,disabled:e.disabled,expanded:e.getAttribute('aria-expanded')}))};
  `);
  json(path.join(run, `${label}.dom.json`), dom);
  const png = await client.call("WebDriver:TakeScreenshot", { full: false });
  fs.writeFileSync(path.join(run, `${label}.png`), Buffer.from(png.value, "base64"));
  record("snapshot", { label, url: dom.url });
  return dom;
}

async function seed(client) {
  const result = await client.evaluate(`
    const done = arguments[arguments.length-1];
    (async()=>{
      await Zotero.uiReadyPromise;
      const items=[];
      for(const title of ['Verification paper A','Verification paper B']) {
        const item=new Zotero.Item('journalArticle');
        item.setField('title',title); item.setField('abstractNote','Disposable verification fixture.');
        item.setField('date','2026'); await item.saveTx(); items.push({id:item.id,key:item.key,title});
      }
      return items;
    })().then(done,e=>done({error:e.message}));
  `, [], true);
  assert.ok(Array.isArray(result), JSON.stringify(result));
  json(path.join(run, "fixtures.json"), result);
  record("seed-data-only", result);
  return result;
}

async function prove(client) {
  await doctor(client);
  await seed(client);
  // The virtualized item list uses row indexes, not database IDs. Resolve the
  // fixture row through its user-visible title before clicking its DOM control.
  let row;
  for (let i = 0; i < 20 && !row; i++) {
    row = await client.evaluate(`return [...document.querySelectorAll('#zotero-items-tree [role="treeitem"]')].find(e=>e.textContent.includes('Verification paper A'))?.id;`);
    if (!row) await delay(250);
  }
  assert.ok(row, "Fixture row is missing; inspect the main-window DOM");
  await drive(client, "click", `#${row}`);
  const pane = await client.evaluate(`return [...document.querySelectorAll('[data-pane]')].find(e=>e.dataset.pane.includes('codex-sidebar'))?.getAttribute('data-pane');`);
  assert.ok(pane, "Codex sidenav button is missing");
  await drive(client, "click", `[data-pane=${JSON.stringify(pane)}]`);
  for (let i = 0; i < 60; i++) {
    if (await client.evaluate(`return !!document.querySelector('.zcs-input') && !document.querySelector('.zcs-input').disabled;`)) break;
    await delay(500);
  }
  await snapshot(client, "permissions-before");
  await drive(client, "click", ".zcs-permissions-trigger");
  assert.equal(await client.evaluate(`return document.querySelector('.zcs-permissions-card').hidden;`), false);
  await snapshot(client, "permissions-button-entry");
  await drive(client, "select", ".zcs-permission-field:nth-of-type(3) select", "workspace-write");
  await snapshot(client, "permissions-changed");
  await drive(client, "key", ".zcs-input", "Escape");
  await drive(client, "fill", ".zcs-input", "/approvals");
  await drive(client, "key", ".zcs-input", "Enter");
  const result = await client.evaluate(`
    const names=['approvalPolicy','approvalsReviewer','sandbox','networkAccess'];
    return {open:!document.querySelector('.zcs-permissions-card').hidden,
      access:document.querySelector('.zcs-permissions-trigger').dataset.access,
      input:document.querySelector('.zcs-input').value,
      stored:Object.fromEntries(names.map(k=>[k,Zotero.Prefs.get('extensions.zotero.codexSidebar.'+k,true)])),
      messages:document.querySelectorAll('.zcs-message').length};
  `);
  assert.equal(result.open, true);
  assert.equal(result.access, "workspace-write");
  assert.equal(result.stored.sandbox, "workspace-write");
  assert.equal(result.input, "");
  assert.equal(result.messages, 0);
  await snapshot(client, "permissions-slash-entry");
  // Persist the preference file for a second view outside the live controls.
  await client.evaluate("Services.prefs.savePrefFile(null); return true;");
  const disk = fs.readFileSync(path.join(state().profile, "prefs.js"), "utf8");
  assert.ok(disk.includes('user_pref("extensions.zotero.codexSidebar.sandbox", "workspace-write");'));
  const sessions = path.join(scratch, "runtime/sessions");
  assert.ok(!fs.existsSync(sessions) || fs.readdirSync(sessions).length === 0, "Local command created a session");
  json(path.join(run, "permissions-proof.json"), {feature:"commands-permissions",entries:["bottom permission button","/approvals"],result, persisted:true, sessionDirectoryEmpty:true, scope:"Native UI and preference persistence; no model response or approval request was tested"});
  return result;
}

async function cleanup() {
  if (!fs.existsSync(statePath)) return;
  const s = state();
  if (s.cleaned) return;
  const processInfo = spawnSync("ps", ["-p", String(s.pid), "-o", "command="], { encoding: "utf8" });
  if (processInfo.stderr?.includes("not permitted")) throw new Error("Process inspection needs host permission; rerun cleanup outside the command sandbox");
  assert.ok(processInfo.status === 0 || (processInfo.status === 1 && !processInfo.stderr?.trim()), "Could not establish process ownership; scratch preserved");
  if (processInfo.stdout?.trim()) {
    assert.ok(processInfo.stdout.includes(s.profile), "PID no longer belongs to this verification profile");
    // Capture only descendants of this recorded instance before signalling it.
    const listing = spawnSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" });
    assert.equal(listing.status, 0, "Cannot inspect instance descendants");
    const rows = listing.stdout.trim().split("\n").map(line=>line.trim().split(/\s+/).map(Number));
    const owned = new Set([s.pid]);
    for (let changed = true; changed;) {
      changed = false;
      for (const [pid, parent] of rows) if (owned.has(parent) && !owned.has(pid)) { owned.add(pid); changed = true; }
    }
    process.kill(s.pid, "SIGTERM");
    for (let i = 0; i < 30; i++) {
      try { process.kill(s.pid, 0); await delay(100); } catch { break; }
    }
    for (const pid of [...owned].reverse()) {
      try { process.kill(pid, "SIGTERM"); } catch (error) { if(error.code!=="ESRCH") throw error; }
    }
    for (let i = 0; i < 50; i++) {
      const alive = [...owned].filter(pid=>{try{process.kill(pid,0);return true;}catch{return false;}});
      if (!alive.length) break;
      if (i === 49) throw new Error(`Owned processes still alive: ${alive.join(",")}. Evidence and scratch preserved.`);
      await delay(100);
    }
    record("stopped-owned-processes", [...owned]);
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  s.cleaned = new Date().toISOString(); json(statePath, s);
  const artifacts = fs.readdirSync(run).filter(name => name !== "scratch");
  json(path.join(run, "cleanup.json"), {cleaned:s.cleaned,scratchRemoved:!fs.existsSync(scratch),evidence:artifacts});
  console.log(JSON.stringify({ cleaned: true, run, evidence: artifacts }, null, 2));
}

async function main() {
  if (command === "launch") return launch();
  if (command === "cleanup") return cleanup();
  assert.ok(["doctor","windows","seed","prove","snapshot","read","click","fill","key","select","check"].includes(command), "Use launch|doctor|windows|seed|prove|snapshot LABEL|read SCRIPT_FILE|click SELECTOR|fill SELECTOR VALUE|key SELECTOR KEY|select SELECTOR VALUE|check SELECTOR true|cleanup --run DIRECTORY [--window preferences]");
  const client = await connect();
  try {
    let result;
    if (command === "doctor") { result = await doctor(client); json(path.join(run, "doctor.json"), result); }
    else if (command === "windows") result = client.windows;
    else if (command === "seed") result = await seed(client);
    else if (command === "prove") result = await prove(client);
    else if (command === "snapshot") result = {path:run,label:argv[0],controls:(await snapshot(client,argv[0])).controls.length};
    else if (command === "read") { result=await client.evaluate(fs.readFileSync(argv[0],"utf8")); record("read",{file:argv[0],result}); }
    else result = await drive(client, command, argv[0], argv[1]);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (command === "prove") await snapshot(client, "failed-proof").catch(() => {});
    throw error;
  } finally { await client.close(); }
}

try { await main(); }
catch (error) {
  console.error(error.stack);
  if (command === "prove") await cleanup().catch(cleanupError => console.error(`Cleanup failed: ${cleanupError.message}`));
  process.exitCode = 1;
}
