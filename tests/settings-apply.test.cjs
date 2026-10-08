const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

global.ZoteroCodexModules = {};
require("../content/runtime-settings.js");
const RuntimeSettings = global.ZoteroCodexModules.RuntimeSettings;

function fixture() {
  const preferences = new Map();
  const calls = [];
  const context = {
    Zotero: { isWin: false, Prefs: {
      get: key => preferences.get(key),
      set: (key, value) => preferences.set(key, value),
    } },
    Services: { prefs: { savePrefFile: () => calls.push("persist") } },
    ZoteroCodexModules: {
      RuntimeSettings: { ...RuntimeSettings, prepare: async () => {}, importLogin: async () => calls.push("import") },
      CodexClient: { resolveCodexPath: async () => "/codex" },
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../content/main.js"), "utf8"), context);
  const plugin = context.ZoteroCodexPlugin;
  plugin.client = {
    pending: new Map(), connecting: null, account: {}, binaryPath: "/codex",
    disconnect: async () => calls.push("disconnect"),
    connect: async () => calls.push("connect"),
  };
  plugin.sidebar = {
    views: new Map(),
    detachRuntimeViews: () => { calls.push("detach"); return ["draft"]; },
    restoreRuntimeViews: snapshots => { assert.deepEqual(snapshots, ["draft"]); calls.push("restore"); },
  };
  return { plugin, preferences, calls, context };
}

test("switching storage preserves shared and isolated paper bindings independently", async () => {
  const { plugin, calls } = fixture();
  plugin.setPreference("paperThreads", '{"paper":"shared"}');
  await plugin.applySettings({ codexHome: "/zotero/runtime" });
  assert.equal(plugin.getPreference("paperThreads"), "{}");
  plugin.setPreference("paperThreads", '{"paper":"isolated"}');
  await plugin.applySettings({ codexHome: "" });
  assert.equal(plugin.getPreference("paperThreads"), '{"paper":"shared"}');
  await plugin.applySettings({ codexHome: "/zotero/runtime" });
  assert.equal(plugin.getPreference("paperThreads"), '{"paper":"isolated"}');
  assert.deepEqual(calls.slice(0, 5), ["detach", "disconnect", "persist", "connect", "restore"]);
});

test("active turns and requests reject settings before touching preferences or processes", async () => {
  const { plugin, calls } = fixture();
  plugin.sidebar.views.set("reader", { running: true });
  await assert.rejects(plugin.applySettings({ proxyMode: "direct" }), /current request/);
  plugin.sidebar.views.clear();
  plugin.client.pending.set(1, {});
  await assert.rejects(plugin.applySettings({ proxyMode: "direct" }), /current request/);
  assert.deepEqual(calls, []);
  assert.equal(plugin.getPreference("proxyMode"), "");
});

test("invalid settings keep the current connection and preferences", async () => {
  const { plugin, calls } = fixture();
  await assert.rejects(plugin.applySettings({ codexHome: "relative" }), /absolute path/);
  assert.deepEqual(calls, []);
});

test("failed connections still restore the sidebar and expose saved settings for repair", async () => {
  const { plugin, calls } = fixture();
  plugin.client.connect = async () => { throw new Error("server unavailable"); };
  await assert.rejects(plugin.applySettings({ proxyMode: "direct" }), /server unavailable/);
  assert.equal(plugin.getPreference("proxyMode"), "direct");
  assert.equal(calls.at(-1), "restore");
  assert.equal(plugin.applyingSettings, false);
});
