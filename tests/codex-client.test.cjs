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
