#!/usr/bin/env node

import { spawn } from "node:child_process";

const codexPath = process.env.CODEX_PATH || "/opt/homebrew/bin/codex";
const child = spawn(codexPath, ["app-server"], {
  stdio: ["pipe", "pipe", "pipe"],
});

let nextID = 1;
let buffer = "";
const pending = new Map();

function request(method, params = {}) {
  const id = nextID++;
  child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.id == null || message.method) continue;
    const task = pending.get(message.id);
    if (!task) continue;
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  }
});

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  const initialized = await request("initialize", {
    clientInfo: {
      name: "zotero-codex-probe",
      title: "Zotero Codex Probe",
      version: "2026.258.1",
    },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
  const modelResult = await request("model/list", { limit: 100, includeHidden: false });
  const models = (modelResult.data || []).map((model) => ({
    id: model.id,
    model: model.model,
    displayName: model.displayName,
    isDefault: model.isDefault,
    defaultReasoningEffort: model.defaultReasoningEffort,
    supportedReasoningEfforts: (model.supportedReasoningEfforts || []).map(
      (option) => option.reasoningEffort,
    ),
  }));
  const listed = await request("thread/list", {
    limit: 5,
    sortKey: "recency_at",
    sortDirection: "desc",
  });
  const firstThreadID = listed.data?.[0]?.id;
  let history = null;
  if (firstThreadID) {
    const metadata = await request("thread/read", { threadId: firstThreadID });
    const turns = await request("thread/turns/list", {
      threadId: firstThreadID,
      limit: 5,
      sortDirection: "asc",
      itemsView: "full",
    });
    history = {
      id: metadata.thread?.id,
      name: metadata.thread?.name,
      turnCount: turns.data?.length || 0,
      firstPageHasItems: Boolean(turns.data?.some((turn) => turn.items?.length)),
    };
  }
  console.log(JSON.stringify({ initialized, models, listed, history }, null, 2));
} finally {
  child.kill("SIGTERM");
}
