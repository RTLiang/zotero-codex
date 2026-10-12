interface CodexClientModule {
  getHomeDirectory(): string;
}

interface ZoteroCodexModuleRegistry {
  CodexClient: CodexClientModule;
  RuntimeSettings: RuntimeSettingsModule;
}

declare var ZoteroCodexModules: Partial<ZoteroCodexModuleRegistry>;
