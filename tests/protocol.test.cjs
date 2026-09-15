const test = require("node:test");
const assert = require("node:assert/strict");
const Protocol = require("../content/protocol.js");

test("normalizes and orders shared Codex tasks", () => {
  const rows = Protocol.normalizeThreadList({
    data: [
      { id: "older", preview: "Older task", recencyAt: 10 },
      { id: "newer", name: "New task", recencyAt: 20 },
      { preview: "invalid" },
    ],
  });
  assert.deepEqual(rows.map((row) => row.id), ["newer", "older"]);
  assert.equal(rows[0].label, "New task");
});

test("filters the recent-task picker and formats relative time by locale", () => {
  const threads = [
    { id: "a", label: "Zotero 文献总结", cwd: "/papers" },
    { id: "b", label: "修复 Swift 项目", cwd: "/code" },
  ];
  assert.deepEqual(Protocol.filterThreads(threads, "zotero").map((row) => row.id), ["a"]);
  assert.deepEqual(Protocol.filterThreads(threads, "CODE").map((row) => row.id), ["b"]);
  assert.equal(
    Protocol.relativeThreadTime(
      1_700_000_000_000,
      1_700_000_000_000 + 5 * 60 * 1000,
      "en-US",
    ),
    "5 minutes ago",
  );
  assert.equal(
    Protocol.relativeThreadTime(
      1_700_000_000,
      1_700_000_000_000 + 2 * 60 * 60 * 1000,
      "zh-CN",
    ),
    "2小时前",
  );
});

test("normalizes the account model catalog and its reasoning efforts", () => {
  const models = Protocol.normalizeModelList({
    data: [
      {
        id: "astra",
        model: "gpt-6-astra",
        displayName: "GPT-6-Astra",
        isDefault: true,
        defaultReasoningEffort: "medium",
        supportedReasoningEfforts: [
          { reasoningEffort: "low", description: "Fast" },
          { reasoningEffort: "medium", description: "Balanced" },
        ],
      },
      { model: "hidden", isHidden: true },
      { displayName: "invalid" },
    ],
  });
  assert.deepEqual(models.map((model) => model.model), ["gpt-6-astra"]);
  assert.deepEqual(models[0].supportedReasoningEfforts, ["low", "medium"]);
});

test("resolves a valid model and falls back to its supported default effort", () => {
  const models = [
    {
      model: "gpt-6-astra",
      isDefault: true,
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: ["low", "medium", "high"],
    },
    {
      model: "gpt-5.6-luna",
      defaultReasoningEffort: "low",
      supportedReasoningEfforts: ["low", "medium"],
    },
  ];
  assert.deepEqual(
    Protocol.resolveModelSelection(models, "gpt-5.6-luna", "ultra"),
    { model: "gpt-5.6-luna", effort: "low", modelInfo: models[1] },
  );
  assert.equal(Protocol.resolveModelSelection(models).model, "gpt-6-astra");
});

test("flattens full turn history for the sidebar", () => {
  const entries = Protocol.flattenTurns([
    {
      id: "turn-1",
      items: [
        { id: "u1", type: "userMessage", content: [{ type: "text", text: "解释这篇论文" }] },
        { id: "a1", type: "agentMessage", phase: "commentary", text: "正在读取。" },
        { id: "t1", type: "webSearch", query: "paper DOI" },
        { id: "a2", type: "agentMessage", phase: "final", text: "核心贡献如下。" },
      ],
    },
  ]);
  assert.deepEqual(entries.map((entry) => entry.role), [
    "user",
    "assistant",
    "activity",
    "assistant",
  ]);
  assert.equal(entries[1].phase, "commentary");
  assert.match(entries[2].text, /Web search/u);
  assert.equal(entries[2].item.query, "paper DOI");
  assert.equal(
    Protocol.activityDescriptor(entries[2].item).l10nID,
    "zotero-codex-activity-web-search",
  );
});

test("collapses adjacent progress and tool activity into one transcript group", () => {
  const grouped = Protocol.groupTranscriptEntries([
    { role: "user", text: "检查一下" },
    { role: "assistant", phase: "commentary", text: "正在读取" },
    { role: "activity", text: "终端：npm test" },
    { role: "assistant", phase: "commentary", text: "正在验证" },
    { role: "assistant", phase: "final", text: "已经修好" },
  ]);
  assert.deepEqual(grouped.map((entry) => entry.role), ["user", "process", "assistant"]);
  assert.equal(grouped[1].entries.length, 3);
});

test("creates untrusted Zotero context only when requested", () => {
  const context = Protocol.buildZoteroContext(
    {
      title: "Example Paper",
      creators: "Ada Lovelace",
      doi: "10.1000/example",
      pdfPath: "/tmp/example.pdf",
    },
    [{ text: "A selected paragraph", pageLabel: "3" }],
  );
  assert.equal(context.zotero.kind, "untrusted");
  assert.match(context.zotero.value, /untrusted source material/u);
  assert.match(context.zotero.value, /Example Paper/u);
  assert.match(context.zotero.value, /Selected text \(page 3\)/u);
});

test("keeps an explicitly added PDF selection when item metadata is disabled", () => {
  const context = Protocol.buildZoteroContext(
    {
      title: "Private item metadata",
      abstract: "Not requested",
    },
    [{ text: "The selected sentence", pageNumber: 7 }],
    { includeItem: false },
  );
  assert.doesNotMatch(context.zotero.value, /Private item metadata|Not requested/u);
  assert.match(context.zotero.value, /Selected text \(page 7\):\nThe selected sentence/u);
});

test("merges the live PDF selection with pinned selections without duplicates", () => {
  const selections = Protocol.mergeContextSelections(
    { text: "  Current selected paragraph  ", pageNumber: 4 },
    [
      { id: "duplicate", text: "Current selected paragraph", pageNumber: 4 },
      { id: "pinned", text: "A pinned paragraph", pageLabel: "iv" },
    ],
  );
  assert.deepEqual(
    selections.map(({ text, pageLabel, pageNumber }) => ({ text, pageLabel, pageNumber })),
    [
      { text: "Current selected paragraph", pageLabel: "", pageNumber: 4 },
      { text: "A pinned paragraph", pageLabel: "iv", pageNumber: null },
    ],
  );
});

test("keeps a separate Codex task binding for each Zotero paper", () => {
  const first = { libraryID: 1, itemKey: "PAPER-A", itemID: 10 };
  const second = { libraryID: 1, itemKey: "PAPER-B", itemID: 11 };
  assert.equal(Protocol.paperContextKey(first), "1:PAPER-A");
  assert.equal(Protocol.paperContextKey(second), "1:PAPER-B");

  let stored = Protocol.updatePaperThreadBindings("{}", Protocol.paperContextKey(first), "thread-a");
  stored = Protocol.updatePaperThreadBindings(stored, Protocol.paperContextKey(second), "thread-b");
  assert.deepEqual(Protocol.normalizePaperThreadBindings(stored), {
    "1:PAPER-A": "thread-a",
    "1:PAPER-B": "thread-b",
  });

  stored = Protocol.updatePaperThreadBindings(stored, Protocol.paperContextKey(first), "");
  assert.deepEqual(Protocol.normalizePaperThreadBindings(stored), {
    "1:PAPER-B": "thread-b",
  });
});
