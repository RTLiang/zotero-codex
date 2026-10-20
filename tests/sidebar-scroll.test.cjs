const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = { Protocol: require("../content/protocol.js"), CodexClient: {}, Markdown: {} };
require("../content/localization.js");
require("../content/sidebar.js");
const { SidebarView } = global.ZoteroCodexModules.Sidebar;

function completedReply({ replyHeight, scrollTop = 2000 }) {
  let padding = 550, position = scrollTop, heights = [2000, 50, replyHeight];
  const transcript = {
    clientHeight: 600,
    get scrollHeight() { return heights.reduce((sum, height) => sum + height, 0) + padding; },
    get scrollTop() { return Math.min(position, Math.max(0, this.scrollHeight - this.clientHeight)); },
    set scrollTop(value) { position = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); },
    style: { removeProperty() { padding = 16; } },
    replaceChildren() { heights = []; position = Math.min(position, Math.max(0, padding - 600)); },
  };
  const messages = [
    { type: "userMessage", content: [{ type: "text", text: "Earlier question" }] },
    { type: "agentMessage", text: "Earlier answer", phase: "final" },
    { type: "userMessage", content: [{ type: "text", text: "Give a short answer" }] },
    { type: "agentMessage", text: "A short fixture answer.", phase: "final" },
  ];
  const view = Object.assign(Object.create(SidebarView.prototype), {
    elements: { transcript }, context: {}, contextEpoch: 1, threadID: "fixture-chat", activeTurnID: "fixture-turn",
    loadSerial: 0, threadRefreshSerial: 0, pendingRequests: new Map(), images: [],
    manager: { runningTurns: new Map(), completedTurnIDs: new Set(), setPreference() {}, setPaperThread() {} },
    client: { readThread: async id => ({ id, turns: [{ id: "fixture-turn", status: "completed", items: messages }] }) },
    appendEntry(entry) { heights.push(entry.text === "Earlier answer" ? 1960
      : entry.text === "Earlier question" ? 40 : entry.role === "user" ? 50 : replyHeight); },
    disposeInteractiveViews() {}, renderContextAttachment() {}, cancelEdit() {}, hidePendingResponse() {},
    showPage() {}, setRunning() {}, updateThreadHeader() {}, renderRequests() {}, setStatus() {}, applyModelSelection() {},
    refreshThreads: async () => {}, showError(error) { throw error; },
  });
  return { view, transcript };
}

for (const [name, replyHeight, scrollTop] of [
  ["short reply", 100, 2000],
  ["long reply", 1400, 2000],
  ["user reading earlier messages", 100, 700],
]) {
  test(`completion keeps the reading position: ${name}`, async () => {
    const { view, transcript } = completedReply({ replyHeight, scrollTop });
    view._handleClientEvent({ type: "notification", method: "turn/completed",
      params: { threadId: "fixture-chat", turn: { id: "fixture-turn", status: "completed" } } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(transcript.scrollTop, scrollTop, "finishing a reply must not move the reading viewport");
  });
}

test("opening another chat shows its latest messages without the previous reply's spacer", async () => {
  const { view, transcript } = completedReply({ replyHeight: 100 });
  view.renderEmpty = () => {};
  await view.selectThread("another-fixture-chat");
  assert.equal(transcript.scrollTop, 1566);
});

test("completion keeps the current chat's Fast choice without changing the default", async () => {
  const { view } = completedReply({ replyHeight: 100 });
  const defaults = new Map([["serviceTier", "default"]]);
  view.manager.getPreference = key => defaults.get(key);
  view.manager.setPreference = (key, value) => defaults.set(key, value);
  view.models = [{ model: "sample-model", isDefault: true,
    supportedReasoningEfforts: ["low"], serviceTiers: [{ id: "priority" }] }];
  view.selectedServiceTier = "priority";
  view.applyModelSelection = SidebarView.prototype.applyModelSelection;
  view.renderModelControls = view.updateComposerState = () => {};
  view._handleClientEvent({ type: "notification", method: "turn/completed",
    params: { threadId: "fixture-chat", turn: { id: "fixture-turn", status: "completed" } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.selectedServiceTier, "priority");
  assert.equal(defaults.get("serviceTier"), "default");
});
