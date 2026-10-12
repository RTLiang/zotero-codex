interface CodexClientOptions {
  getPreference: (name: string) => unknown;
  log: (message: string, error?: unknown) => void;
}

interface CodexClientInstance {
  process?: unknown;
  binaryPath?: string;
  account?: unknown;
  connecting?: boolean;
  pending: { size: number };
  reconnect(): Promise<void>;
  disconnect(): Promise<void>;
  connect(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

interface CodexClientModule {
  CodexAppServerClient: new (options: CodexClientOptions) => CodexClientInstance;
  resolveCodexPath(path: string): Promise<unknown>;
  getHomeDirectory(): string;
}

interface PreferencesApi {
  read(): RuntimeSettingsValues;
  language(): string;
  setLanguage(value: string): void;
  busy(): boolean;
  subscribe(listener: () => void): () => void;
  defaults(): Record<string, string>;
  apply(values: Record<string, string>, options?: { importLogin?: boolean }): Promise<{ authenticated: boolean; binaryPath?: string }>;
}

interface PreferencesModule {
  mount(root: Element, api: PreferencesApi): void;
}

interface SidebarOptions {
  client: CodexClientInstance;
  stylesheetText: string;
  rootURI: string;
  getPreference: (name: string) => unknown;
  setPreference: (name: string, value: string) => void;
  log: (message: string, error?: unknown) => void;
}

interface SidebarViewState {
  running?: boolean;
  creatingTask?: boolean;
  initializing?: boolean;
  initialized?: boolean;
  contextTransitioning?: boolean;
}

interface SidebarInstance {
  runningTurns: { size: number };
  views: Map<unknown, SidebarViewState>;
  init(id: string): void;
  setLanguage(value: string): void;
  detachRuntimeViews(): void;
  restoreRuntimeViews(): void;
  addToWindow(window: Window): void;
  removeFromWindow(window: Window): void;
  shutdown(): Promise<void>;
}

interface SidebarModule {
  SidebarManager: new (options: SidebarOptions) => SidebarInstance;
}

interface CodexSidebarHost {
  readonly connected: boolean;
  readonly binaryPath: string;
  reconnect(): Promise<void>;
  settings: PreferencesApi & { mount(root: Element): void };
}

interface ZoteroCodexModuleRegistry {
  CodexClient: CodexClientModule;
  Localization: LocalizationModule;
  Preferences: PreferencesModule;
  Protocol: ProtocolModule;
  RuntimeSettings: RuntimeSettingsModule;
  Sidebar: SidebarModule;
}

declare var ZoteroCodexModules: Partial<ZoteroCodexModuleRegistry> | undefined;
