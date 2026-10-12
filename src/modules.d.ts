interface CodexClientModule {
  getHomeDirectory(): string;
}

interface ZoteroCodexModuleRegistry {
  CodexClient: CodexClientModule;
  Localization: LocalizationModule;
  Protocol: ProtocolModule;
  RuntimeSettings: RuntimeSettingsModule;
}

declare var ZoteroCodexModules: Partial<ZoteroCodexModuleRegistry>;
