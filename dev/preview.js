/* Local UI fixture. All conversations and responses below are simulated. */
(async () => {
  const options = new URLSearchParams(location.search);
  if (options.has("width")) document.querySelector("#preview").style.width = `${Math.max(260, Math.min(800, Number(options.get("width")) || 440))}px`;
  if (["light", "dark"].includes(options.get("theme"))) document.body.style.colorScheme = options.get("theme");
  const { SidebarManager, SidebarView } = window.ZoteroCodexModules.Sidebar;
  const paper = {
    itemID: 1, attachmentID: 2, title: "Cross-Representation Knowledge Transfer for Improved Sequential Recommendations",
    abstract: "CREATE aligns graph and sequence representations for next-item recommendation.",
    pdfPath: "/papers/CREATE/paper.pdf",
  };
  const preferences = new Map(Object.entries({
    includeItemContext: true, paperOnlyChats: false, paperThreads: "{}", sidebarHeight: Math.min(innerHeight, 840),
  }));
  const listeners = new Set();
  const threads = new Map([
    ["create", { id: "create", name: "CREATE：跨表示知识迁移", cwd: "/papers/CREATE", updatedAt: Date.now() / 1000, turns: [{
      id: "first", status: "completed", items: [
        { id: "user-first", type: "userMessage", content: [{ type: "text", text: "这篇论文是怎么把图信息传给序列模型的？" }] },
        { id: "assistant-first", type: "agentMessage", phase: "final", text: "CREATE 同时训练序列编码器和图编码器，通过 **Barlow Twins** 损失对齐两种表示。\n\n图编码器学习用户与物品的整体关联，序列编码器保留用户行为的先后顺序。\n\n### 训练与预测\n\n1. 先预热图编码器。\n2. 联合训练，通过对齐损失传递图结构信息。\n3. 预测时使用序列模型。\n\n两种表示的相关矩阵为 $C_{ij}$，训练目标是让对角项接近 1、非对角项接近 0。\n\n| 编码器 | 学习的信号 |\n| --- | --- |\n| SASRec | 交互的先后顺序 |\n| LightGCN | 用户与物品的整体关联 |" },
      ],
    }] }],
    ["infomin", { id: "infomin", name: "InfoMin：如何选择对比学习视图", cwd: "/papers/InfoMin", updatedAt: Date.now() / 1000 - 3600, turns: [] }],
  ]);
  const emit = (method, params) => listeners.forEach((listener) => listener({ type: "notification", method, params }));
  const models = [{
    model: "gpt-6-sol", displayName: "GPT-6-Sol", isDefault: true,
    defaultReasoningEffort: "low", supportedReasoningEfforts: ["low", "medium", "high"],
  }, { model: "gpt-6-astra", displayName: "GPT-6-Astra", defaultReasoningEffort: "medium", supportedReasoningEfforts: ["low", "medium", "high", "xhigh"] }];
  let next = 0;
  const client = {
    process: {}, binaryPath: "/opt/homebrew/bin/codex", account: {},
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    listModels: async () => models,
    listSkills: async () => [{ name: "pdf", displayName: "PDF", description: "Read papers and inspect PDF pages", path: "/skills/pdf/SKILL.md" },
      { name: "research", displayName: "Research", description: "Investigate a question with primary sources", path: "/skills/research/SKILL.md" },
      { name: "Zotero", displayName: "Zotero", description: "Search your library and read paper context", path: "/skills/zotero/SKILL.md" }],
    listThreads: async () => [...threads.values()].map((thread) => ({ ...thread, label: thread.name, timestamp: thread.updatedAt * 1000 })),
    readThread: async (id) => structuredClone(threads.get(id)),
    startThread: async ({ cwd }) => {
      const thread = { id: `preview-${++next}`, name: "New chat", cwd, turns: [], updatedAt: Date.now() / 1000 };
      threads.set(thread.id, thread);
      return thread;
    },
    setThreadName: async (id, name) => { threads.get(id).name = name; },
    generateThreadTitle: async () => "CREATE：图与序列表示对齐",
    startTurn: async ({ threadID, text }) => {
      const id = `turn-${++next}`;
      const turn = { id, status: "inProgress", items: [{ id: `u-${id}`, type: "userMessage", content: [{ type: "text", text }] }] };
      threads.get(threadID).turns.push(turn);
      emit("turn/started", { threadId: threadID, turn: { id } });
      const chunks = ["这是本地 UI 预览中的模拟回答。", "\n\n你可以切换 chat，", "当前回答会继续在后台生成。", "模型、思考强度和权限可以在底部调整；输入 `/` 可以选择 skill。"];
      for (const [index, delta] of chunks.entries()) setTimeout(() => {
        if (turn.status !== "inProgress") return;
        emit("item/agentMessage/delta", { threadId: threadID, turnId: id, itemId: `a-${id}`, delta });
        if (index === chunks.length - 1) {
          turn.status = "completed";
          turn.items.push({ id: `a-${id}`, type: "agentMessage", phase: "final", text: chunks.join("") });
          emit("turn/completed", { threadId: threadID, turn: { id, status: "completed" } });
        }
      }, (index + 1) * 1200);
      return { id };
    },
    interruptTurn: async (threadID, turnID) => {
      threads.get(threadID).turns.find((turn) => turn.id === turnID).status = "interrupted";
      emit("turn/completed", { threadId: threadID, turn: { id: turnID, status: "interrupted" } });
    },
    archiveThread: async (id) => threads.delete(id),
    deleteThread: async (id) => threads.delete(id),
    reconnect: async () => {}, respond() {},
  };
  const manager = new SidebarManager({ client,
    getPreference: (key) => preferences.get(key), setPreference: (key, value) => preferences.set(key, value),
    log: (message, error) => { if (error) console.error(message, error); },
  });
  manager.notifyTurnCompleted = async (run) => {
    document.title = `Reply ready · ${run.label}`;
  };
  const view = new SidebarView(manager, { doc: document, body: document.querySelector("#preview"), tabType: "reader" });
  manager.views.set("preview", view);
  view.context = paper;
  view.contextEpoch = 1;
  view.renderContextAttachment();
  await view.refreshModels();
  await view.refreshThreads();
  await view.selectThread("create");
  window.addEventListener("pagehide", () => view.destroy(), { once: true });
})();
