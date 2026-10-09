const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"), CodexClient: { getHomeDirectory: () => "/tmp" }, Markdown: {},
};
require("../content/sidebar.js");
const { SidebarManager, SidebarView } = global.ZoteroCodexModules.Sidebar;

function element() {
  return {
    value: "", disabled: false, hidden: false,
    setAttribute() {}, removeAttribute() {}, focus() {}, classList: { add() {}, remove() {} },
  };
}

function session() {
  const preferences = new Map();
  const listeners = new Set();
  const calls = [];
  const notifications = [];
  const client = {
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    emit: (method, params) => {
      for (const listener of listeners) listener({ type: "notification", method, params });
    },
    readThread: async (id) => ({ id, name: `Chat ${id}`, turns: [] }),
    startTurn: async ({ threadID }) => {
      calls.push(["start", threadID]);
      client.emit("turn/started", { threadId: threadID, turn: { id: `turn-${threadID}` } });
      return { id: `turn-${threadID}` };
    },
    interruptTurn: async (threadID, turnID) => calls.push(["stop", threadID, turnID]),
  };
  const manager = new SidebarManager({
    client, getPreference: (key) => preferences.get(key),
    setPreference: (key, value) => preferences.set(key, value),
    log: (_message, error) => { if (error) throw error; },
  });
  manager.notifyTurnCompleted = async (run, status) => notifications.push([run.threadID, status]);
  return { manager, client, calls, notifications };
}

function viewFor(manager, id = "A") {
  const elements = Object.fromEntries([
    "input", "sendButton", "newThreadButton", "threadButton", "contextAddButton",
    "contextModeButton", "imageOption", "generateImageOption", "imageInput", "modelTrigger",
    "modelChoice", "effortChoice", "modelNextTurnHint", "reconnectButton", "transcript",
  ].map((name) => [name, element()]));
  const view = {
    manager, client: manager.client, elements, threadID: id, thread: { id, name: `Chat ${id}` },
    context: { itemID: 1, attachmentID: 2, title: "Test paper" }, contextEpoch: 1,
    loadSerial: 0, threadRefreshSerial: 0, models: [], images: [], pendingRequests: new Map(),
    threads: [], selectedEffort: "low", running: false, activeTurnID: "", destroyed: false,
    creatingTask: false, contextTransitioning: false,
    doc: { hidden: false, hasFocus: () => true }, body: { getClientRects: () => [{}] },
    setRunning: SidebarView.prototype.setRunning,
    updateComposerState: SidebarView.prototype.updateComposerState,
    isThreadVisible: SidebarView.prototype.isThreadVisible,
    isCurrentContext: SidebarView.prototype.isCurrentContext,
    selectThread: SidebarView.prototype.selectThread,
    setStatus() {}, updateThreadHeader() {}, renderRequests() {}, renderThreadPicker() {}, closePopovers() {},
    clearResponseScrollSpace() {}, renderContextAttachment() {}, renderSelections() {}, cancelEdit() {},
    hidePendingResponse() {}, showPendingResponse() {}, renderEmpty() {},
    applyModelSelection() {}, renderTranscript(entries) { this.entries = entries; },
    connectionLabel: () => "", resizeComposer() {}, appendOptimisticUser() {},
    renderStreamingDelta(text) { this.delta = (this.delta || "") + text; },
    refreshThreads: async () => {}, showError(error) { throw error; },
  };
  manager.views.set(view, view);
  view.unsubscribe = manager.client.subscribe((event) => SidebarView.prototype._handleClientEvent.call(view, event));
  return view;
}

test("keeps chat switching available while a reply is running", () => {
  const { manager } = session();
  const view = viewFor(manager);
  view.setRunning(true);
  assert.equal(view.elements.threadButton.disabled, false);
  assert.equal(view.elements.newThreadButton.disabled, false);
  assert.equal(view.elements.sendButton.textContent, "■");
});

test("opening settings preserves the draft and a background completion keeps settings open", async () => {
  const { manager, client } = session();
  const view = viewFor(manager);
  Object.assign(view.elements, {
    root: { dataset: {} }, chatView: element(), settingsView: element(), topbar: element(), moreButton: element(),
  });
  view.elements.settingsView.hidden = true;
  view.elements.input.value = "Keep my next question";
  manager.trackTurn("A", { turnID: "turn-A" });
  SidebarView.prototype.showPage.call(view, "settings");
  assert.equal(view.elements.chatView.hidden, true);
  assert.equal(view.running, true);
  assert.equal(view.elements.input.value, "Keep my next question");
  client.emit("turn/completed", { threadId: "A", turn: { id: "turn-A", status: "completed" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.elements.settingsView.hidden, false);
  assert.equal(view.elements.chatView.hidden, true);
  assert.equal(view.elements.input.value, "Keep my next question");
  assert.equal(view.running, false);
  assert.equal(manager.runningTurns.size, 0);
});

test("a new chat has a send button while the previous reply keeps running", () => {
  const { manager } = session();
  const view = viewFor(manager);
  manager.trackTurn("A", { turnID: "turn-A" });
  SidebarView.prototype.newTask.call({
    resetConversation: (options) => SidebarView.prototype.resetConversation.call(view, options),
  });
  assert.equal(view.threadID, "");
  assert.equal(view.running, false);
  assert.equal(view.elements.sendButton.textContent, "↑");
  assert.equal(manager.runningTurns.has("A"), true);
});

test("switches between concurrent replies and notifies once without disturbing the foreground chat", async () => {
  const { manager, client, calls, notifications } = session();
  const view = viewFor(manager);
  view.elements.input.value = "Explain paper A";
  await SidebarView.prototype.send.call(view);
  await view.selectThread("B");
  assert.equal(view.running, false);
  assert.equal(manager.runningTurns.has("A"), true);
  view.elements.input.value = "Explain paper B";
  await SidebarView.prototype.send.call(view);
  assert.equal(manager.runningTurns.size, 2);
  await view.selectThread("A");
  assert.equal(view.running, true);
  assert.equal(view.activeTurnID, "turn-A");
  await SidebarView.prototype.stop.call(view);
  assert.deepEqual(calls.at(-1), ["stop", "A", "turn-A"]);
  client.emit("item/agentMessage/delta", { threadId: "B", delta: "Background text" });
  assert.equal(view.delta, undefined);
  const completed = { threadId: "B", turn: { id: "turn-B", status: "completed" } };
  client.emit("turn/completed", completed);
  client.emit("turn/completed", completed);
  assert.deepEqual(notifications, [["B", "completed"]]);
  assert.equal(view.threadID, "A");
  assert.equal(view.running, true);
  assert.equal(view.activeTurnID, "turn-A");
  assert.equal(manager.runningTurns.size, 1);
});

test("retains background turns after the originating view is closed and names each new chat", () => {
  const { manager, client, notifications } = session();
  const titles = [];
  manager.autoNameThread = async (request) => titles.push(request.threadID);
  const view = viewFor(manager);
  manager.trackTurn("A", { turnID: "a", titleRequest: { threadID: "A" } });
  manager.trackTurn("B", { turnID: "b", titleRequest: { threadID: "B" } });
  view.unsubscribe();
  manager.views.delete(view);
  client.emit("turn/completed", { threadId: "A", turn: { id: "a", status: "completed" } });
  client.emit("turn/completed", { threadId: "B", turn: { id: "b", status: "completed" } });
  assert.deepEqual(notifications, [["A", "completed"], ["B", "completed"]]);
  assert.deepEqual(titles, ["A", "B"]);
});

test("does not announce foreground or interrupted replies and ignores stale completions", () => {
  const { manager, client, notifications } = session();
  const view = viewFor(manager);
  view.unsubscribe();
  manager.trackTurn("A", { turnID: "a" });
  client.emit("turn/completed", { threadId: "A", turn: { id: "older", status: "completed" } });
  assert.equal(manager.runningTurns.has("A"), true);
  client.emit("turn/completed", { threadId: "A", turn: { id: "a", status: "completed" } });
  manager.trackTurn("B", { turnID: "b" });
  client.emit("turn/completed", { threadId: "B", turn: { id: "b", status: "interrupted" } });
  assert.deepEqual(notifications, []);
  assert.equal(manager.runningTurns.size, 0);
});

test("a late turn-start response cannot change the newly selected chat", async () => {
  const { manager, client } = session();
  const view = viewFor(manager);
  let resolveStart;
  client.startTurn = () => new Promise((resolve) => { resolveStart = resolve; });
  view.elements.input.value = "Explain A";
  const sending = SidebarView.prototype.send.call(view);
  await view.selectThread("B");
  resolveStart({ id: "turn-A" });
  await sending;
  assert.equal(view.threadID, "B");
  assert.equal(view.activeTurnID, "");
  assert.equal(view.running, false);
  assert.equal(manager.runningTurns.get("A").turnID, "turn-A");
});

test("does not revive a completed turn from a stale history response", async () => {
  const { manager, client } = session();
  const view = viewFor(manager);
  manager.completedTurnIDs.add("turn-B");
  client.readThread = async () => ({ id: "B", turns: [{ id: "turn-B", status: "inProgress" }] });
  await view.selectThread("B");
  assert.equal(view.running, false);
  assert.equal(manager.runningTurns.size, 0);
});

test("native notification uses the chat title and opens the corresponding chat on click", async () => {
  const { manager } = session();
  const previous = { Cc: global.Cc, Ci: global.Ci };
  let args;
  let opened;
  const run = { threadID: "A", label: "CREATE：知识迁移", context: {} };
  manager.openTurnNotification = async (value) => { opened = value; };
  try {
    global.Ci = { nsIAlertsService: {} };
    global.Cc = { "@mozilla.org/alerts-service;1": {
      getService: () => ({ showAlertNotification: (...value) => { args = value; } }),
    } };
    await SidebarManager.prototype.notifyTurnCompleted.call(manager, run, "completed");
    assert.equal(args[1], "Codex reply ready");
    assert.equal(args[2], "CREATE：知识迁移");
    assert.equal(args[3], true);
    args[5].observe(null, "alertclickcallback");
    assert.equal(opened, run);
  }
  finally { Object.assign(global, previous); }
});
