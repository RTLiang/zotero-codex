const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("an unopened sidebar's pending document does not block settings, while active work does", () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../content/main.js"), "utf8"), context);
  const plugin = context.ZoteroCodexPlugin;
  const unopened = { initialized: false, contextTransitioning: true };
  const active = { initialized: true, contextTransitioning: false };
  plugin.client = { connecting: null, pending: new Map() };
  plugin.sidebar = { runningTurns: new Map(), views: new Map([["library", unopened], ["reader", active]]) };
  assert.equal(plugin.runtimeBusy(), false);
  for (const flag of ["running", "creatingTask", "initializing", "contextTransitioning"]) {
    active[flag] = true;
    assert.equal(plugin.runtimeBusy(), true, flag);
    active[flag] = false;
  }
  plugin.client.pending.set(1, {});
  assert.equal(plugin.runtimeBusy(), true);
});

test("settings save follows background activity and recovers after requests end without a notification", async () => {
  const nodes = [];
  let poll, unload, listener, unsubscribed = false, timerCleared = false;
  const doc = {
    defaultView: {
      setInterval(fn) { poll = fn; return 1; },
      clearInterval(id) { assert.equal(id, 1); timerCleared = true; },
      addEventListener(name, fn) { assert.equal(name, "unload"); unload = fn; },
      removeEventListener() {},
    },
    createElementNS(_ns, tag) {
      const node = { ownerDocument: doc, tag, children: [], events: {}, value: "", disabled: false,
        appendChild(child) { this.children.push(child); },
        setAttribute() {}, removeAttribute() {},
        replaceChildren(...children) { this.children = children; },
        addEventListener(name, fn) { this.events[name] = fn; },
      };
      nodes.push(node);
      return node;
    },
    createTextNode: text => ({ text }),
  };
  const body = { childElementCount: 0, appendChild() {} };
  const root = { ownerDocument: doc, querySelector: () => body };
  const context = { Services: { locale: { appLocaleAsBCP47: "en-US" } } };
  context.ZoteroCodexModules = { Protocol: require("../content/protocol.js") };
  vm.runInNewContext(fs.readFileSync(require.resolve("../content/localization.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(require.resolve("../content/preferences.js"), "utf8"), context);
  let busy = true;
  const api = {
    models: { read: () => "", catalog: () => [], save() {}, refresh: async () => [] },
    read: () => ({ proxyMode: "inherit" }), busy: () => busy,
    language: () => "auto", setLanguage() {},
    subscribe(fn) { listener = fn; return () => { unsubscribed = true; }; },
    apply: async () => ({ authenticated: true }),
  };
  context.ZoteroCodexModules.Preferences.mount(root, api);
  const mode = nodes.find(node => node.id === "codex-setting-proxyMode");
  const manual = nodes.find(node => node.id === "codex-manual-proxy");
  const url = nodes.find(node => node.id === "codex-setting-proxyURL");
  assert.equal(manual.hidden, true);
  assert.equal(url.disabled, true);
  url.value = "http://127.0.0.1:7890";
  mode.value = "manual";
  mode.events.change();
  assert.equal(manual.hidden, false);
  assert.equal(url.disabled, false);
  mode.value = "direct";
  mode.events.change();
  assert.equal(manual.hidden, true);
  assert.equal(url.value, "http://127.0.0.1:7890");
  assert.equal(nodes.find(node => node.id === "codex-storage-settings").open, false);
  const save = nodes.find(node => node.id === "codex-settings-save");
  assert.equal(save.disabled, true);
  busy = false;
  poll();
  assert.equal(save.disabled, false);
  busy = true;
  listener();
  assert.equal(save.disabled, true);
  busy = false;
  poll();
  await save.events.click();
  assert.equal(save.disabled, false);
  assert.match(nodes.find(node => node.id === "codex-settings-status").textContent, /Connected/);
  unload();
  assert.equal(unsubscribed, true);
  assert.equal(timerCleared, true);
});
