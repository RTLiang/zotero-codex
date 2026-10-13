const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { readFileSync } = require("node:fs");

const uiSource = readFileSync(path.join(__dirname, "../content/interactive-ui.js"), "utf8");
const protocolSource = readFileSync(path.join(__dirname, "../content/protocol.js"), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadModules(IOUtils = {}) {
  const context = vm.createContext({ TextEncoder, module: { exports: {} }, PathUtils: path, IOUtils });
  vm.runInContext(uiSource, context);
  vm.runInContext(protocolSource, context);
  return context.ZoteroCodexModules;
}

async function storageFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zotero-ui-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const writes = [];
  const IOUtils = {
    exists: async (target) => {
      try { await fs.access(target); return true; }
      catch (error) { if (error.code === "ENOENT") return false; throw error; }
    },
    readJSON: async (target) => JSON.parse(await fs.readFile(target, "utf8")),
    makeDirectory: async (target, options) => fs.mkdir(target, { recursive: options.createAncestors, mode: options.permissions }),
    writeJSON: async (target, value, options) => {
      writes.push({ target, options });
      await fs.writeFile(options.tmpPath, JSON.stringify(value));
      await fs.rename(options.tmpPath, target);
    },
  };
  return { root, IOUtils, writes, reload: () => loadModules(IOUtils).InteractiveUI };
}

const { InteractiveUI, Protocol } = loadModules();
const document = { title: "Frequency demo", html: '<input type="range"><output>2</output>' };
const completedItem = (changes = {}) => ({
  id: "call-demo", type: "dynamicToolCall", tool: "render_interactive_ui",
  status: "completed", success: true, arguments: document, ...changes,
});

test("accepts self-contained UI documents and enforces title and UTF-8 HTML bounds", () => {
  assert.deepEqual(plain(InteractiveUI.parseDocument({ title: "  Demo  ", html: " <p>2</p> " })),
    { title: "Demo", html: "<p>2</p>" });
  for (const value of [null, [], {}, { title: "", html: "x" }, { title: "x", html: " " },
    { title: "x".repeat(121), html: "x" }, { title: 2, html: "x" }, { title: "x", html: 2 }]) {
    assert.equal(InteractiveUI.parseDocument(value), null);
  }
  assert.ok(InteractiveUI.parseDocument({ title: "x".repeat(120), html: "x".repeat(128 * 1024) }));
  assert.equal(InteractiveUI.parseDocument({ title: "x", html: "x".repeat(128 * 1024 + 1) }), null);
  const multibyte = "界".repeat(Math.floor(128 * 1024 / 3));
  assert.ok(InteractiveUI.parseDocument({ title: "多字节", html: multibyte }));
  assert.equal(InteractiveUI.parseDocument({ title: "多字节", html: `${multibyte}界` }), null);
});

test("tool acceptance and explicit failures agree with document validation", () => {
  const accepted = InteractiveUI.respond({ tool: "render_interactive_ui", arguments: document });
  assert.equal(accepted.success, true);
  assert.deepEqual(JSON.parse(accepted.contentItems[0].text), { status: "accepted", title: document.title });
  for (const params of [null, {}, { tool: "unknown_tool", arguments: document },
    { tool: "render_interactive_ui", arguments: { title: "Demo", html: "" } }]) {
    const result = InteractiveUI.respond(params);
    assert.equal(result.success, false);
    assert.equal(result.contentItems[0].type, "inputText");
    assert.match(result.contentItems[0].text, /not rendered/u);
  }
});

test("restores only successful completed tool documents as visible transcript entries", () => {
  const entries = Protocol.flattenTurns([{
    id: "turn-demo",
    items: [
      completedItem(), completedItem({ id: "call-failed", success: false }),
      completedItem({ id: "call-running", status: "inProgress" }),
      completedItem({ id: "call-other", tool: "another_tool" }),
      completedItem({ id: "call-invalid", arguments: { title: "Demo", html: "" } }),
      { id: "reply", type: "agentMessage", text: "Try the slider." },
    ],
  }]);
  assert.deepEqual(Array.from(entries, (entry) => entry.role),
    ["interactiveUI", "activity", "activity", "activity", "activity", "assistant"]);
  assert.deepEqual(plain(entries[0]), { id: "call-demo", turnID: "turn-demo", role: "interactiveUI", document });
  const groups = Protocol.groupTranscriptEntries(entries);
  assert.deepEqual(Array.from(groups, (entry) => entry.role), ["interactiveUI", "process", "assistant"]);
  for (const id of ["../escape", "bad/id", "", "x".repeat(161)]) {
    assert.equal(InteractiveUI.parseItem(completedItem({ id })), null);
  }
});

test("persists selections atomically and restores them in a fresh module instance", async (t) => {
  const fixture = await storageFixture(t);
  const ui = fixture.reload();
  const store = ui.createStore(fixture.root);
  assert.equal(ui.createStore(fixture.root), store);
  assert.deepEqual(plain(await store.read("thread-a", "call-a")), { revision: 0, value: null });
  const changed = await store.write("thread-a", "call-a", 0, { frequency: 7, mode: "masked" });
  assert.deepEqual(plain(changed), { revision: 1, value: { frequency: 7, mode: "masked" } });
  const reopened = fixture.reload().createStore(fixture.root);
  assert.deepEqual(plain(await reopened.read("thread-a", "call-a")), plain(changed));
  assert.equal(fixture.writes[0].options.tmpPath, `${fixture.writes[0].target}.tmp`);
  assert.equal(fixture.writes[0].options.flush, true);
  await assert.rejects(fs.access(fixture.writes[0].options.tmpPath), { code: "ENOENT" });
});

test("concurrent stale writes cannot overwrite a newer selection", async (t) => {
  const fixture = await storageFixture(t);
  const store = fixture.reload().createStore(fixture.root);
  const [first, stale] = await Promise.all([
    store.write("thread-a", "call-a", 0, { selection: "first" }),
    store.write("thread-a", "call-a", 0, { selection: "stale" }),
  ]);
  assert.deepEqual(plain(first), { revision: 1, value: { selection: "first" } });
  assert.deepEqual(plain(stale), plain(first));
  assert.equal(fixture.writes.length, 1);
  await store.write("thread-a", "call-a", 1, { selection: "latest" });
  assert.deepEqual(plain(await store.read("thread-a", "call-a")),
    { revision: 2, value: { selection: "latest" } });
});

test("isolates state between calls, threads, and effective storage roots", async (t) => {
  const fixture = await storageFixture(t);
  const ui = fixture.reload();
  const store = ui.createStore(fixture.root);
  const otherRoot = ui.createStore(path.join(fixture.root, "other-storage"));
  await store.write("thread-a", "call-a", 0, { selection: 3 });
  for (const [candidate, threadID, callID] of [
    [store, "thread-b", "call-a"], [store, "thread-a", "call-b"], [otherRoot, "thread-a", "call-a"],
  ]) assert.deepEqual(plain(await candidate.read(threadID, callID)), { revision: 0, value: null });
  for (const [threadID, callID] of [["../escape", "call-a"], ["thread-a", "../escape"], ["", "call-a"]]) {
    await assert.rejects(store.read(threadID, callID), /identity/u);
    await assert.rejects(store.write(threadID, callID, 0, null), /identity/u);
  }
});

test("returns copies and notifies only accepted changes; unsubscribed views receive nothing", async (t) => {
  const fixture = await storageFixture(t);
  const store = fixture.reload().createStore(fixture.root);
  const events = [];
  const unsubscribe = store.subscribe((threadID, itemID, state) => {
    events.push({ threadID, itemID, state: plain(state) });
    state.value.selection = 999;
  });
  const input = { selection: 4 };
  const changed = await store.write("thread-a", "call-a", 0, input);
  input.selection = 123;
  changed.value.selection = 456;
  const restored = await store.read("thread-a", "call-a");
  assert.equal(restored.value.selection, 4);
  restored.value.selection = 789;
  assert.equal((await store.read("thread-a", "call-a")).value.selection, 4);
  await store.write("thread-a", "call-a", 0, { selection: "stale" });
  assert.deepEqual(events, [{ threadID: "thread-a", itemID: "call-a", state: { revision: 1, value: { selection: 4 } } }]);
  unsubscribe();
  await store.write("thread-a", "call-a", 1, { selection: 5 });
  assert.equal(events.length, 1);
});

test("rejects non-JSON, oversized UTF-8, deep and cyclic state without writing", async (t) => {
  const fixture = await storageFixture(t);
  const store = fixture.reload().createStore(fixture.root);
  const cycle = {}; cycle.self = cycle;
  let deep = null;
  for (let index = 0; index < 18; index++) deep = { child: deep };
  const invalid = [undefined, NaN, Infinity, () => {}, new Date(), { value: undefined }, cycle, deep,
    "界".repeat(6000), "x".repeat(16 * 1024)];
  for (const value of invalid) await assert.rejects(store.write("thread-a", "call-a", 0, value), /state/u);
  for (const revision of [-1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(store.write("thread-a", "call-a", revision, null), /revision/u);
  }
  assert.equal(fixture.writes.length, 0);
  assert.deepEqual(plain(await store.read("thread-a", "call-a")), { revision: 0, value: null });
});

test("saved corrupt or oversized state fails explicitly and is never silently overwritten", async (t) => {
  const fixture = await storageFixture(t);
  const directory = path.join(fixture.root, "interactive-ui", "thread-a");
  await fs.mkdir(directory, { recursive: true });
  const cases = ["{", JSON.stringify({ revision: -1, value: null }), JSON.stringify({ revision: 2 }),
    JSON.stringify({ revision: 1, value: "界".repeat(6000) })];
  for (let index = 0; index < cases.length; index++) {
    const callID = `call-corrupt-${index}`;
    const target = path.join(directory, `${callID}.json`);
    await fs.writeFile(target, cases[index]);
    const store = fixture.reload().createStore(fixture.root);
    await assert.rejects(store.read("thread-a", callID), /Could not read saved/u);
    await assert.rejects(store.write("thread-a", callID, 0, null), /Could not read saved/u);
    assert.equal(await fs.readFile(target, "utf8"), cases[index]);
  }
  assert.equal(fixture.writes.length, 0);
});

test("a failed disk write leaves the last saved state intact and does not poison later writes", async (t) => {
  const fixture = await storageFixture(t);
  const writeJSON = fixture.IOUtils.writeJSON;
  const store = fixture.reload().createStore(fixture.root);
  await store.write("thread-a", "call-a", 0, { selection: 1 });
  fixture.IOUtils.writeJSON = async () => { throw new Error("disk unavailable"); };
  await assert.rejects(store.write("thread-a", "call-a", 1, { selection: 2 }), /Could not save/u);
  assert.deepEqual(plain(await store.read("thread-a", "call-a")), { revision: 1, value: { selection: 1 } });
  fixture.IOUtils.writeJSON = writeJSON;
  await store.write("thread-a", "call-a", 1, { selection: 3 });
  assert.deepEqual(plain(await fixture.reload().createStore(fixture.root).read("thread-a", "call-a")),
    { revision: 2, value: { selection: 3 } });
});
