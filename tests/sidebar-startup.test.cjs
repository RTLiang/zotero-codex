const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = { Protocol: require("../content/protocol.js"), CodexClient: {}, Markdown: {} };
require("../content/localization.js");
require("../content/sidebar.js");
const { SidebarView } = global.ZoteroCodexModules.Sidebar;
const nextTick = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function startupView({ connection = Promise.resolve(), catalog = Promise.resolve([]) } = {}) {
  const calls = [];
  const context = { itemID: 1, title: "Sample document" };
  const view = Object.assign(Object.create(SidebarView.prototype), {
    initialized: false, initializing: false, contextEpoch: 1, threadRefreshSerial: 0,
    threadID: "", threads: [], context: null, activePaperKey: "", destroyed: false,
    manager: {
      getPreference: key => key === "paperOnlyChats",
      getPaperThread: () => "sample-chat", paperDirectory: () => "/fixtures/sample",
      restoreRuntimeDraft() {},
    },
    client: {
      connect: () => { calls.push("connect"); return connection; },
      listThreads: () => { calls.push("history"); return catalog; },
    },
    elements: { pathStatus: { textContent: "", removeAttribute() {} } },
    setStatus() {}, renderThreadPicker() {}, updateThreadHeader() {},
    showError(error) { throw error; },
    refreshModels: async () => { calls.push("models"); },
    refreshContext: async () => { calls.push("context"); view.context = context; return context; },
    selectThread: async id => { calls.push(`restore:${id}`); view.threadID = id; return true; },
    updateComposerState() { calls.push(this.contextTransitioning ? "locked" : "ready"); },
  });
  view.client.binaryPath = "fixture-codex";
  return { view, calls };
}

test("cold start restores the bound chat without waiting for the history catalog", async () => {
  const catalog = deferred();
  const { view, calls } = startupView({ catalog: catalog.promise });
  const initialization = view.initialize();
  try {
    await nextTick();
    assert.equal(view.contextTransitioning, false, "history enumeration must not keep the composer locked");
    assert.ok(calls.includes("restore:sample-chat"));
    assert.equal(calls.includes("history"), false);
  }
  finally { catalog.resolve([]); await initialization; }
});

test("cold start resolves local paper context while the app server connects", async () => {
  const connection = deferred();
  const { view, calls } = startupView({ connection: connection.promise });
  const initialization = view.initialize();
  try {
    await nextTick();
    assert.ok(calls.includes("context"), "local context work should overlap app-server startup");
  }
  finally { connection.resolve(); await initialization; }
});

test("restoring the bound chat overlaps model discovery", async () => {
  const models = deferred();
  const { view, calls } = startupView();
  view.refreshModels = () => models.promise;
  const initialization = view.initialize();
  try {
    await nextTick();
    assert.ok(calls.includes("restore:sample-chat"));
    assert.equal(view.contextTransitioning, true, "initialization still waits for usable model controls");
  }
  finally { models.resolve(); await initialization; }
});

test("failed model discovery leaves startup retryable", async () => {
  const { view } = startupView();
  const failure = new Error("Sample catalog unavailable");
  view.refreshModels = async () => { throw failure; };
  view.showError = error => { assert.equal(error, failure); };
  await view.initialize();
  assert.equal(view.initialized, false);
  assert.equal(view.contextTransitioning, false);
  view.refreshModels = async () => {};
  await view.initialize();
  assert.equal(view.initialized, true);
});
