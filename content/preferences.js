(function (global) {
  "use strict";
  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};
  function mount(root, api) {
    const doc = root.ownerDocument;
    const body = root.querySelector("#codex-runtime-fields");
    if (!body || body.childElementCount) return;
    const zh = global.Services.locale.appLocaleAsBCP47.startsWith("zh");
    const t = (en, cn) => zh ? cn : en;
    function element(tag, text, parent = body) {
      const node = doc.createElementNS("http://www.w3.org/1999/xhtml", tag);
      if (text) node.textContent = text;
      parent.appendChild(node);
      return node;
    }
    element("h2", t("Codex connection and storage", "Codex 连接与存储"));
    element("p", t("Settings apply only to this sidebar. Save while no reply is running; the sidebar reconnects automatically.", "这些设置只影响 Codex 侧栏。请在回复结束后保存，侧栏会自动重新连接。"));
    const fields = {};
    function field(key, label, hint, options) {
      const id = `codex-setting-${key}`;
      element("label", label).htmlFor = id;
      const node = element(options ? "select" : "input");
      node.id = id;
      if (!options) node.type = "text";
      else for (const [value, label] of options) element("option", label, node).value = value;
      if (hint) { const help = element("small", hint); help.id = `${id}-hint`; node.setAttribute("aria-describedby", help.id); }
      fields[key] = node;
      return node;
    }
    field("proxyMode", t("Proxy mode", "代理模式"), t("Inherited means Zotero's process environment, which may differ from your terminal. Custom launch scripts can override these settings.", "继承的是 Zotero 进程环境，未必与终端相同。自定义启动脚本可能覆盖这里的代理设置。"), [
      ["inherit", t("Inherit Zotero environment", "继承 Zotero 环境")],
      ["direct", t("Direct (disable proxy environment)", "直连（禁用代理环境变量）")],
      ["manual", t("Manual proxy", "手动代理")],
    ]);
    field("proxyURL", t("Proxy URL", "代理地址"), "http://127.0.0.1:7890 · http / https / socks5 / socks5h");
    field("proxyBypass", t("Bypass proxy for", "不走代理的地址"), t("Comma-separated hosts; keep localhost for local callbacks.", "主机名用逗号分隔；建议保留 localhost，以支持本地登录回调。"));
    field("codexPath", t("Codex executable", "Codex 可执行文件"), t("Absolute path to the actual executable; blank = auto-detect. Avoid proxy wrapper scripts when using these settings.", "实际可执行文件的绝对路径；留空自动查找。使用这里的代理设置时，请不要再使用固定代理的包装脚本。"));
    field("codexHome", t("Codex storage directory (CODEX_HOME)", "Codex 存储目录（CODEX_HOME）"), t("Blank = existing shared storage. A dedicated directory contains sessions, SQLite, configuration and login. Existing chats are not moved; switch back to see them.", "留空使用现有共享存储。独立目录保存会话、数据库、配置和登录。不会移动旧聊天，切回原目录即可查看。"));
    field("workingDirectory", t("Working directory", "工作目录"), t("Blank = PDF directory. When set, each paper gets its own subdirectory here. Changing this affects new chats; existing chats keep their original working directory.", "留空使用 PDF 所在目录。指定后，每篇论文会在这里有独立子目录。修改只影响新聊天，已有聊天保留原工作目录。"));
    const defaults = element("button", t("Use dedicated Zotero directories", "使用 Zotero 专用目录"));
    defaults.type = "button";
    defaults.addEventListener("click", () => { for (const [key, value] of Object.entries(api.defaults())) fields[key].value = value; });
    const loginLabel = element("label");
    const login = element("input", "", loginLabel); login.type = "checkbox"; login.id = "codex-import-login";
    loginLabel.appendChild(doc.createTextNode(t(" Import existing local Codex login once", " 首次导入已有的本机 Codex 登录")));
    element("small", t("Copies only auth.json into the chosen private directory. Never overwrites an existing login. Configuration, skills and old chats are not copied. Alternatively run CODEX_HOME=<directory> codex login in a terminal.", "只将 auth.json 复制到所选私有目录，不覆盖已有登录；不复制配置、技能或旧聊天。也可在终端指定 CODEX_HOME 后运行 codex login。"));
    const save = element("button", t("Save and reconnect", "保存并重新连接")); save.type = "button"; save.id = "codex-settings-save";
    const status = element("output"); status.id = "codex-settings-status"; status.setAttribute("role", "status");
    function update() {
      fields.proxyURL.disabled = fields.proxyBypass.disabled = fields.proxyMode.value !== "manual";
    }
    for (const [key, value] of Object.entries(api.read())) fields[key].value = value;
    fields.proxyMode.addEventListener("change", update); update();
    save.addEventListener("click", async () => {
      const values = Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.value]));
      save.disabled = true; status.textContent = t("Saving and connecting…", "正在保存并连接…");
      try {
        const result = await api.apply(values, { importLogin: login.checked });
        login.checked = false;
        status.textContent = result.authenticated
          ? t("Connected. Send a message in the sidebar to check the model connection.", "已连接。请在侧栏发一条消息，验证模型连接。")
          : t("Connected, but sign-in could not be confirmed. Test a message; if needed, sign in using the storage directory above.", "已连接，但未能确认登录状态。请先测试消息；如需登录，请使用上面的存储目录。");
      } catch (error) {
        status.textContent = t("Could not apply/connect: ", "保存或连接失败：") + error.message;
      } finally { save.disabled = false; }
    });
  }
  modules.Preferences = { mount };
})(typeof globalThis !== "undefined" ? globalThis : this);
