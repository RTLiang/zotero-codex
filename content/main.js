var ZoteroCodexPlugin = {
  id: "",
  version: "",
  rootURI: "",
  client: null,
  sidebar: null,
  initialized: false,

  preferenceKey(name) {
    return `extensions.zotero.codexSidebar.${name}`;
  },

  getPreference(name) {
    return Zotero.Prefs.get(this.preferenceKey(name), true);
  },

  setPreference(name, value) {
    Zotero.Prefs.set(this.preferenceKey(name), value, true);
  },

  async init({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;

    const stylesheetText = await Zotero.File.getResourceAsync(
      rootURI + "content/style.css",
    );
    const modules = globalThis.ZoteroCodexModules;
    if (!modules?.CodexClient || !modules?.Sidebar) {
      throw new Error("Codex Sidebar modules failed to load");
    }

    const pluginLog = (message, error) => {
      Zotero.debug(`Codex Sidebar: ${message}`);
      if (error) Zotero.logError(error);
    };
    this.client = new modules.CodexClient.CodexAppServerClient({
      getPreference: (name) => this.getPreference(name),
      log: pluginLog,
    });
    this.sidebar = new modules.Sidebar.SidebarManager({
      client: this.client,
      stylesheetText,
      rootURI,
      getPreference: (name) => this.getPreference(name),
      setPreference: (name, value) => this.setPreference(name, value),
      log: pluginLog,
    });
    this.sidebar.init(id);
    this.initialized = true;

    Zotero.CodexSidebar = {
      get connected() {
        return Boolean(ZoteroCodexPlugin.client?.process);
      },
      get binaryPath() {
        return ZoteroCodexPlugin.client?.binaryPath || "";
      },
      reconnect: () => this.client.reconnect(),
    };
    pluginLog(`Initialized ${version}`);
  },

  addToAllWindows() {
    for (const window of Zotero.getMainWindows()) this.addToWindow(window);
  },

  addToWindow(window) {
    if (!this.initialized || !window) return;
    this.sidebar.addToWindow(window);
  },

  removeFromWindow(window) {
    this.sidebar?.removeFromWindow(window);
  },

  async shutdown() {
    if (!this.initialized) return;
    await this.sidebar?.shutdown();
    await this.client?.disconnect();
    delete Zotero.CodexSidebar;
    delete globalThis.ZoteroCodexModules;
    this.sidebar = null;
    this.client = null;
    this.initialized = false;
  },
};
