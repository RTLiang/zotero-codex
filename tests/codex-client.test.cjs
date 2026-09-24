const test = require("node:test");
const assert = require("node:assert/strict");
const Protocol = require("../content/protocol.js");

global.ZoteroCodexModules = { Protocol };
require("../content/codex-client.js");

const { CodexAppServerClient } = global.ZoteroCodexModules.CodexClient;

test("forks before the edited turn without changing the source task", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => client;
  let request = null;
  client.request = async (method, params) => {
    request = { method, params };
    return { thread: { id: "forked-task", turns: [] } };
  };

  const thread = await client.forkThreadBeforeTurn({
    threadID: "source-task",
    beforeTurnID: "turn-to-edit",
    model: "gpt-5.6-sol",
  });

  assert.equal(thread.id, "forked-task");
  assert.deepEqual(request, {
    method: "thread/fork",
    params: {
      threadId: "source-task",
      beforeTurnId: "turn-to-edit",
      excludeTurns: false,
      ephemeral: false,
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandbox: "read-only",
      model: "gpt-5.6-sol",
    },
  });
  assert.equal(client.loadedThreads.has("forked-task"), true);
});

test("reverts the latest turn in place before resending an edited message", async () => {
  const client = new CodexAppServerClient();
  client.loadedThreads.add("source-task");
  let request = null;
  client.request = async (method, params) => {
    request = { method, params };
    return { thread: { id: "source-task", turns: [] } };
  };

  const thread = await client.revertThreadBeforeTurn({
    threadID: "source-task",
    beforeTurnID: "latest-turn",
  });

  assert.equal(thread.id, "source-task");
  assert.deepEqual(request, {
    method: "thread/revert",
    params: {
      threadId: "source-task",
      beforeTurnId: "latest-turn",
    },
  });
});

test("bounds resumed task bookkeeping and refreshes recent entries", () => {
  const client = new CodexAppServerClient();
  for (let index = 0; index < 505; index++) client.markThreadLoaded(`task-${index}`);

  assert.equal(client.loadedThreads.size, 500);
  assert.equal(client.loadedThreads.has("task-0"), false);
  assert.equal(client.loadedThreads.has("task-5"), true);

  client.markThreadLoaded("task-5");
  client.markThreadLoaded("task-new");
  assert.equal(client.loadedThreads.size, 500);
  assert.equal(client.loadedThreads.has("task-5"), true);
  assert.equal(client.loadedThreads.has("task-6"), false);
});

test("archives and deletes tasks through the app server, clearing loaded state only after success", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => client;
  client.loadedThreads.add("archive-me");
  client.loadedThreads.add("delete-me");
  const calls = [];
  client.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "thread/delete") throw new Error("server rejected deletion");
    return {};
  };

  await client.archiveThread("archive-me");
  await assert.rejects(client.deleteThread("delete-me"), /server rejected deletion/);
  assert.deepEqual(calls, [
    { method: "thread/archive", params: { threadId: "archive-me" } },
    { method: "thread/delete", params: { threadId: "delete-me" } },
  ]);
  assert.equal(client.loadedThreads.has("archive-me"), false);
  assert.equal(client.loadedThreads.has("delete-me"), true);
});

test("passes the imagegen skill item only for explicit image-generation turns", async () => {
  const client = new CodexAppServerClient();
  client.loadedThreads.add("task-imagegen");
  const calls = [];
  client.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "skills/list") return {
      data: [{ skills: [{ name: "imagegen", enabled: true, path: "/tmp/imagegen/SKILL.md" }] }],
    };
    return { turn: { id: "turn-imagegen" } };
  };

  await client.startTurn({ threadID: "task-imagegen", text: "$imagegen Draw a chart" });
  assert.deepEqual(calls.map(({ method }) => method), ["skills/list", "turn/start"]);
  assert.deepEqual(calls[1].params.input, [
    { type: "text", text: "$imagegen Draw a chart" },
    { type: "skill", name: "imagegen", path: "/tmp/imagegen/SKILL.md" },
  ]);

  calls.length = 0;
  await client.startTurn({ threadID: "task-imagegen", text: "Explain this paper" });
  assert.deepEqual(calls.map(({ method }) => method), ["turn/start"]);
});
