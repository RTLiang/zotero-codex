const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"),
  CodexClient: {},
  Markdown: {},
};
require("../content/sidebar.js");

const { SidebarManager, SidebarView } = global.ZoteroCodexModules.Sidebar;

function createManager() {
  const preferences = new Map();
  return new SidebarManager({
    client: {},
    getPreference: (name) => preferences.get(name),
    setPreference: (name, value) => preferences.set(name, value),
  });
}

test("does not let a closed stale popup clear a newer live selection", () => {
  const manager = createManager();
  const first = manager.setLiveSelection(7, { text: "First", pageNumber: 1 });
  const second = manager.setLiveSelection(7, { text: "Second", pageNumber: 2 });

  manager.clearLiveSelection(7, first.id);
  assert.equal(manager.getLiveSelection(7).id, second.id);

  manager.clearLiveSelection(7, second.id);
  assert.equal(manager.getLiveSelection(7), null);
});

test("consumes only selections included in the completed send", () => {
  const manager = createManager();
  manager.addSelection(9, { text: "Sent pinned text", pageNumber: 3 });
  const sentPinned = manager.getSelections(9)[0];
  const sentLive = manager.setLiveSelection(9, { text: "Sent live text", pageNumber: 4 });

  manager.addSelection(9, { text: "New pinned text", pageNumber: 5 });
  const newLive = manager.setLiveSelection(9, { text: "New live text", pageNumber: 6 });
  manager.consumeSelections(9, {
    liveSelectionID: sentLive.id,
    selectionIDs: [sentPinned.id],
  });

  assert.deepEqual(manager.getSelections(9).map((selection) => selection.text), ["New pinned text"]);
  assert.equal(manager.getLiveSelection(9).id, newLive.id);
});

test("removes the live and pinned selections after they are sent", () => {
  const manager = createManager();
  manager.addSelection(11, { text: "Pinned once", pageNumber: 7 });
  const pinned = manager.getSelections(11)[0];
  const live = manager.setLiveSelection(11, { text: "Live once", pageNumber: 8 });

  manager.consumeSelections(11, {
    liveSelectionID: live.id,
    selectionIDs: [pinned.id],
  });

  assert.deepEqual(manager.getSelections(11), []);
  assert.equal(manager.getLiveSelection(11), null);
});

test("bounds selection state and removes empty attachment buckets", () => {
  const manager = createManager();
  for (let attachmentID = 1; attachmentID <= 55; attachmentID++) {
    manager.addSelection(attachmentID, { text: `Pinned ${attachmentID}`, pageNumber: 1 });
    manager.setLiveSelection(attachmentID, { text: `Live ${attachmentID}`, pageNumber: 1 });
  }

  assert.equal(manager.selections.size, 50);
  assert.equal(manager.liveSelections.size, 50);
  assert.equal(manager.selections.has(1), false);
  assert.equal(manager.liveSelections.has(1), false);

  const selection = manager.getSelections(55)[0];
  manager.removeSelection(55, selection.id);
  assert.equal(manager.selections.has(55), false);
});

test("disconnects tracked reader popup observers during shutdown", async () => {
  const manager = createManager();
  let disconnected = 0;
  let unloadRemoved = 0;
  class Observer {
    observe() {}
    disconnect() {
      disconnected++;
    }
  }
  const win = {
    MutationObserver: Observer,
    addEventListener() {},
    removeEventListener(type) {
      if (type === "unload") unloadRemoved++;
    },
  };
  const doc = { defaultView: win, documentElement: {} };
  const button = { isConnected: true };
  manager.watchReaderSelectionPopup(doc, button, 7, "selection-7");
  assert.equal(manager.selectionPopupCleanups.size, 1);

  global.Zotero = {
    ItemPaneManager: { unregisterSection() {} },
    Reader: { unregisterEventListener() {} },
  };
  await manager.shutdown();
  assert.equal(disconnected, 1);
  assert.equal(unloadRemoved, 1);
  assert.equal(manager.selectionPopupCleanups.size, 0);
});

test("invalidates every paper-scoped UI state before loading a new item", () => {
  const calls = [];
  const view = {
    contextEpoch: 4,
    contextTransitioning: false,
    loadSerial: 9,
    threadRefreshSerial: 2,
    context: { itemID: 1 },
    threadID: "old-thread",
    thread: { id: "old-thread" },
    activePaperKey: "old-paper",
    activeTurnID: "old-turn",
    running: true,
    streamingText: "old stream",
    streamingNode: {},
    streamingItemID: "old-item",
    streamingPhase: "commentary",
    nextTurnSelectionPending: true,
    images: [{ id: "old-image" }],
    elements: { input: { value: "old draft" } },
    hidePendingResponse: () => calls.push("pending"),
    clearResponseScrollSpace: () => calls.push("space"),
    cancelEdit: () => calls.push("edit"),
    renderSelections: () => calls.push("selections"),
    renderContextAttachment: () => calls.push("context"),
    renderRequests: () => calls.push("requests"),
    renderEmpty: () => calls.push("empty"),
    updateThreadHeader: () => calls.push("header"),
    resizeComposer: () => calls.push("resize"),
    updateComposerState: () => calls.push("composer"),
  };

  SidebarView.prototype.beginContextTransition.call(view);
  assert.equal(view.contextEpoch, 5);
  assert.equal(view.loadSerial, 10);
  assert.equal(view.threadRefreshSerial, 3);
  assert.equal(view.context, null);
  assert.equal(view.threadID, "");
  assert.equal(view.thread, null);
  assert.equal(view.running, false);
  assert.equal(view.streamingText, "");
  assert.deepEqual(view.images, []);
  assert.equal(view.elements.input.value, "");
  assert.equal(view.contextTransitioning, true);
  assert.deepEqual(calls, [
    "pending", "space", "edit", "selections", "context", "requests", "empty",
    "header", "resize", "composer",
  ]);
});

test("cleans approvals for a completed background task without changing the current task", () => {
  let requestRenders = 0;
  let runningChanges = 0;
  const view = {
    destroyed: false,
    threadID: "current-thread",
    pendingRequests: new Map([
      ["old-request", { contextThreadID: "old-thread" }],
      ["current-request", { contextThreadID: "current-thread" }],
    ]),
    renderRequests: () => requestRenders++,
    setRunning: () => runningChanges++,
  };

  SidebarView.prototype._handleClientEvent.call(view, {
    type: "notification",
    method: "turn/completed",
    params: { threadId: "old-thread" },
  });
  assert.equal(view.pendingRequests.has("old-request"), false);
  assert.equal(view.pendingRequests.has("current-request"), true);
  assert.equal(requestRenders, 1);
  assert.equal(runningChanges, 0);
});

test("removes every persistent sidebar event handler during view destruction", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content/sidebar.js"), "utf8");
  const mounted = [...source.matchAll(/addEventListener\([^\n]+this\.handlers\.([A-Za-z0-9_]+)/g)]
    .map((match) => match[1]);
  const removed = new Set(
    [...source.matchAll(/removeEventListener\([^\n]+this\.handlers\.([A-Za-z0-9_]+)/g)]
      .map((match) => match[1]),
  );

  assert.ok(mounted.length > 0);
  assert.deepEqual(mounted.filter((handler) => !removed.has(handler)), []);
});
