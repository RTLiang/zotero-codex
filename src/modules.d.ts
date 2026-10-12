interface CodexClientOptions {
  getPreference?: (name: string) => any;
  log?: (message: string, error?: unknown) => void;
}

interface CodexClientInstance {
  process?: unknown;
  binaryPath?: string;
  account?: unknown;
  connecting?: unknown;
  pending: { size: number };
  reconnect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  connect(): Promise<unknown>;
  subscribe(listener: (event: unknown) => void): () => void;
}

interface CodexClientModule {
  CodexAppServerClient: new (options?: CodexClientOptions) => CodexClientInstance;
  resolveCodexPath(configuredPath?: string): Promise<string>;
  clientError(l10nID: string, l10nArgs: unknown, fallback: string): LocalizedError;
  publicError(error: unknown): string;
  getHomeDirectory(): string;
  processPath(binaryPath: string): string;
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
  reconnect(): Promise<unknown>;
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
