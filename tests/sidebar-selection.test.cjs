const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"),
  CodexClient: {},
  Markdown: {},
};
require("../content/localization.js");
require("../content/sidebar.js");

const { SidebarManager, SidebarView } = global.ZoteroCodexModules.Sidebar;

function titleSendView(includeItem = true) {
  const context = {
    itemID: 1, attachmentID: 2, title: "Sample document",
    abstract: "This synthetic document describes a sample workflow.", pdfPath: "/fixtures/document.pdf",
  };
  const view = {
    context, contextEpoch: 1, models: [], images: [], threads: [],
    elements: { input: { value: "这是什么" }, newThreadButton: {}, threadButton: {} },
    manager: createManager(),
    client: {
      startThread: async ({ title }) => ({ id: "fixture-thread", name: title }),
      startTurn: async () => ({ id: "first-turn" }),
    },
    isCurrentContext: () => true,
    updateComposerState() {}, setStatus() {}, updateThreadHeader() {},
    resizeComposer() {}, renderContextAttachment() {}, appendOptimisticUser() {},
    showPendingResponse() {}, hidePendingResponse() {}, setRunning() {}, showError(error) { throw error; },
    createThreadForMessage: SidebarView.prototype.createThreadForMessage,
    draftPinnedSelections: SidebarView.prototype.draftPinnedSelections,
  };
  view.manager.setPreference("includeItemContext", includeItem);
  return view;
}

test("new document chats start with the document title and capture its context for naming", async () => {
  const view = titleSendView();
  await SidebarView.prototype.send.call(view);
  assert.equal(view.thread.name, view.context.title);
  const titleRequest = view.manager.runningTurns.get(view.threadID).titleRequest;
  assert.equal(titleRequest.initialName, view.thread.name);
  view.context = { title: "A different document" };
  assert.match(titleRequest.context.zotero.value, /Sample document/);
  assert.match(titleRequest.context.zotero.value, /synthetic document/);
  assert.doesNotMatch(titleRequest.context.zotero.value, /different document|\/fixtures/);
});

test("sending a PDF location question supplies Zotero-extracted page evidence", async () => {
  const previousZotero = global.Zotero;
  const calls = [];
  global.Zotero = {
    PDFWorker: {
      getFullText: async (...args) => {
        calls.push(args);
        return {
          text: "1 Introduction\nThe document mentions method steps later.\f5 Method\nFollow the sample steps.",
          extractedPages: 2,
        };
      },
    },
  };
  try {
    const view = titleSendView();
    view.elements.input.value = "where is method";
    let sent;
    view.client.startTurn = async (args) => { sent = args; return { id: "first-turn" }; };
    await SidebarView.prototype.send.call(view);
    assert.deepEqual(calls, [[2, null, true]]);
    assert.match(sent.context.zotero.value, /Excerpt, physical PDF page 2:\n5 Method/u);
  }
  finally {
    global.Zotero = previousZotero;
  }
});

test("this page uses the reader position captured before async chat creation", async t => {
  const viewer = { currentPageNumber: 2 };
  const reader = {
    itemID: 2,
    _internalReader: {
      _primaryView: { _iframeWindow: { PDFViewerApplication: { pdfViewer: { currentPageNumber: 1 } } } },
      _lastView: { _pageLabels: ["i", "1", "2"], _iframeWindow: { PDFViewerApplication: { pdfViewer: viewer } } },
    },
  };
  const previousZotero = global.Zotero;
  t.after(() => { global.Zotero = previousZotero; });
  global.Zotero = {
    Reader: { getByTabID: id => id === "active-pdf" ? reader : null },
    PDFWorker: { getFullText: async () => ({
      text: "Introduction\fThe visible page explains the sample workflow.\fConclusion",
      extractedPages: 3,
    }) },
  };
  const view = titleSendView();
  view.context.tabType = "reader";
  view.doc = { defaultView: { Zotero_Tabs: { selectedID: "active-pdf" } } };
  view.elements.input.value = "解释这一页";
  view.client.startThread = async () => {
    viewer.currentPageNumber = 3;
    return { id: "fixture-thread" };
  };
  let sent;
  view.client.startTurn = async args => { sent = args; return { id: "first-turn" }; };
  await SidebarView.prototype.send.call(view);
  assert.match(sent.context.zotero.value, /Currently viewed page at send time: physical PDF page 2; printed label 1/u);
  assert.match(sent.context.zotero.value, /Current page text:\nThe visible page explains/u);
  assert.ok(sent.context.zotero.value.indexOf("Current page text") < sent.context.zotero.value.indexOf("Opening text"));

  view.manager.runningTurns.clear();
  view.elements.input.value = "解释这一页";
  await SidebarView.prototype.send.call(view);
  assert.match(sent.context.zotero.value, /Currently viewed page at send time: physical PDF page 3/u);
  assert.match(sent.context.zotero.value, /Current page text:\nConclusion/u);
});

test("current reader page never leaks through library, another attachment, or an uninitialized reader", async t => {
  const reader = { itemID: 2, _internalReader: { _primaryView: {
    _iframeWindow: { PDFViewerApplication: { pdfViewer: { currentPageNumber: 2 } } },
  } } };
  const previousZotero = global.Zotero;
  t.after(() => { global.Zotero = previousZotero; });
  global.Zotero = {
    Reader: { getByTabID: () => reader },
    PDFWorker: { getFullText: async () => ({ text: "First\fSecond", extractedPages: 2 }) },
  };
  for (const mode of ["library", "other-attachment", "uninitialized"]) {
    const view = titleSendView();
    view.context.tabType = mode === "library" ? "library" : "reader";
    view.doc = { defaultView: { Zotero_Tabs: { selectedID: "active-pdf" } } };
    reader.itemID = mode === "other-attachment" ? 99 : 2;
    reader._internalReader._primaryView._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber =
      mode === "uninitialized" ? 0 : 2;
    let sent;
    view.client.startTurn = async args => { sent = args; return { id: "first-turn" }; };
    await SidebarView.prototype.send.call(view);
    assert.doesNotMatch(sent.context?.zotero.value || "", /Currently viewed page|Current page text/u, mode);
  }
});

test("current page survives unavailable PDF text and bounds long page evidence", async t => {
  const { pdfEvidenceForQuestion } = global.ZoteroCodexModules.Sidebar;
  const context = { attachmentID: 2, pdfPath: "/fixtures/disposable.pdf" };
  const currentPage = { pageNumber: 2, pageLabel: "ii" };
  const previousZotero = global.Zotero;
  t.after(() => { global.Zotero = previousZotero; });
  global.Zotero = {
    PDFWorker: { getFullText: async () => { throw new Error("Unreadable fixture"); } },
  };
  const failedExtraction = await pdfEvidenceForQuestion(context, "this page", currentPage);
  assert.match(failedExtraction, /physical PDF page 2; printed label ii/u);
  assert.match(failedExtraction, /local PDF\/OCR tools/u);
  global.Zotero.PDFWorker.getFullText = async () => ({ text: `First\f${"Visible page. ".repeat(500)}`, extractedPages: 2 });
  const evidence = await pdfEvidenceForQuestion(context, "this page", currentPage);
  assert.match(evidence, /Current page text \(opening excerpt\):\nVisible page/u);
  assert.ok(evidence.length <= 3000);
  global.Zotero.PDFWorker.getFullText = async () => ({ text: "No reliable page boundaries", extractedPages: 2 });
  assert.doesNotMatch(await pdfEvidenceForQuestion(context, "this page", currentPage), /Current page text/u);
});

test("MCP access prompts explain the requested access when the server provides a message", () => {
  const description = SidebarView.prototype.requestDescription.call({}, {
    method: "mcpServer/elicitation/request",
    params: { serverName: "Computer Use", message: "Allow access to Zotero" },
  });
  assert.deepEqual(description, { text: "Allow access to Zotero" });
});

test("legacy disabled context cannot suppress the current item or document-based naming", async () => {
  const view = titleSendView(false);
  let sent;
  view.client.startTurn = async args => { sent = args; return { id: "first-turn" }; };
  await SidebarView.prototype.send.call(view);
  assert.equal(view.thread.name, view.context.title);
  assert.match(sent.context.zotero.value, /Sample document/u);
  assert.match(sent.context.zotero.value, /\/fixtures\/document.pdf/u);
  assert.match(view.manager.runningTurns.get(view.threadID).titleRequest.context.zotero.value, /Sample document/u);
});

test("auto naming uses the first final answer and preserves manual renames during generation", async () => {
  for (const manuallyRenamed of [false, true]) {
    const request = { threadID: "fixture-thread", text: "这是什么", initialName: "Document title" };
    const renamed = [];
    let reads = 0;
    const view = {
      threads: [{ id: "fixture-thread", name: "Document title" }],
      thread: { id: "fixture-thread", name: "Document title" },
      updateThreadHeader() {}, renderThreadPicker() {},
      client: {
        readThread: async () => ({
          name: ++reads === 2 && manuallyRenamed ? "My custom title" : "Document title",
          turns: [
            { items: [
              { type: "agentMessage", phase: "commentary", text: "I will read the document." },
              { type: "agentMessage", phase: "final", text: "The sample document describes a workflow." },
            ] },
            { items: [{ type: "agentMessage", text: "Later unrelated discussion" }] },
          ],
        }),
        generateThreadTitle: async (input) => {
          assert.equal(input.answer, "The sample document describes a workflow.");
          return "示例文档：步骤说明";
        },
        setThreadName: async (id, title) => renamed.push([id, title]),
      },
    };
    const manager = createManager();
    manager.client = view.client;
    manager.views.set("test", view);
    manager.log = (message, error) => { throw error; };
    await manager.autoNameThread(request);
    assert.deepEqual(renamed, manuallyRenamed ? [] : [["fixture-thread", "示例文档：步骤说明"]]);
    assert.equal(view.thread.name, manuallyRenamed ? "Document title" : "示例文档：步骤说明");
  }
});

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

test("removing a task clears every document binding and updates open views", () => {
  const manager = createManager();
  manager.setPaperThread("paper-a", "removed-task");
  manager.setPaperThread("paper-b", "removed-task");
  manager.setPaperThread("paper-c", "kept-task");
  manager.setPreference("lastThreadId", "removed-task");
  manager.client.loadedThreads = new Set(["removed-task", "kept-task"]);
  const removed = [];
  manager.views.set("first", { onThreadRemoved: (id) => removed.push(["first", id]) });
  manager.views.set("second", { onThreadRemoved: (id) => removed.push(["second", id]) });

  manager.handleThreadRemoved("removed-task");

  assert.equal(manager.getPaperThread("paper-a"), "");
  assert.equal(manager.getPaperThread("paper-b"), "");
  assert.equal(manager.getPaperThread("paper-c"), "kept-task");
  assert.equal(manager.getPreference("lastThreadId"), "");
  assert.equal(manager.client.loadedThreads.has("removed-task"), false);
  assert.deepEqual(removed, [["first", "removed-task"], ["second", "removed-task"]]);
});

test("cancelled deletion leaves the task untouched", async () => {
  let deleted = 0;
  let removed = 0;
  const view = {
    contextMenuThreadID: "task-1",
    destroyed: false,
    running: false,
    creatingTask: false,
    contextTransitioning: false,
    managingThreadID: "",
    threads: [{ id: "task-1", name: "My task" }],
    thread: null,
    doc: {
      l10n: { formatValue: async () => "Confirm delete" },
      defaultView: { confirm: () => false },
    },
    client: { deleteThread: async () => deleted++ },
    manager: { handleThreadRemoved: () => removed++ },
    closePopovers() { this.contextMenuThreadID = ""; },
  };

  await SidebarView.prototype.manageThread.call(view, "delete");
  assert.equal(deleted, 0);
  assert.equal(removed, 0);
});

test("archiving a selected task removes it only after the server succeeds", async () => {
  const calls = [];
  const view = {
    contextMenuThreadID: "task-1",
    destroyed: false,
    running: false,
    creatingTask: false,
    contextTransitioning: false,
    managingThreadID: "",
    threads: [{ id: "task-1", name: "My task" }],
    thread: null,
    client: { archiveThread: async (id) => calls.push(["archive", id]) },
    manager: { handleThreadRemoved: (id) => calls.push(["remove", id]) },
    closePopovers() { this.contextMenuThreadID = ""; },
  };

  await SidebarView.prototype.manageThread.call(view, "archive");
  assert.deepEqual(calls, [["archive", "task-1"], ["remove", "task-1"]]);
  assert.equal(view.managingThreadID, "");
});

test("the task picker loads further batches when scrolled near the bottom", () => {
  let renders = 0;
  const list = { scrollTop: 0, clientHeight: 346, scrollHeight: 1520 };
  const view = {
    elements: { threadList: list },
    threadListLimit: 40,
    threadListMatchCount: 95,
    renderThreadPicker: () => renders++,
  };

  SidebarView.prototype.loadMoreThreads.call(view);
  assert.equal(view.threadListLimit, 40);
  assert.equal(renders, 0);

  list.scrollTop = 1120;
  SidebarView.prototype.loadMoreThreads.call(view);
  assert.equal(view.threadListLimit, 80);
  assert.equal(renders, 1);

  SidebarView.prototype.loadMoreThreads.call(view);
  assert.equal(view.threadListLimit, 120);
  assert.equal(renders, 2);

  SidebarView.prototype.loadMoreThreads.call(view);
  assert.equal(view.threadListLimit, 120);
  assert.equal(renders, 2);
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

test("sending snapshots visible selections into both the message and history request", async () => {
  const view = titleSendView(false);
  view.manager.addSelection(2, { text: "A pinned sample passage.", pageNumber: 3 });
  view.manager.setLiveSelection(2, { text: "A current sample passage.", pageNumber: 4 });
  let optimistic;
  let sent;
  view.appendOptimisticUser = (text, images, selections) => { optimistic = { text, images, selections }; };
  view.client.startTurn = async args => { sent = args; return { id: "selection-turn" }; };
  await SidebarView.prototype.send.call(view);
  assert.deepEqual(optimistic.selections, sent.selections);
  assert.deepEqual(sent.selections.map(selection => selection.text), [
    "A current sample passage.", "A pinned sample passage.",
  ]);
  assert.match(sent.context.zotero.value, /A current sample passage/u);
  assert.deepEqual(view.manager.getSelections(2), []);
  assert.equal(view.manager.getLiveSelection(2), null);
});

test("editing retains the original quotes even when preparing the edited chat clears edit state", async () => {
  const view = titleSendView(false);
  const selection = { id: "original", text: "An original quoted passage.", pageNumber: 2 };
  view.editingMessage = { selections: [selection] };
  view.threadID = "existing-chat";
  view.prepareEditedThread = async () => { view.editingMessage = null; return {}; };
  let sent;
  view.client.startTurn = async args => { sent = args; return { id: "edited-turn" }; };
  await SidebarView.prototype.send.call(view);
  assert.equal(sent.selections[0].text, selection.text);
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

test("invalidates every document-scoped UI state before loading a new item", () => {
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

test("custom working directories keep each document's chat filter separate", () => {
  const previous = global.PathUtils;
  global.PathUtils = path.posix;
  try {
    const manager = createManager();
    const first = { libraryID: 1, itemKey: "FIRST", pdfPath: "/pdf/first.pdf" };
    const second = { libraryID: 1, itemKey: "SECOND", pdfPath: "/pdf/second.pdf" };
    assert.equal(manager.paperDirectory(first), "/pdf");
    manager.setPreference("workingDirectory", "/zotero/workspace");
    assert.notEqual(manager.paperDirectory(first), manager.paperDirectory(second));
    assert.ok(manager.paperDirectory(first).startsWith("/zotero/workspace/papers/"));
  } finally { global.PathUtils = previous; }
});

test("reader popup observer options are cloned into the reader compartment", () => {
  const previous = global.Cu;
  const manager = createManager();
  const options = { childList: true, subtree: true };
  const documentElement = {};
  let observed;
  const win = {
    MutationObserver: class {
      observe(target, init) { observed = [target, init]; }
      disconnect() {}
    },
    addEventListener() {}, removeEventListener() {},
  };
  global.Cu = { cloneInto(value, target) {
    assert.equal(target, win);
    assert.deepEqual(value, options);
    return options;
  } };
  try {
    manager.watchReaderSelectionPopup({ defaultView: win, documentElement }, { isConnected: true }, 7, "selection");
    assert.equal(observed[0], documentElement);
    assert.equal(observed[1], options);
    assert.equal(manager.selectionPopupCleanups.size, 1);
    for (const cleanup of manager.selectionPopupCleanups) cleanup();
  } finally { global.Cu = previous; }
});

test("popup tracking failures are reported without aborting subsequent plugin listeners", () => {
  const manager = createManager();
  const selection = manager.setLiveSelection(7, { text: "selected text" });
  const failure = new Error("reader compartment rejected observer options");
  const logged = [];
  let disconnected = false;
  manager.log = (message, error) => logged.push(error);
  const doc = { documentElement: {}, defaultView: {
    MutationObserver: class {
      observe() { throw failure; }
      disconnect() { disconnected = true; }
    },
    removeEventListener() {},
  } };
  let translationListenerRan = false;
  const listeners = [
    () => manager.watchReaderSelectionPopup(doc, { isConnected: true }, 7, selection.id),
    () => { translationListenerRan = true; },
  ];
  for (const listener of listeners) listener();
  assert.equal(translationListenerRan, true);
  assert.deepEqual(logged, [failure]);
  assert.equal(disconnected, true);
  assert.equal(manager.selectionPopupCleanups.size, 0);
  assert.equal(manager.getLiveSelection(7), null);
});

test("adding a PDF selection sends a single-click event that opens the Codex sidenav", async () => {
  const previous = global.Zotero;
  const manager = createManager();
  manager.paneID = "codex-pane";
  let scrolled = false;
  const button = {
    dataset: { pane: manager.paneID },
    dispatchEvent(event) { if (event.button === 0 && event.detail === 1) scrolled = true; },
  };
  const details = { tabID: "reader", sidenav: { querySelectorAll: () => [button] } };
  global.Zotero = { getMainWindows: () => [{
    document: { querySelectorAll: () => [details] },
    MouseEvent: class { constructor(type, options) { Object.assign(this, options); this.type = type; } },
  }] };
  try {
    assert.equal(await manager.revealReaderPane({ tabID: "reader" }), true);
    assert.equal(scrolled, true);
  } finally { global.Zotero = previous; }
});

function pdfCacheFixture(t) {
  const priorZotero = global.Zotero;
  const priorIO = global.IOUtils;
  t.after(() => { global.Zotero = priorZotero; global.IOUtils = priorIO; });
  const f = {
    manager: createManager(), context: { attachmentID: 2, pdfPath: "/fixtures/sample.pdf" },
    stat: { size: 1000, lastModified: 10 }, calls: 0,
    result: { text: "1 Introduction\nA sample method explains generic steps.\f2 Results\nThe result remains stable.", extractedPages: 2 },
  };
  global.IOUtils = { stat: async () => ({ ...f.stat }) };
  global.Zotero = { PDFWorker: { getFullText: async () => { f.calls++; return f.result; } } };
  return f;
}

const nextTick = () => new Promise(resolve => setImmediate(resolve));

function deferredResult() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("unchanged PDF text is shared while questions and reader pages remain fresh", async t => {
  const f = pdfCacheFixture(t);
  const evidence = global.ZoteroCodexModules.Sidebar.pdfEvidenceForQuestion;
  const load = context => f.manager.getPdfText(context);
  const first = await evidence(f.context, "method", { pageNumber: 1 }, { fullText: load });
  const second = await evidence(f.context, "result", { pageNumber: 2 }, { fullText: load });
  assert.equal(f.calls, 1);
  assert.match(first, /Current page text:\n1 Introduction/);
  assert.match(second, /Current page text:\n2 Results/);
  assert.match(first, /Excerpt, physical PDF page 1/);
  assert.match(second, /Excerpt, physical PDF page 2/);
});

test("concurrent PDF requests share extraction and changed versions cannot retain old results", async t => {
  const f = pdfCacheFixture(t);
  const old = deferredResult();
  global.Zotero.PDFWorker.getFullText = () => { f.calls++; return f.calls === 1 ? old.promise : Promise.resolve(f.result); };
  const first = f.manager.getPdfText(f.context);
  const second = f.manager.getPdfText(f.context);
  await nextTick();
  assert.equal(f.calls, 1);
  f.stat.lastModified++;
  await f.manager.getPdfText(f.context);
  old.resolve({ text: "Old sample content", extractedPages: 1 });
  await assert.rejects(first, /PDF changed/);
  await assert.rejects(second, /PDF changed/);
  assert.equal(await f.manager.getPdfText(f.context), f.result);
  assert.equal(f.calls, 2);
  f.stat.size++;
  await f.manager.getPdfText(f.context);
  await f.manager.getPdfText({ ...f.context, pdfPath: "/fixtures/replaced.pdf" });
  assert.equal(f.calls, 4);
});

test("PDF extraction failures retry and unverifiable files bypass the cache", async t => {
  const f = pdfCacheFixture(t);
  global.Zotero.PDFWorker.getFullText = () => { if (++f.calls === 1) throw new Error("Fixture unavailable"); return Promise.resolve(f.result); };
  await assert.rejects(f.manager.getPdfText(f.context), /Fixture unavailable/);
  await f.manager.getPdfText(f.context);
  await f.manager.getPdfText(f.context);
  assert.equal(f.calls, 2);
  global.IOUtils.stat = async () => { throw new Error("Fixture stat unavailable"); };
  await f.manager.getPdfText(f.context);
  await f.manager.getPdfText(f.context);
  assert.equal(f.calls, 4);
});

test("PDF text larger than the former 16 MiB budget is reused", async t => {
  const f = pdfCacheFixture(t);
  f.result = { text: "x".repeat(10 * 1024 * 1024), extractedPages: 1 };
  await f.manager.getPdfText(f.context);
  await f.manager.getPdfText(f.context);
  assert.equal(f.calls, 1);
});

test("PDF retention obeys both entry and byte budgets", async t => {
  const f = pdfCacheFixture(t);
  for (let id = 1; id <= 9; id++) await f.manager.getPdfText({ ...f.context, attachmentID: id });
  assert.equal(f.manager.pdfTextCache.size, 8);
  await f.manager.getPdfText({ ...f.context, attachmentID: 1 });
  assert.equal(f.calls, 10);
  f.result = { text: "x".repeat(17 * 1024 * 1024), extractedPages: 1 };
  await f.manager.getPdfText({ ...f.context, attachmentID: 21 });
  await f.manager.getPdfText({ ...f.context, attachmentID: 22 });
  assert.equal(f.manager.pdfTextCache.size, 1);
  f.result = { text: "x".repeat(33 * 1024 * 1024), extractedPages: 1 };
  await f.manager.getPdfText({ ...f.context, attachmentID: 23 });
  await f.manager.getPdfText({ ...f.context, attachmentID: 23 });
  assert.equal(f.manager.pdfTextCache.has(23), false);
});

test("late PDF extraction cannot resurrect a shutdown cache", async t => {
  const f = pdfCacheFixture(t);
  const pending = deferredResult();
  global.Zotero.PDFWorker.getFullText = () => pending.promise;
  global.Zotero.Reader = { unregisterEventListener() {} };
  const request = f.manager.getPdfText(f.context);
  await nextTick();
  await f.manager.shutdown();
  pending.resolve(f.result);
  await request;
  assert.equal(f.manager.pdfTextCache.size, 0);
  assert.equal(f.manager.pdfTextRequests.size, 0);
});

test("send shows preparation immediately, keeps its draft and rejects duplicate submissions", async t => {
  const f = pdfCacheFixture(t);
  const pending = deferredResult();
  global.Zotero.PDFWorker.getFullText = () => { f.calls++; return pending.promise; };
  const view = titleSendView();
  view.manager = f.manager;
  const phases = [];
  let turns = 0, threads = 0;
  view.showPendingResponse = phase => phases.push(phase);
  view.client.startThread = async () => { threads++; return { id: "fixture-thread" }; };
  view.client.startTurn = async () => { turns++; return { id: "fixture-turn" }; };
  const first = SidebarView.prototype.send.call(view);
  assert.deepEqual(phases, ["preparing"]);
  assert.ok(view.elements.input.value);
  assert.equal(view.manager.preparations.size, 1);
  await SidebarView.prototype.send.call(view);
  await nextTick();
  assert.equal(threads, 1);
  assert.equal(turns, 0);
  const other = titleSendView();
  other.manager = view.manager;
  await SidebarView.prototype.send.call(other);
  pending.resolve(f.result);
  await first;
  assert.equal(f.calls, 1);
  assert.equal(turns, 1);
  assert.equal(view.manager.preparations.size, 0);
});

test("preparation failures release the reservation and preserve the draft", async () => {
  const view = titleSendView();
  const original = view.elements.input.value;
  view.client.startThread = async () => { throw new Error("Fixture connection failed"); };
  view.showError = () => {};
  view.selectThread = async () => {};
  await SidebarView.prototype.send.call(view);
  assert.equal(view.manager.preparations.size, 0);
  assert.equal(view.elements.input.value, original);
});

test("an old preparation completion cannot clear a new paper draft or reservation", async t => {
  const f = pdfCacheFixture(t);
  const pending = deferredResult();
  global.Zotero.PDFWorker.getFullText = () => pending.promise;
  const view = titleSendView();
  view.manager = f.manager;
  view.isCurrentContext = (epoch, context) => epoch === view.contextEpoch && context === view.context;
  let turns = 0;
  view.client.startTurn = async () => { turns++; return { id: "fixture-turn" }; };
  const first = SidebarView.prototype.send.call(view);
  await nextTick();
  view.contextEpoch++;
  view.context = { libraryID: 1, itemID: 42 };
  view.threadID = "other-thread";
  view.elements.input.value = "New sample draft";
  const newer = f.manager.beginPreparation(view);
  assert.ok(newer);
  pending.resolve(f.result);
  await first;
  assert.equal(turns, 0);
  assert.equal(view.elements.input.value, "New sample draft");
  assert.equal(f.manager.preparationFor(view), newer);
  f.manager.finishPreparation(newer);
});


test("failed turn submission restores the draft and reloads stored history", async () => {
  const view = titleSendView();
  const draft = view.elements.input.value;
  let reloaded = false;
  view.client.startTurn = async () => { throw new Error("Fixture submission failed"); };
  view.showError = () => {};
  view.selectThread = async () => {
    assert.equal(view.manager.preparationFor(view), undefined);
    reloaded = true;
  };
  await SidebarView.prototype.send.call(view);
  assert.equal(reloaded, true);
  assert.equal(view.elements.input.value, draft);
  assert.equal(view.manager.preparations.size, 0);
});

test("failed send cleanup leaves a newer preparation label visible", async () => {
  const view = titleSendView();
  view.client.startTurn = async () => { throw new Error("Fixture submission failed"); };
  view.showError = () => {};
  let phase;
  let newer;
  view.showPendingResponse = value => { phase = value; };
  view.hidePendingResponse = () => { phase = "hidden"; };
  view.selectThread = async () => {
    newer = view.manager.beginPreparation(view);
    view.showPendingResponse("preparing");
  };
  await SidebarView.prototype.send.call(view);
  assert.equal(view.manager.preparationFor(view), newer);
  assert.equal(phase, "preparing");
  view.manager.finishPreparation(newer);
});

function scopedPdfFixture(t) {
  const previous = global.Zotero;
  t.after(() => { global.Zotero = previous; });
  const f = { read: [], fullCalls: 0, outline: [], current: true };
  f.texts = new Map([[1, "1 Opening\nGeneric opening text for the sample document."],
    [3, "2 Method\nThe sample method uses a sequence of generic steps."],
    [4, "2.1 Detail\nThe detail explains the selected sample step."],
    [5, "The sample method continues on this physical page."],
    [6, "3 Closing\nThe sample document ends with a generic closing."]]);
  f.pdf = {
    numPages: 10,
    getPageData: async ({ pageIndex }) => {
      f.read.push(pageIndex + 1);
      return { chars: [...(f.texts.get(pageIndex + 1) || "")].map(u => ({ u })) };
    },
    getOutline: async () => f.outline,
    getDestination: async name => f.destinations?.[name],
  };
  f.viewer = { currentPageNumber: 4 };
  f.last = { _pageLabels: ["i", "ii", "1", "2"], _iframeWindow: {
    PDFViewerApplication: { pdfDocument: f.pdf, pdfViewer: f.viewer },
  } };
  f.reader = { itemID: 2, _internalReader: { _lastView: f.last,
    _primaryView: { _iframeWindow: { PDFViewerApplication: { pdfViewer: { currentPageNumber: 1 } } } } } };
  global.Zotero = {
    Reader: { getByTabID: () => f.reader },
    PDFWorker: { getFullText: async () => {
      f.fullCalls++;
      return { text: "1 Full document\nA generic full-document fallback contains sample text.", extractedPages: 1 };
    } },
  };
  f.context = { tabType: "reader", attachmentID: 2, pdfPath: "/fixtures/scoped.pdf" };
  f.doc = { defaultView: { Zotero_Tabs: { selectedID: "sample-reader" } } };
  f.source = () => global.ZoteroCodexModules.Sidebar.capturePdfReaderSource(f.context, f.doc);
  f.evidence = (question, options = {}) => {
    const source = f.source();
    return global.ZoteroCodexModules.Sidebar.pdfEvidenceForQuestion(f.context, question, source?.currentPage, {
      source, isCurrent: () => f.current, ...options,
    });
  };
  return f;
}

test("scoped current-page evidence reads one captured split-view page without full extraction", async t => {
  const f = scopedPdfFixture(t);
  const view = titleSendView();
  view.context = f.context;
  view.doc = f.doc;
  view.elements.input.value = "解释当前页";
  view.client.startThread = async () => {
    f.viewer.currentPageNumber = 6;
    return { id: "sample-thread" };
  };
  let sent;
  view.client.startTurn = async args => { sent = args; return { id: "sample-turn" }; };
  await SidebarView.prototype.send.call(view);
  assert.deepEqual(f.read, [4]);
  assert.equal(f.fullCalls, 0);
  assert.match(sent.context.zotero.value, /physical PDF page 4; printed label 2/);
  assert.match(sent.context.zotero.value, /physical PDF page 4:\n2\.1 Detail/);
  assert.match(sent.context.zotero.value, /not a full-document search/);
  assert.equal(view.manager.pdfTextCache.size, 0);
});

test("scoped selections bypass PDF availability and global requests retain full extraction", async t => {
  const f = scopedPdfFixture(t);
  const selection = [{ text: "Selected generic sample passage.", pageNumber: 4 }];
  const evidence = global.ZoteroCodexModules.Sidebar.pdfEvidenceForQuestion;
  global.Zotero.PDFWorker = null;
  const selected = await evidence({}, "Explain the selected text", null, { selections: selection });
  assert.match(selected, /selected text/i);
  global.Zotero.PDFWorker = { getFullText: async () => {
    f.fullCalls++;
    return { text: "Full document sample text remains available.", extractedPages: 1 };
  } };
  await f.evidence("Summarize the whole paper, including this page", { selections: selection });
  await f.evidence("Explain the method", { selections: selection });
  assert.equal(f.fullCalls, 2);
  assert.deepEqual(f.read, []);
});

test("scoped numbered sections include their same-level boundary page", async t => {
  const f = scopedPdfFixture(t);
  f.outline = [
    { title: "1 Opening", dest: [0] },
    { title: "2 Method", dest: [2], items: [{ title: "2.1 Detail", dest: [3] }] },
    { title: "3 Closing", dest: [5] },
  ];
  const value = await f.evidence("Explain section 2");
  assert.deepEqual([...new Set(f.read)].sort((a, b) => a - b), [3, 4, 5, 6]);
  assert.equal(f.fullCalls, 0);
  assert.match(value, /physical PDF pages 3 to 6/);
  assert.match(value, /physical PDF page 3/);
  assert.match(value, /physical PDF page 5:\nThe sample method continues/);
});

test("scoped section anchors verify both their number and heading title", async t => {
  const f = scopedPdfFixture(t);
  f.outline = [{ title: "Method", dest: "section.2" }, { title: "Closing", dest: "section.3" }];
  f.destinations = { "section.2": [2], "section.3": [5] };
  const value = await f.evidence("解释第2章");
  assert.equal(f.fullCalls, 0);
  assert.match(value, /physical PDF pages 3 to 6/);
  f.texts.set(3, "2 Different heading\nThe generic text uses a different heading.");
  await f.evidence("Explain section 2");
  assert.equal(f.fullCalls, 1);
});

test("scoped ambiguous locators and unreliable outlines use full evidence", async t => {
  const f = scopedPdfFixture(t);
  const queries = ["Compare this page with section 2", "Explain sections 2 and 3", "解释第2到3章", "Compare section 2 and section 3"];
  for (const q of queries) await f.evidence(q);
  f.outline = [{ title: "2 Method", dest: [2] }, { title: "2 Method", dest: [6] }];
  await f.evidence("Explain section 2");
  f.outline = [{ title: "2 Method", dest: [2] }, { title: "3 Closing" }];
  await f.evidence("Explain section 2");
  f.outline = [{ title: "Method", dest: "section*.2" }];
  await f.evidence("Explain section 2");
  assert.equal(f.fullCalls, 7);
});

test("scoped empty pages keep OCR guidance local to the requested page", async t => {
  const f = scopedPdfFixture(t);
  f.texts.set(4, "");
  const value = await f.evidence("Explain this page");
  assert.equal(f.fullCalls, 0);
  assert.match(value, /physical PDF page 4/);
  assert.match(value, /requested page/i);
  assert.doesNotMatch(value, /may be a scanned\/image-only document/);
});

test("scoped stale page extraction aborts without starting full extraction", async t => {
  const f = scopedPdfFixture(t);
  const pending = deferredResult();
  f.pdf.getPageData = () => pending.promise;
  const value = f.evidence("Explain this page");
  await nextTick();
  f.current = false;
  pending.resolve({ chars: [{ u: "A" }] });
  assert.equal(await value, null);
  assert.equal(f.fullCalls, 0);
});

test("scoped fallback extraction stops between awaits when the reader changes", async t => {
  const f = scopedPdfFixture(t);
  const pending = deferredResult();
  delete f.pdf.getPageData;
  f.pdf.getPage = () => pending.promise;
  let textReads = 0;
  const value = f.evidence("Explain this page");
  await nextTick();
  f.current = false;
  pending.resolve({ getTextContent: async () => { textReads++; return { items: [] }; } });
  assert.equal(await value, null);
  assert.equal(textReads, 0);
  assert.equal(f.fullCalls, 0);
});

test("scoped page text does not require PDFWorker and invalid sources cannot leak page context", async t => {
  const f = scopedPdfFixture(t);
  global.Zotero.PDFWorker = null;
  assert.match(await f.evidence("Explain this page"), /physical PDF page 4:\n2\.1 Detail/);
  assert.deepEqual(f.read, [4]);
  const source = f.source();
  Object.defineProperty(f.last, "_iframeWindow", { get() { throw new Error("Fixture reader closed"); } });
  const evidence = global.ZoteroCodexModules.Sidebar.pdfEvidenceForQuestion;
  assert.equal(await evidence(f.context, "Explain this page", source.currentPage, { source }), null);
});

test("scoped same-page boundaries read once and oversized ranges retain full fallback", async t => {
  const f = scopedPdfFixture(t);
  f.outline = [{ title: "2 Method", dest: [2] }, { title: "3 Closing", dest: [2] }];
  f.texts.set(3, "2 Method\nThe sample method ends here.\n3 Closing\nClosing starts on the same page.");
  const local = await f.evidence("Explain section 2");
  assert.deepEqual(f.read, [3]);
  assert.match(local, /physical PDF pages 3 to 3/);
  f.pdf.numPages = 200;
  f.outline = [{ title: "2 Method", dest: [2] }, { title: "3 Closing", dest: [100] }];
  await f.evidence("Explain section 2");
  assert.equal(f.fullCalls, 1);
});

test("scoped numeric outline titles and named anchors must agree", async t => {
  const f = scopedPdfFixture(t);
  f.outline = [{ title: "2.2 Method", dest: "section.2" }, { title: "2 Method", dest: [2] }];
  f.destinations = { "section.2": [2] };
  await f.evidence("Explain section 2");
  assert.equal(f.fullCalls, 1);
  assert.deepEqual(f.read, []);
});

test("scoped outline verification requires a heading rather than a prose mention", async t => {
  const f = scopedPdfFixture(t);
  f.outline = [{ title: "Method", dest: "section.2" }, { title: "Closing", dest: "section.3" }];
  f.destinations = { "section.2": [2], "section.3": [5] };
  f.texts.set(3, "The sample refers to 2 Method while discussing other text.");
  await f.evidence("Explain section 2");
  assert.equal(f.fullCalls, 1);
  f.texts.set(3, "2. Method\nThe standalone sample heading uses punctuation.");
  await f.evidence("Explain section 2");
  assert.equal(f.fullCalls, 1);
});

test("scoped requests with extra page or appendix locators retain full evidence", async t => {
  const f = scopedPdfFixture(t);
  f.outline = [{ title: "2 Method", dest: [2] }, { title: "3 Closing", dest: [5] }];
  for (const question of ["Compare this page with page 10", "比较当前页和第10页", "Compare section 2 with appendix A", "比较第2章与附录A"]) {
    await f.evidence(question);
  }
  assert.equal(f.fullCalls, 4);
  assert.deepEqual(f.read, []);
});

test("scoped long current-page questions retain relevant text near the bottom", async t => {
  const f = scopedPdfFixture(t);
  f.texts.set(4, "Opening text about a generic page.\n".repeat(150)
    + "The lavender rule uses a sample threshold near the bottom of this page.");
  const value = await f.evidence("Explain the lavender rule on this page");
  assert.match(value, /The lavender rule uses a sample threshold/);
  assert.match(value, /physical PDF page 4/);
  assert.ok(value.length <= 3000);
  assert.equal(f.fullCalls, 0);
  const generic = await f.evidence("Explain the current page");
  assert.match(generic, /Opening text, physical PDF page 4:\nOpening text about a generic page/);
});

test("scoped comparisons with an unresolved second region retain full evidence", async t => {
  const f = scopedPdfFixture(t);
  for (const question of ["Compare this page with the conclusion", "Contrast this page and the introduction", "This page versus the introduction", "比较当前页和结论", "对比本页与引言"]) {
    await f.evidence(question);
  }
  assert.equal(f.fullCalls, 5);
  assert.deepEqual(f.read, []);
});

test("scoped current-page arithmetic and dates do not become section ranges", async t => {
  const f = scopedPdfFixture(t);
  for (const question of ["解释当前页里的1/2和2/3", "Explain the current page on2026/11/27", "不用读全文，解释当前页", "Do not read the whole document. Explain this page."]) {
    await f.evidence(question);
  }
  assert.deepEqual(f.read, [4, 4, 4, 4]);
  assert.equal(f.fullCalls, 0);
  await f.evidence("Explain section 2.1 to 2.3");
  await f.evidence("解释第2.1到2.3节");
  assert.equal(f.fullCalls, 2);
});
