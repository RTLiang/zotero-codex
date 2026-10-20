const test = require("node:test");
const assert = require("node:assert/strict");
const Protocol = require("../content/protocol.js");

global.ZoteroCodexModules = { Protocol };
require("../content/interactive-ui.js");
require("../content/codex-client.js");

const { CodexAppServerClient } = global.ZoteroCodexModules.CodexClient;

async function withImmediateLockWait(run) {
  const original = global.setTimeout;
  global.setTimeout = (callback, delay, ...args) => original(callback, delay === 500 ? 0 : delay, ...args);
  try { await run(); }
  finally { global.setTimeout = original; }
}

test("waits for an external reader's writer lock before sending exactly once", async () => {
  await withImmediateLockWait(async () => {
    const client = new CodexAppServerClient();
    client.connect = async () => client;
    const calls = [];
    let resumes = 0;
    client.request = async (method) => {
      calls.push(method);
      if (method === "thread/resume" && ++resumes < 3) {
        throw new Error("thread fixture-chat already has an active writer");
      }
      return { turn: { id: "fixture-turn" } };
    };
    const turn = await client.startTurn({ threadID: "fixture-chat", text: "Explain the sample" });
    assert.equal(turn.id, "fixture-turn");
    assert.deepEqual(calls, ["thread/resume", "thread/resume", "thread/resume", "turn/start"]);
  });
});

test("persistent writer contention is bounded, localized and never sends the message", async () => {
  await withImmediateLockWait(async () => {
    const client = new CodexAppServerClient();
    client.connect = async () => client;
    let attempts = 0;
    client.request = async method => {
      assert.equal(method, "thread/resume");
      attempts++;
      throw new Error("thread fixture-chat already has an active writer");
    };
    await assert.rejects(client.startTurn({ threadID: "fixture-chat", text: "Explain" }),
      error => error.l10nID === "zotero-codex-error-thread-busy");
    assert.ok(attempts > 1 && attempts <= 21);
    assert.equal(client.loadedThreads.has("fixture-chat"), false);
    client.request = async () => ({ turn: { id: "retry-turn" } });
    assert.equal((await client.startTurn({ threadID: "fixture-chat", text: "Explain" })).id, "retry-turn");
  });
});

test("concurrent loads share one resume while duplicate sends are rejected per thread", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => client;
  let release;
  const resumed = new Promise(resolve => { release = resolve; });
  const calls = [];
  client.request = async (method, params) => {
    calls.push([method, params.threadId]);
    if (method === "thread/resume" && params.threadId === "fixture-chat") await resumed;
    return { turn: { id: "fixture-turn" } };
  };
  const first = client.startTurn({ threadID: "fixture-chat", text: "First" });
  const load = client.ensureThreadLoaded("fixture-chat");
  let duplicateError;
  const duplicate = client.startTurn({ threadID: "fixture-chat", text: "Duplicate" })
    .catch(error => { duplicateError = error; });
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(duplicateError?.l10nID, "zotero-codex-error-thread-busy");
    await client.startTurn({ threadID: "other-chat", text: "Independent" });
  }
  finally { release(); await Promise.all([first, load, duplicate]); }
  assert.equal(calls.filter(([method, id]) => method === "thread/resume" && id === "fixture-chat").length, 1);
  assert.equal(calls.filter(([method, id]) => method === "turn/start" && id === "fixture-chat").length, 1);
});

test("unloaded thread notifications invalidate cached ownership before the next send", async () => {
  for (const notification of [
    { method: "thread/closed", params: { threadId: "fixture-chat" } },
    { method: "thread/status/changed", params: { threadId: "fixture-chat", status: { type: "notLoaded" } } },
  ]) {
    const client = new CodexAppServerClient();
    client.connect = async () => client;
    client.loadedThreads.add("fixture-chat");
    client._handleMessage(notification);
    const calls = [];
    client.request = async method => { calls.push(method); return { turn: { id: "fixture-turn" } }; };
    await client.startTurn({ threadID: "fixture-chat", text: "Explain" });
    assert.deepEqual(calls, ["thread/resume", "turn/start"]);
  }
});

test("resume errors other than writer contention are not retried", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => client;
  let attempts = 0;
  client.request = async () => { attempts++; throw new Error("fixture unavailable"); };
  await assert.rejects(client.startTurn({ threadID: "fixture-chat", text: "Explain" }), /fixture unavailable/);
  assert.equal(attempts, 1);
});

test("disconnect cancels lock waiting and cannot mark an old resume as loaded", async () => {
  await withImmediateLockWait(async () => {
    const client = new CodexAppServerClient();
    client.connect = async () => client;
    let calls = 0;
    client.request = async method => {
      assert.equal(method, "thread/resume");
      calls++;
      client._fail(new Error("fixture disconnect"));
      throw new Error("thread fixture-chat already has an active writer");
    };
    await assert.rejects(client.startTurn({ threadID: "fixture-chat", text: "Explain" }),
      error => error.l10nID === "zotero-codex-error-disconnected");
    assert.equal(calls, 1);
    assert.equal(client.loadedThreads.has("fixture-chat"), false);
    client.request = async () => {
      client._fail(new Error("fixture disconnect"));
      return {};
    };
    await assert.rejects(client.ensureThreadLoaded("fixture-chat"),
      error => error.l10nID === "zotero-codex-error-disconnected");
    assert.equal(client.loadedThreads.has("fixture-chat"), false);
  });
});

test("concurrent callers wait for the app-server handshake even after the process exists", async () => {
  const client = new CodexAppServerClient();
  let finish;
  const handshake = new Promise(resolve => { finish = resolve; });
  client._connect = async () => {
    client.process = {};
    await handshake;
    return client;
  };
  const first = client.connect();
  let ready = false;
  const second = client.connect().then(() => { ready = true; });
  await new Promise(resolve => setImmediate(resolve));
  try { assert.equal(ready, false); }
  finally { finish(); await Promise.all([first, second]); }
});

test("new, resumed and forked chats receive the same trusted PDF citation contract", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => {};
  const calls = [];
  client.request = async (method, params) => {
    calls.push({ method, params });
    return method === "turn/start" ? { turn: { id: "fixture-turn" } } : { thread: { id: "fixture-chat" } };
  };
  await client.startThread({ cwd: "/fixtures" });
  client.loadedThreads.clear();
  await client.ensureThreadLoaded("fixture-chat");
  assert.deepEqual(calls.map((call) => call.method), ["thread/start", "thread/resume"]);
  const instructions = calls[0].params.developerInstructions;
  assert.equal(calls[1].params.developerInstructions, instructions);
  assert.match(instructions, /Match citation labels to the language of your answer/u);
  for (const label of ["Page 4", "Section 4.3", "Original passage", "Figure 1", "Table 2", "Equation (10)"]) {
    assert.ok(instructions.includes(`[${label}](#`), `Missing language-neutral citation example: ${label}`);
  }
  assert.doesNotMatch(instructions, /\[(?:第[^\]]*|图[^\]]*|表[^\]]*|式[^\]]*|原文)\]\(#/u);
  for (const target of ["#page=4", "#section=4.3", "#figure=1", "#table=2", "#equation=10", "#equation=1.1"]) {
    assert.ok(instructions.includes(target));
  }
  assert.match(instructions, /never use the paraphrased wording as a text-search target/u);
  assert.match(instructions, /include at least one of these Markdown citation links/u);
  assert.match(instructions, /no additional file access is required for those citations/u);
  assert.match(instructions, /#page=4&quote=/u);
  assert.match(instructions, /Never put a paraphrase or translation in quote/u);
  assert.match(instructions, /Source ownership check/u);
  assert.match(instructions, /never use a current-PDF fragment.*for another paper/u);
  assert.match(instructions, /Repeat the source URL for each citation/u);
  assert.match(instructions, /Never borrow the current PDF's evidence to verify another paper/u);
  assert.match(instructions, /audit every citation's document identity and locator together/u);
  assert.match(instructions, /treat the attachment as a possible scan/iu);
  assert.match(instructions, /never upload the paper to an external OCR service/u);
  const context = Protocol.buildZoteroContext({ title: "Document", pdfPath: "/fixtures/document.pdf" });
  await client.startTurn({ threadID: "fixture-chat", text: "Explain the method", context });
  assert.deepEqual(calls[2].params.additionalContext, context);
  assert.equal(calls[2].params.developerInstructions, undefined);
  assert.equal(context.zoteroCitationContract, undefined);
  await client.forkThreadBeforeTurn({ threadID: "fixture-chat", beforeTurnID: "fixture-turn" });
  assert.equal(calls[3].method, "thread/fork");
  assert.equal(calls[3].params.developerInstructions, instructions);
});

test("new, resumed and forked chats require Markdown LaTeX for mathematical output", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => {};
  const calls = [];
  client.request = async (method, params) => {
    calls.push({ method, params });
    return { thread: { id: "sample-math-chat" } };
  };
  await client.startThread({ cwd: "/fixtures" });
  client.loadedThreads.clear();
  await client.ensureThreadLoaded("sample-math-chat");
  await client.forkThreadBeforeTurn({ threadID: "sample-math-chat", beforeTurnID: "sample-turn" });
  assert.deepEqual(calls.map(call => call.method), ["thread/start", "thread/resume", "thread/fork"]);
  const instructions = calls[0].params.developerInstructions;
  for (const call of calls) assert.equal(call.params.developerInstructions, instructions);
  assert.match(instructions, /every formula and mathematical variable.*must use Markdown LaTeX/u);
  assert.match(instructions, /inline math in \$\.\.\.\$ and display math in \$\$\.\.\.\$\$/u);
  assert.match(instructions, /display delimiters on their own lines/u);
  assert.match(instructions, /Do not wrap formulas in inline code or fenced code blocks/u);
  const Markdown = require("../content/markdown.js");
  assert.equal(Markdown.parseInlines(instructions.match(/\$r_i[^$]+\$/u)[0])[0].type, "math");
  assert.equal(Markdown.parseBlocks(instructions.match(/\$\$\n[^]*?\n\$\$/u)[0])[0].type, "math");
});

test("discovers skills for the current working directory and sends native skill inputs", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => {};
  client.loadedThreads.add("skills-task");
  const calls = [];
  client.request = async (method, params) => {
    calls.push({ method, params });
    return method === "skills/list" ? { data: [{ skills: [
      { name: "pdf", enabled: true, path: "/skills/pdf/SKILL.md" },
      { name: "disabled", enabled: false, path: "/skills/disabled/SKILL.md" },
    ] }] } : { turn: { id: "skills-turn" } };
  };
  const skills = await client.listSkills({ cwd: "/fixtures", forceReload: true });
  assert.deepEqual(skills.map((skill) => skill.name), ["pdf"]);
  assert.deepEqual(calls[0].params, { cwds: ["/fixtures"], forceReload: true });
  calls.length = 0;
  await client.startTurn({ threadID: "skills-task", text: "$pdf Explain $pdf", cwd: "/fixtures" });
  assert.deepEqual(calls[0].params, { cwds: ["/fixtures"], forceReload: false });
  assert.deepEqual(calls[1].params.input, [
    { type: "text", text: "$pdf Explain $pdf" },
    { type: "skill", name: "pdf", path: "/skills/pdf/SKILL.md" },
  ]);
});

test("applies changed permissions to the next turn of an existing chat", async () => {
  const preferences = {};
  const client = new CodexAppServerClient({ getPreference: (key) => preferences[key] });
  client.loadedThreads.add("existing");
  let params;
  client.request = async (_method, value) => { params = value; return { turn: { id: "turn" } }; };
  await client.startTurn({ threadID: "existing", text: "Explain", cwd: "/fixtures" });
  assert.equal(params.approvalPolicy, "on-request");
  assert.equal(params.approvalsReviewer, "auto_review");
  assert.deepEqual(params.sandboxPolicy, { type: "readOnly", networkAccess: true });
  Object.assign(preferences, { approvalPolicy: "never", approvalsReviewer: "auto_review", sandbox: "workspace-write", networkAccess: true });
  await client.startTurn({ threadID: "existing", text: "Edit", cwd: "/fixtures" });
  assert.equal(params.approvalPolicy, "never");
  assert.equal(params.approvalsReviewer, "auto_review");
  assert.deepEqual(params.sandboxPolicy, { type: "workspaceWrite", writableRoots: ["/fixtures"], networkAccess: true });
  preferences.sandbox = "danger-full-access";
  await client.startTurn({ threadID: "existing", text: "Edit", cwd: "/fixtures" });
  assert.deepEqual(params.sandboxPolicy, { type: "dangerFullAccess" });
});

test("sends the selected speed for each turn without changing the chat's tier", async () => {
  const client = new CodexAppServerClient();
  client.loadedThreads.add("fixture-chat");
  const requests = [];
  client.request = async (method, params) => {
    requests.push({ method, params });
    return { turn: { id: `fixture-turn-${requests.length}` } };
  };
  await client.startTurn({ threadID: "fixture-chat", text: "Summarize the sample", serviceTier: "priority" });
  await client.startTurn({ threadID: "fixture-chat", text: "Explain the sample", serviceTier: "default" });
  assert.deepEqual(requests.map(({ method }) => method), ["turn/start", "turn/start"]);
  assert.deepEqual(requests.map(({ params }) => params.serviceTierForTurn), ["priority", "default"]);
  assert.ok(requests.every(({ params }) => !Object.hasOwn(params, "serviceTier")));
});

test("permission edits during skill loading only affect later turns", async () => {
  const preferences = { sandbox: "read-only" };
  const client = new CodexAppServerClient({ getPreference: (key) => preferences[key] });
  client.loadedThreads.add("existing");
  client.listSkills = async () => { preferences.sandbox = "danger-full-access"; return []; };
  let params;
  client.request = async (_method, value) => { params = value; return { turn: { id: "turn" } }; };
  await client.startTurn({ threadID: "existing", text: "$pdf Explain", cwd: "/fixtures" });
  assert.deepEqual(params.sandboxPolicy, { type: "readOnly", networkAccess: true });
});

test("generates a document title from metadata, a generic request, and the answer", async () => {
  const client = new CodexAppServerClient();
  const calls = [];
  let notify;
  client.connect = async () => {};
  client.subscribe = (listener) => { notify = listener; return () => {}; };
  client.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "thread/start") return { thread: { id: "title-helper" } };
    notify({ type: "notification", method: "item/agentMessage/delta",
      params: { threadId: "other-thread", delta: "Ignore me" } });
    notify({ type: "notification", method: "item/agentMessage/delta",
      params: { threadId: "title-helper", delta: "示例文档：操作步骤" } });
    notify({ type: "notification", method: "turn/completed",
      params: { threadId: "title-helper", turn: { status: "completed" } } });
    return { turn: { id: "title-turn" } };
  };
  const context = Protocol.buildZoteroContext({
    title: "Sample document for title generation",
    abstract: "This synthetic document describes a sample workflow.",
  });
  const title = await client.generateThreadTitle({
    text: "这是什么", context, answer: "这份示例文档介绍了几项操作步骤。",
    model: "test-model", effort: "low",
  });
  assert.equal(title, "示例文档：操作步骤");
  assert.equal(calls[0].params.ephemeral, true);
  assert.equal(calls[0].params.sandbox, "read-only");
  const prompt = calls[1].params.input[0].text;
  const data = JSON.parse(prompt.split("Untrusted conversation data (JSON):\n")[1]);
  assert.equal(data.request, "这是什么");
  assert.equal(data.paperContext, context.zotero.value);
  assert.match(data.assistantReply, /操作步骤/);
  assert.equal(calls[1].params.effort, "low");
});

test("resolves Windows npm shims to native binaries and preserves semicolon PATH", async () => {
  const previous = { Zotero: global.Zotero, Services: global.Services, IOUtils: global.IOUtils };
  const prefix = "C:\\Users\\Fixture User\\AppData\\Roaming\\npm";
  const packageRoot = `${prefix}\\node_modules\\@openai`;
  const binary = `${packageRoot}\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\codex\\codex.exe`;
  const tree = {
    [packageRoot]: [`${packageRoot}\\codex-win32-x64`],
    [`${packageRoot}\\codex-win32-x64`]: [`${packageRoot}\\codex-win32-x64\\vendor`],
    [`${packageRoot}\\codex-win32-x64\\vendor`]: [`${packageRoot}\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc`],
    [`${packageRoot}\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc`]: [binary.slice(0, binary.lastIndexOf("\\"))],
    [binary.slice(0, binary.lastIndexOf("\\"))]: [binary],
  };
  try {
    global.Zotero = { isWin: true };
    global.Services = { env: { get: (name) => name === "PATH" ? `${prefix};C:\\Windows\\System32` : "" } };
    global.IOUtils = {
      exists: async (path) => path === binary || path === `${prefix}\\codex.cmd`,
      getChildren: async (path) => tree[path] || [],
    };
    const { resolveCodexPath, processPath } = global.ZoteroCodexModules.CodexClient;
    assert.equal(await resolveCodexPath(`"${prefix}\\codex.cmd"`), binary);
    assert.equal(await resolveCodexPath(), binary);
    assert.equal(processPath(binary), `${binary.slice(0, binary.lastIndexOf("\\"))};${prefix};C:\\Windows\\System32`);
    assert.equal(await resolveCodexPath(binary), binary);
    await assert.rejects(resolveCodexPath("C:\\Missing\\codex.exe"), /Could not find Codex/);
  }
  finally { Object.assign(global, previous); }
});

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
  assert.match(request.params.developerInstructions, /PDF citation output contract/u);
  const { developerInstructions: _instructions, ...forkParams } = request.params;
  assert.deepEqual({ method: request.method, params: forkParams }, {
    method: "thread/fork",
    params: {
      threadId: "source-task",
      beforeTurnId: "turn-to-edit",
      excludeTurns: false,
      ephemeral: false,
      approvalPolicy: "on-request",
      approvalsReviewer: "auto_review",
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
  client.connect = async () => {};
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
  await client.startTurn({ threadID: "task-imagegen", text: "Explain this document" });
  assert.deepEqual(calls.map(({ method }) => method), ["turn/start"]);
});

test("loads the official Zotero skill when available to the sidebar", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => {};
  client.loadedThreads.add("task-zotero");
  const calls = [];
  client.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "skills/list") return {
      data: [{ skills: [
        { name: "Zotero", enabled: true, path: "/tmp/openai-zotero/SKILL.md" },
      ] }],
    };
    return { turn: { id: "turn-zotero" } };
  };

  await client.startTurn({
    threadID: "task-zotero",
    text: "Find the saved item and export its citation",
    useOfficialZoteroSkill: true,
  });

  assert.deepEqual(calls.map(({ method }) => method), ["skills/list", "turn/start"]);
  assert.deepEqual(calls[1].params.input, [
    { type: "text", text: "Find the saved item and export its citation" },
    { type: "skill", name: "Zotero", path: "/tmp/openai-zotero/SKILL.md" },
  ]);
});

test("registers the UI tool on new chats and centrally answers tool calls once for every view", async () => {
  const client = new CodexAppServerClient();
  client.connect = async () => {};
  let startParams;
  client.request = async (method, params) => {
    assert.equal(method, "thread/start");
    startParams = params;
    return { thread: { id: "ui-chat" } };
  };
  await client.startThread({ cwd: "/fixtures" });
  assert.equal(startParams.dynamicTools.length, 1);
  assert.equal(startParams.dynamicTools[0].name, "render_interactive_ui");
  assert.deepEqual(startParams.dynamicTools[0].inputSchema.required, ["title", "html"]);
  assert.match(startParams.developerInstructions, /render_interactive_ui/u);

  const events = [];
  client.subscribe((event) => events.push({ view: "first", event }));
  client.subscribe((event) => events.push({ view: "second", event }));
  const written = [];
  client.process = { stdin: { write: (line) => written.push(JSON.parse(line)) } };
  client._handleMessage({ id: 101, method: "item/tool/call", params: {
    threadId: "ui-chat", callId: "ui-call", tool: "render_interactive_ui",
    arguments: { title: "Slider", html: '<input type="range">' },
  } });
  assert.equal(written.length, 1);
  assert.equal(written[0].id, 101);
  assert.equal(written[0].result.success, true);
  assert.deepEqual(events, []);

  for (const [id, params] of [
    [102, { tool: "render_interactive_ui", arguments: { title: "Slider", html: "" } }],
    [103, { tool: "unsupported_tool", arguments: {} }],
  ]) {
    client._handleMessage({ id, method: "item/tool/call", params });
    const response = written.at(-1);
    assert.equal(response.id, id);
    assert.equal(response.result.success, false);
    assert.match(response.result.contentItems[0].text, /not rendered/u);
  }
  assert.equal(written.length, 3);
  assert.deepEqual(events, []);
});
