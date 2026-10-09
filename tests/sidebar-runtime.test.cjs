const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const itemA = { libraryID: 1, id: 101, key: "A" };
const itemB = { libraryID: 1, id: 102, key: "B" };
const imageA = { name: "a.png", dataURL: "data:image/png;base64,AA==" };
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  let hooks;
  const client = {
    binaryPath: "/codex",
    subscribe: () => () => {},
    connect: async () => {},
  };
  const context = {
    console,
    ZoteroCodexModules: {},
    Zotero: {
      getMainWindows: () => [],
      ItemPaneManager: { registerSection(callbacks) { hooks = callbacks; return "sidebar"; } },
      Reader: { registerEventListener() {} },
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../content/sidebar.js"), "utf8"), context);
  const { SidebarManager, SidebarView } = context.ZoteroCodexModules.Sidebar;

  // Keep the real lifecycle, context transitions, manager and draft operations.
  // Zotero's DOM and conversation services are unavailable in the Node runner.
  SidebarView.prototype.mount = function () {
    this.elements = { input: { value: "" }, pathStatus: {} };
    this.errors = [];
  };
  SidebarView.prototype.destroy = function () { this.destroyed = true; };
  SidebarView.prototype.refreshContext = async function () {
    this.context = this.item ? { itemID: this.item.id } : null;
    return this.context;
  };
  SidebarView.prototype.showError = function (error) { this.errors.push(error); };
  for (const name of [
    "setStatus", "refreshModels", "refreshThreads", "activatePaperConversation",
    "closeImagePreview", "hideCommandMenu", "hidePendingResponse", "clearResponseScrollSpace",
    "cancelEdit", "renderSelections", "renderContextAttachment", "renderRequests", "renderEmpty",
    "updateThreadHeader", "resizeComposer", "updateComposerState", "lockInitialShellHeight",
  ]) SidebarView.prototype[name] = function () {};

  const manager = new SidebarManager({ client, getPreference: () => "" });
  manager.init("test");
  const doc = {};
  const body = () => ({ ownerDocument: doc, isConnected: true });
  function render(target, item = itemA, tabType = "library") {
    hooks.onRender({ doc, body: target, item, tabType });
    return manager.views.get(target);
  }
  function select(target, item, tabType = "library") {
    hooks.onItemChange({ body: target, item, tabType, setEnabled() {}, setSectionSummary() {} });
  }
  async function open(target, item = itemA, tabType = "library") {
    const view = render(target, item, tabType);
    await hooks.onAsyncRender({ body: target });
    return view;
  }
  return { manager, hooks, client, body, render, select, open };
}

test("runtime replacement renders the latest selected paper", async () => {
  const f = fixture();
  const body = f.body();
  const original = await f.open(body);
  f.manager.detachRuntimeViews();
  f.select(body, itemB);
  f.render(body, itemB);
  f.manager.restoreRuntimeViews();
  await settle();
  const replacement = f.manager.views.get(body);
  assert.notEqual(replacement, original);
  assert.equal(original.destroyed, true);
  assert.equal(replacement.item, itemB);
  assert.equal(replacement.context.itemID, itemB.id);
});

test("item change alone updates the paper restored after reconnect", async () => {
  const f = fixture();
  const body = f.body();
  await f.open(body);
  f.manager.detachRuntimeViews();
  f.select(body, itemB);
  f.manager.restoreRuntimeViews();
  await settle();
  assert.equal(f.manager.views.get(body).context.itemID, itemB.id);
});

test("a reader opened during reconnect is rendered when reconnect finishes", async () => {
  const f = fixture();
  await f.open(f.body());
  f.manager.detachRuntimeViews();
  const reader = f.body();
  f.render(reader, itemB, "reader");
  f.manager.restoreRuntimeViews();
  await settle();
  const view = f.manager.views.get(reader);
  assert.ok(view);
  assert.equal(view.tabType, "reader");
  assert.equal(view.context.itemID, itemB.id);
});

test("destroyed and disconnected panes are not resurrected", async () => {
  const f = fixture();
  const destroyed = f.body();
  const disconnected = f.body();
  await f.open(destroyed);
  await f.open(disconnected);
  f.manager.detachRuntimeViews();
  f.hooks.onDestroy({ body: destroyed });
  disconnected.isConnected = false;
  f.manager.restoreRuntimeViews();
  await settle();
  assert.equal(f.manager.views.has(destroyed), false);
  assert.equal(f.manager.views.has(disconnected), false);
});

test("text and images stay with their paper and return when that paper is selected again", async () => {
  const f = fixture();
  const body = f.body();
  const original = await f.open(body);
  original.elements.input.value = "Question about A";
  original.images = [imageA];
  f.manager.detachRuntimeViews();
  f.select(body, itemB);
  f.manager.restoreRuntimeViews();
  await settle();
  const view = f.manager.views.get(body);
  assert.equal(view.elements.input.value, "");
  assert.equal(view.images.length, 0);
  f.select(body, { ...itemA });
  await settle();
  assert.equal(view.elements.input.value, "Question about A");
  assert.equal(view.images.length, 1);
  assert.deepEqual({ ...view.images[0] }, imageA);

  // A consumed draft must not reappear on a subsequent visit.
  view.elements.input.value = "";
  view.images = [];
  f.select(body, itemB);
  await settle();
  f.select(body, itemA);
  await settle();
  assert.equal(view.elements.input.value, "");
  assert.equal(view.images.length, 0);
});

test("draft restoration preserves text entered while initialization is pending", async () => {
  const f = fixture();
  const body = f.body();
  const original = await f.open(body);
  original.elements.input.value = "Saved A";
  original.images = [imageA];
  f.manager.detachRuntimeViews();
  let release;
  f.client.connect = () => new Promise(resolve => { release = resolve; });
  f.manager.restoreRuntimeViews();
  const view = f.manager.views.get(body);
  view.elements.input.value = "New typing";
  release();
  await settle();
  assert.equal(view.elements.input.value, "New typing");
  assert.equal(view.images.length, 0);
});

test("failed initialization still restores the current paper's draft", async () => {
  const f = fixture();
  const body = f.body();
  const original = await f.open(body);
  original.elements.input.value = "Unsaved question";
  original.images = [imageA];
  f.manager.detachRuntimeViews();
  f.client.connect = async () => { throw new Error("offline"); };
  f.manager.restoreRuntimeViews();
  await settle();
  const view = f.manager.views.get(body);
  assert.equal(view.errors[0].message, "offline");
  assert.equal(view.elements.input.value, "Unsaved question");
  assert.deepEqual({ ...view.images[0] }, imageA);
});

test("selection changes during initialization cannot receive another paper's draft", async () => {
  const f = fixture();
  const body = f.body();
  const original = await f.open(body);
  original.elements.input.value = "Saved A";
  original.images = [imageA];
  f.manager.detachRuntimeViews();
  let release;
  f.client.connect = () => new Promise(resolve => { release = resolve; });
  f.manager.restoreRuntimeViews();
  const view = f.manager.views.get(body);
  f.select(body, itemB);
  release();
  await settle();
  assert.equal(view.elements.input.value, "");
  assert.equal(view.images.length, 0);
  assert.equal(view.context.itemID, itemB.id);
  f.select(body, itemA);
  await settle();
  assert.equal(view.elements.input.value, "Saved A");
  assert.deepEqual({ ...view.images[0] }, imageA);
});

test("destroying a pane also removes its saved drafts", async () => {
  const f = fixture();
  const body = f.body();
  const original = await f.open(body);
  original.elements.input.value = "Old pane";
  original.images = [imageA];
  f.manager.detachRuntimeViews();
  f.hooks.onDestroy({ body });
  f.render(body);
  f.manager.restoreRuntimeViews();
  await settle();
  const view = f.manager.views.get(body);
  assert.equal(view.elements.input.value, "");
  assert.equal(view.images.length, 0);
});
