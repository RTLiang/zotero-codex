const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = { Protocol: require("../content/protocol.js"), CodexClient: {}, Markdown: {} };
require("../content/localization.js");
require("../content/sidebar.js");
const { SidebarView } = global.ZoteroCodexModules.Sidebar;

function completedReply({ replyHeight, scrollTop = 2000, reloadedHistoryHeight = 1960 }) {
  let padding = 550, position = scrollTop, nodes = [], historyRenders = 0;
  const transcript = {
    clientHeight: 600,
    get children() { return nodes; },
    get lastElementChild() { return nodes.at(-1); },
    get scrollHeight() { return nodes.reduce((sum, node) => sum + node.height, 0) + padding; },
    get scrollTop() { return Math.min(position, Math.max(0, this.scrollHeight - this.clientHeight)); },
    set scrollTop(value) { position = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); },
    style: { removeProperty() { padding = 16; } },
    replaceChildren() { for (const node of nodes) node.parentNode = null; nodes = []; position = Math.min(position, Math.max(0, padding - 600)); },
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
    createTranscriptEntry(entry) {
      const node = { dataset: {}, parentNode: transcript,
        height: entry.text === "Earlier answer" ? (++historyRenders === 1 ? 1960 : reloadedHistoryHeight)
          : entry.text === "Earlier question" ? 40 : entry.role === "user" ? 50 : replyHeight,
        remove() { nodes = nodes.filter(candidate => candidate !== this); this.parentNode = null; },
      };
      nodes.push(node);
      return node;
    },
    disposeInteractiveViews() {}, renderContextAttachment() {}, cancelEdit() {}, hidePendingResponse() {},
    updateMessageActions() {},
    showPage() {}, setRunning() {}, updateThreadHeader() {}, renderRequests() {}, setStatus() {}, applyModelSelection() {},
    refreshThreads: async () => {}, showError(error) { throw error; },
  });
  view.renderTranscript(global.ZoteroCodexModules.Protocol.flattenTurns([{ items: messages.slice(0, 2) }]));
  view.appendEntry({ role: "user", text: "Give a short answer" });
  view.appendEntry({ role: "assistant", text: "A short fixture answer." });
  padding = 550;
  transcript.scrollTop = scrollTop;
  return { view, transcript };
}

test("completion keeps the visible reply when earlier diagrams would reload at a smaller height", async () => {
  const { view, transcript } = completedReply({ replyHeight: 1400, reloadedHistoryHeight: 360 });
  view._handleClientEvent({ type: "notification", method: "turn/completed",
    params: { threadId: "fixture-chat", turn: { id: "fixture-turn", status: "completed" } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(transcript.scrollTop, 2000, "finishing a reply must not jump back to older messages while media reloads");
});

test("completion keeps loaded media in the final answer instead of rebuilding it", async () => {
  const { view, transcript } = completedReply({ replyHeight: 1400 });
  const reply = transcript.lastElementChild;
  view._handleClientEvent({ type: "notification", method: "turn/completed",
    params: { threadId: "fixture-chat", turn: { id: "fixture-turn", status: "completed" } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(transcript.lastElementChild, reply, "loaded diagrams in the visible answer must stay mounted");
});

test("changed nested image content is refreshed even when the caption stays the same", () => {
  const { view, transcript } = completedReply({ replyHeight: 100 });
  view.renderTranscript([{ role: "user", text: "Sample image", images: [{ url: "data:image/png;base64,AAAA" }] }]);
  const previous = transcript.lastElementChild;
  view.renderTranscript([{ role: "user", text: "Sample image", images: [{ url: "data:image/png;base64,BBBB" }] }], { preserveScroll: true });
  assert.notEqual(transcript.lastElementChild, previous);
});

test("interactive views kept in the transcript stay alive while removed views are disposed", () => {
  const { view } = completedReply({ replyHeight: 100 });
  let disposed = 0;
  const retained = { dispose() { throw new Error("The visible interactive view was disposed"); } };
  const removed = { dispose() { disposed++; } };
  view.interactiveViews = [retained, removed];
  SidebarView.prototype.disposeInteractiveViews.call(view, new Set([retained]));
  assert.deepEqual(view.interactiveViews, [retained]);
  assert.equal(disposed, 1);
});

for (const [name, replyHeight, scrollTop] of [
  ["short reply", 100, 1500],
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

for (const replyHeight of [100, 1400]) {
  test(`completion removes empty scroll space below a ${replyHeight}px reply`, async () => {
    const { view, transcript } = completedReply({ replyHeight, scrollTop: 10000 });
    view._handleClientEvent({ type: "notification", method: "turn/completed",
      params: { threadId: "fixture-chat", turn: { id: "fixture-turn", status: "completed" } } });
    await new Promise(resolve => setImmediate(resolve));
    const contentBottom = 2000 + 50 + replyHeight;
    assert.ok(transcript.scrollTop + transcript.clientHeight - contentBottom <= 16,
      "the end of the chat must sit above the composer without a reserved blank viewport");
    assert.equal(transcript.scrollTop, contentBottom + 16 - transcript.clientHeight);
  });
}

test("opening another chat shows its latest messages without the previous reply's spacer", async () => {
  const { view, transcript } = completedReply({ replyHeight: 100 });
  view.renderEmpty = () => {};
  await view.selectThread("another-fixture-chat");
  assert.equal(transcript.scrollTop, 1566);
});

for (const edge of ["top", "bottom"]) test(`growing the chat from its ${edge} bar does not expose the reply-positioning spacer`, () => {
  const { view, transcript } = completedReply({ replyHeight: 400 });
  let shellHeight = 800;
  const handle = { dataset: { resizeEdge: edge }, setPointerCapture() {}, setAttribute() {} };
  view.elements.root = {
    parentElement: null, dataset: {}, classList: { add() {} },
    getBoundingClientRect: () => ({ height: shellHeight }),
    style: { setProperty(_key, value) {
      const next = Number.parseFloat(value);
      transcript.clientHeight += next - shellHeight;
      shellHeight = next;
    } },
  };
  view.elements.resizeHandles = [handle];
  view.resizeCommandMenu = () => {};
  view.startShellResize({ button: 0, pointerId: 1, clientY: 400, currentTarget: handle, preventDefault() {} });
  view.moveShellResize({ pointerId: 1, clientY: edge === "top" ? 200 : 600, preventDefault() {} });
  const contentBottom = 2000 + 50 + 400;
  const visibleBlank = transcript.scrollTop + transcript.clientHeight - contentBottom;
  assert.equal(shellHeight, 1000);
  assert.ok(visibleBlank <= 16, `resizing exposed ${visibleBlank}px of blank space below the reply`);
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
