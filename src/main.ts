interface ZoteroCodexPluginObject {
  id: string;
  version: string;
  rootURI: string;
  client: CodexClientInstance | null;
  sidebar: SidebarInstance | null;
  initialized: boolean;
  storageHome: string;
  applyingSettings: boolean;
  sidebarOptions?: SidebarOptions;

  preferenceKey(name: string): string;
  getPreference(name: string): unknown;
  setPreference(name: string, value: string): void;
  init(options: { id: string; version: string; rootURI: string }): Promise<void>;
  createSidebar(): void;
  runtimeBusy(): boolean;
  applySettings(values: Record<string, string>, options?: { importLogin?: boolean }): Promise<{ authenticated: boolean; binaryPath?: string }>;
  addToAllWindows(): void;
  addToWindow(window: Window): void;
  removeFromWindow(window: Window): void;
  shutdown(): Promise<void>;
}

var ZoteroCodexPlugin: ZoteroCodexPluginObject = {
  id: "",
  version: "",
  rootURI: "",
  client: null,
  sidebar: null,
  initialized: false,
  storageHome: "",
  applyingSettings: false,

  preferenceKey(name: string): string {
    const scoped = globalThis.ZoteroCodexModules?.RuntimeSettings!.scopedKey(name, this.storageHome) || name;
    return `extensions.zotero.codexSidebar.${scoped}`;
  },

  getPreference(name: string): unknown {
    const value = Zotero.Prefs.get(this.preferenceKey(name), true);
    return value ?? (name === "paperThreads" ? "{}" : "");
  },

  setPreference(name: string, value: string): void {
    Zotero.Prefs.set(this.preferenceKey(name), value, true);
  },

  async init({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;

    this.storageHome = String(this.getPreference("codexHome") || "");

    const [stylesheetText, katexStylesheet] = await Promise.all([
      Zotero.File.getResourceAsync(rootURI + "content/style.css"),
      Zotero.File.getResourceAsync(rootURI + "content/vendor/katex/katex.min.css"),
    ]);
    const katexFontRoot = `${rootURI}content/vendor/katex/`;
    const resolvedKatexStylesheet = katexStylesheet.replace(
      /url\((['"]?)(fonts\/[^)'"]+)\1\)/gu,
      (_match, _quote, path) => `url("${katexFontRoot}${path}")`,
    );
    const modules = globalThis.ZoteroCodexModules;
    if (!modules?.CodexClient || !modules?.Sidebar) {
      throw new Error("Codex for Zotero modules failed to load");
    }
    modules.Localization!.configure((name) => this.getPreference(name));

    const pluginLog = (message: string, error?: unknown) => {
      Zotero.debug(`Codex for Zotero: ${message}`);
      if (error) Zotero.logError(error);
    };
    this.client = new modules.CodexClient.CodexAppServerClient({
      getPreference: (name) => this.getPreference(name),
      log: pluginLog,
    });
    this.sidebarOptions = {
      client: this.client,
      stylesheetText: `${stylesheetText}\n${resolvedKatexStylesheet}`,
      rootURI,
      getPreference: (name) => this.getPreference(name),
      setPreference: (name, value) => this.setPreference(name, value),
      log: pluginLog,
    };
    this.createSidebar();
    this.initialized = true;

    Zotero.CodexSidebar = {
      get connected() {
        return Boolean(ZoteroCodexPlugin.client?.process);
      },
      get binaryPath() {
        return ZoteroCodexPlugin.client?.binaryPath || "";
      },
      reconnect: () => this.client!.reconnect(),
      settings: {
        read: () => modules.RuntimeSettings!.read(name => this.getPreference(name)),
        language: () => modules.Localization!.selected(),
        setLanguage: (value) => this.sidebar!.setLanguage(value),
        busy: () => this.applyingSettings || this.runtimeBusy(),
        subscribe: (listener) => this.client!.subscribe(listener),
        defaults: () => ({
          codexHome: PathUtils.join(Zotero.DataDirectory.dir, "codex-sidebar", "runtime"),
          workingDirectory: PathUtils.join(Zotero.DataDirectory.dir, "codex-sidebar", "workspace"),
        }),
        apply: (values, options) => this.applySettings(values, options),
        mount: (root) => modules.Preferences!.mount(root, Zotero.CodexSidebar!.settings),
      },
    };
    await Zotero.PreferencePanes.register({
      pluginID: id, id: "zotero-codex-settings", label: "Codex",
      src: rootURI + "content/preferences.xhtml",
    });
    pluginLog(`Initialized ${version}`);
  },

  createSidebar() {
    this.sidebar = new globalThis.ZoteroCodexModules!.Sidebar!.SidebarManager(this.sidebarOptions!);
    this.sidebar.init(this.id);
  },

  runtimeBusy() {
    return Boolean(this.client!.connecting || this.client!.pending.size || this.sidebar!.runningTurns.size
      || [...this.sidebar!.views.values()].some(view =>
        view.running || view.creatingTask || view.initializing || (view.initialized && view.contextTransitioning)));
  },

  async applySettings(values: Record<string, string>, { importLogin = false }: { importLogin?: boolean } = {}) {
    const settings = globalThis.ZoteroCodexModules!.RuntimeSettings!;
    const next = settings.validate(values, Zotero.isWin);
    if (this.applyingSettings || this.runtimeBusy()) throw new Error("Wait for all replies and requests to finish, or stop them before saving settings.");
    this.applyingSettings = true;
    try {
      // Validate and prepare before interrupting any existing connection.
      await globalThis.ZoteroCodexModules!.CodexClient!.resolveCodexPath(next.codexPath);
      await settings.prepare(next);
      if (this.runtimeBusy()) throw new Error("A request started while preparing settings. Stop it and save again.");
      if (importLogin) {
        await settings.importLogin(next.codexHome);
        if (this.runtimeBusy()) throw new Error("A request started while importing login. Stop it and save again.");
      }
      // Keep the registered section: unregister/register races Zotero's async render.
      this.sidebar!.detachRuntimeViews();
      try {
        await this.client!.disconnect();
        for (const key of settings.KEYS) this.setPreference(key, next[key as keyof RuntimeSettingsValues]);
        this.storageHome = next.codexHome;
        Services.prefs.savePrefFile(null);
        await this.client!.connect();
      } finally {
        this.sidebar!.restoreRuntimeViews();
      }
      return { authenticated: Boolean(this.client!.account), binaryPath: this.client!.binaryPath };
    } finally {
      this.applyingSettings = false;
    }
  },

  addToAllWindows() {
    for (const window of Zotero.getMainWindows()) this.addToWindow(window);
  },

  addToWindow(window: Window) {
    if (!this.initialized || !window) return;
    this.sidebar!.addToWindow(window);
  },

  removeFromWindow(window: Window) {
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
