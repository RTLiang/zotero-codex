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
    element("p", t("Connection settings for this sidebar.", "此侧栏的连接设置。" )).className = "pref-intro";
    const fields = {};
    function section(title, description, collapsible = false) {
      const node = element(collapsible ? "details" : "section");
      node.className = "pref-card";
      element(collapsible ? "summary" : "h3", title, node);
      if (description) element("p", description, node);
      return node;
    }
    function field(parent, key, label, hint, options) {
      const row = element("div", "", parent);
      row.className = "pref-field";
      const id = `codex-setting-${key}`;
      element("label", label, row).htmlFor = id;
      const control = element("div", "", row);
      control.className = options ? "pref-control pref-select" : "pref-control";
      const node = element(options ? "select" : "input", "", control);
      node.id = id;
      if (!options) node.type = "text";
      else for (const [value, label] of options) element("option", label, node).value = value;
      if (hint) { const help = element("small", hint, row); help.id = `${id}-hint`; node.setAttribute("aria-describedby", help.id); }
      fields[key] = node;
      return node;
    }
    const proxy = section(t("Connection", "连接"));
    field(proxy, "proxyMode", t("Proxy", "代理"), "", [
      ["inherit", t("Use Zotero environment", "使用 Zotero 环境")],
      ["direct", t("No proxy", "不使用代理")],
      ["manual", t("Manual proxy", "手动代理")],
    ]);
    const inheritedHint = element("p", t("Dock launches may need a manual proxy.", "从 Dock 启动时，可能需要手动配置代理。"), proxy);
    inheritedHint.className = "pref-hint";
    const manual = element("div", "", proxy);
    manual.id = "codex-manual-proxy";
    field(manual, "proxyURL", t("Proxy address", "代理地址"), "HTTP · HTTPS · SOCKS5 · SOCKS5H").placeholder = "http://127.0.0.1:7890";
    field(manual, "proxyBypass", t("Bypass proxy for", "不走代理的地址"), t("Separate hosts with commas. Keep localhost for sign-in callbacks.", "用逗号分隔；保留 localhost 以支持登录回调。"));
    const executable = section(t("Codex executable", "Codex 可执行文件"), t("Automatically detected unless you specify a path.", "默认自动查找，也可指定路径。"), true);
    field(executable, "codexPath", t("Executable path", "可执行文件路径"), t("Use the actual executable, not a proxy wrapper script.", "填写实际可执行文件路径，不使用代理包装脚本。" )).placeholder = t("Find automatically", "自动查找");
    const storage = section(t("Storage and working directory", "存储与工作目录"), t("Uses your shared Codex storage by default.", "默认使用现有的 Codex 共享存储。"), true);
    storage.id = "codex-storage-settings";
    field(storage, "codexHome", t("Codex storage", "Codex 存储目录"), t("A dedicated directory keeps its own chats, configuration, skills and login. Existing chats are not moved.", "独立目录使用自己的聊天、配置、技能和登录。不会移动已有聊天。" )).placeholder = t("Shared storage (default)", "共享存储（默认）");
    field(storage, "workingDirectory", t("Working directory for new chats", "新聊天的工作目录"), t("Each paper gets a subfolder. Existing chats keep their current directory.", "每篇论文使用独立子目录；已有聊天的目录不变。" )).placeholder = t("PDF directory (default)", "PDF 所在目录（默认）");
    const defaults = element("button", t("Use Zotero directories", "使用 Zotero 专用目录"), storage);
    defaults.type = "button";
    defaults.addEventListener("click", () => { for (const [key, value] of Object.entries(api.defaults())) fields[key].value = value; });
    const loginLabel = element("label", "", storage);
    loginLabel.className = "pref-checkbox";
    const login = element("input", "", loginLabel); login.type = "checkbox"; login.id = "codex-import-login";
    loginLabel.appendChild(doc.createTextNode(t("Import existing login once", "一次性导入已有登录")));
    element("small", t("Copies only auth.json. Never overwrites a login or copies chats, configuration or skills.", "仅复制 auth.json，不覆盖已有登录，也不复制聊天、配置或技能。"), storage);
    const footer = element("div"); footer.className = "pref-footer";
    const save = element("button", t("Save and reconnect", "保存并重新连接"), footer); save.type = "button"; save.id = "codex-settings-save";
    element("small", t("Reconnects after saving. Wait for active replies to finish.", "保存后重新连接，请先等待回复结束。"), footer);
    const status = element("output"); status.id = "codex-settings-status"; status.setAttribute("role", "status");
    function update() {
      manual.hidden = fields.proxyMode.value !== "manual";
      inheritedHint.hidden = fields.proxyMode.value !== "inherit";
      fields.proxyURL.disabled = fields.proxyBypass.disabled = fields.proxyMode.value !== "manual";
      save.disabled = Boolean(api.busy());
      save.title = save.disabled
        ? t("Wait for all replies and requests to finish before saving.", "请等待所有回复和请求结束后再保存。") : "";
    }
    const unsubscribe = api.subscribe(update);
    const timer = doc.defaultView.setInterval(update, 500);
    doc.defaultView.addEventListener("unload", () => {
      unsubscribe();
      doc.defaultView.clearInterval(timer);
    }, { once: true });
    for (const [key, value] of Object.entries(api.read())) fields[key].value = value;
    executable.open = Boolean(fields.codexPath.value);
    storage.open = Boolean(fields.codexHome.value || fields.workingDirectory.value);
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
      } finally { update(); }
    });
  }
  modules.Preferences = { mount };
})(typeof globalThis !== "undefined" ? globalThis : this);
