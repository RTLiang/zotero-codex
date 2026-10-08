const test = require("node:test");
const assert = require("node:assert/strict");
global.ZoteroCodexModules = { Protocol: require("../content/protocol.js") };
require("../content/runtime-settings.js");
require("../content/codex-client.js");
const Settings = global.ZoteroCodexModules.RuntimeSettings;
const { CodexAppServerClient } = global.ZoteroCodexModules.CodexClient;

test("inherit leaves the parent's proxy and storage environment untouched", () => {
  assert.deepEqual(Settings.environment(Settings.validate({})), {});
});

test("manual overrides every proxy spelling and keeps localhost bypass", () => {
  const env = Settings.environment(Settings.validate({ proxyMode: "manual", proxyURL: "http://127.0.0.1:7890" }));
  for (const key of Settings.PROXY_KEYS) assert.equal(env[key], "http://127.0.0.1:7890");
  assert.equal(env.NO_PROXY, "localhost,127.0.0.1,::1");
  assert.equal(env.no_proxy, env.NO_PROXY);
});

test("direct clears inherited proxies and bypasses all hosts", () => {
  const env = Settings.environment(Settings.validate({ proxyMode: "direct", proxyURL: "invalid dormant setting" }));
  for (const key of Settings.PROXY_KEYS) assert.equal(env[key], "");
  assert.equal(env.NO_PROXY, "*");
  assert.equal(env.no_proxy, "*");
});

test("dedicated storage overrides both CODEX_HOME and inherited SQLite location", () => {
  const env = Settings.environment(Settings.validate({ codexHome: "/library/Codex runtime" }));
  assert.equal(env.CODEX_HOME, "/library/Codex runtime");
  assert.equal(env.CODEX_SQLITE_HOME, env.CODEX_HOME);
});

test("rejects relative paths and unsafe proxy values before saving", () => {
  for (const path of ["~/codex", "$HOME/codex", "relative", "/home/a\nwrong"]) {
    assert.throws(() => Settings.validate({ codexHome: path }), /absolute path/);
  }
  for (const proxyURL of ["broken", "file:///tmp/proxy", "http://user:secret@localhost:7890", "http://localhost/path", "http://localhost?password=secret"]) {
    assert.throws(() => Settings.validate({ proxyMode: "manual", proxyURL }), /Proxy URL/);
  }
  assert.throws(() => Settings.validate({ proxyMode: "unknown" }), /mode/);
  assert.equal(Settings.validate({ codexHome: "C:\\Users\\Research\\Codex" }, true).codexHome, "C:\\Users\\Research\\Codex");
});

test("storage bindings are independent while global model preferences remain shared", () => {
  assert.equal(Settings.scopedKey("lastThreadId", ""), "lastThreadId");
  assert.notEqual(Settings.scopedKey("paperThreads", "/a"), Settings.scopedKey("paperThreads", "/b"));
  assert.equal(Settings.scopedKey("paperThreads", "/a"), Settings.scopedKey("paperThreads", "/a"));
  assert.equal(Settings.scopedKey("model", "/a"), "model");
});

test("app-server receives proxy, private storage, SQLite override and working directory", async () => {
  const previous = { Services: global.Services, IOUtils: global.IOUtils, Zotero: global.Zotero };
  try {
    global.Services = { env: { get: () => "" } };
    global.Zotero = { isWin: false };
    const directories = [];
    global.IOUtils = {
      exists: async () => true,
      makeDirectory: async (path, options) => directories.push([path, options]),
      stat: async () => ({ type: "directory" }),
    };
    const values = { codexPath: "/usr/bin/codex", proxyMode: "manual", proxyURL: "http://127.0.0.1:7890", codexHome: "/zotero/runtime", workingDirectory: "/zotero/workspace" };
    const client = new CodexAppServerClient({ getPreference: key => values[key] });
    let spawned;
    client.loadSubprocessModule = async () => ({ call: async options => { spawned = options; return {}; } });
    client._readStdout = client._readStderr = async () => {};
    client.request = async () => ({});
    client.notify = () => {};
    await client.connect();
    assert.equal(spawned.environment.CODEX_HOME, values.codexHome);
    assert.equal(spawned.environment.HTTPS_PROXY, values.proxyURL);
    assert.equal(spawned.environmentAppend, true);
    assert.equal(spawned.workdir, values.workingDirectory);
    assert.deepEqual(spawned.arguments, ["app-server", "-c", 'sqlite_home="/zotero/runtime"']);
    assert.equal(directories.length, 2);
    assert.ok(directories.every(([, options]) => options.permissions === 0o700));
  } finally { Object.assign(global, previous); }
});

test("login import uses a no-overwrite copy and private permissions without parsing credentials", async () => {
  const previous = { IOUtils: global.IOUtils, PathUtils: global.PathUtils, Services: global.Services };
  try {
    const calls = [];
    global.Services = { env: { get: () => "/original" } };
    global.PathUtils = require("node:path").posix;
    global.IOUtils = {
      copy: async (...args) => calls.push(["copy", ...args]),
      setPermissions: async (...args) => calls.push(["permissions", ...args]),
    };
    await Settings.importLogin("/private");
    assert.deepEqual(calls, [
      ["copy", "/original/auth.json", "/private/auth.json", { noOverwrite: true }],
      ["permissions", "/private/auth.json", 0o600],
    ]);
    global.IOUtils.copy = async () => { throw new Error("destination exists"); };
    await assert.rejects(Settings.importLogin("/private"), /destination exists/);
    assert.equal(calls.length, 2);
  } finally { Object.assign(global, previous); }
});
