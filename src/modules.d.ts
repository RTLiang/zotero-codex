interface CodexClientModule {
  getHomeDirectory(): string;
}

interface ZoteroCodexModuleRegistry {
  CodexClient: CodexClientModule;
  Protocol: ProtocolModule;
  RuntimeSettings: RuntimeSettingsModule;
}

declare var ZoteroCodexModules: Partial<ZoteroCodexModuleRegistry>;
