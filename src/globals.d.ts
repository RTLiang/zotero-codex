interface IOUtilsHost {
  makeDirectory(path: string, options?: { createAncestors?: boolean; permissions?: number }): Promise<void>;
  stat(path: string): Promise<{ type: string }>;
  copy(source: string, target: string, options?: { noOverwrite?: boolean }): Promise<void>;
  setPermissions(path: string, permissions: number): Promise<void>;
  readJSON(path: string): Promise<unknown>;
  writeJSON(path: string, value: unknown, options?: { tmpPath?: string; mode?: "overwrite"; flush?: boolean }): Promise<void>;
  exists?(path: string): Promise<boolean>;
  getChildren?(directory: string): Promise<string[]>;
}

interface PathUtilsHost {
  join(...parts: string[]): string;
}

interface ServicesHost {
  obs: {
    addObserver(observer: { observe(subject: NetworkSubject): void }, topic: string): void;
    removeObserver(observer: { observe(subject: NetworkSubject): void }, topic: string): void;
  };
  env: { get(name: string): string };
  locale?: { appLocaleAsBCP47?: string };
  prefs: { savePrefFile(file: unknown): void };
  dirsvc: { get(name: string, interfaceID: unknown): { path: string } };
}

interface LocalFile {
  initWithPath(path: string): void;
  exists(): boolean;
  isFile(): boolean;
}

interface ZoteroHost {
  isWin: boolean;
  isMac?: boolean;
  isLinux?: boolean;
  getMainWindow?(): Window | null;
  getMainWindows(): Window[];
  debug(message: string): void;
  logError(error: unknown): void;
  Prefs: {
    get(key: string, global?: boolean): unknown;
    set(key: string, value: unknown, global?: boolean): void;
  };
  File: {
    getResourceAsync(path: string): Promise<string>;
  };
  DataDirectory: { dir: string };
  PreferencePanes: {
    register(options: { pluginID: string; id: string; label: string; src: string }): Promise<void>;
  };
  CodexSidebar?: CodexSidebarHost;
}

interface Window {
  Localization?: L10nConstructor;
}

interface Document {
  l10n?: {
    setAttributes?(element: Element, id: string, args?: Record<string, unknown>): void;
    formatValue?(id: string, args?: Record<string, unknown>): Promise<string | null>;
  };
}

declare var IOUtils: IOUtilsHost;
declare var PathUtils: PathUtilsHost;
declare var Services: ServicesHost;
declare var Zotero: ZoteroHost;
declare var Ci: { nsIFile: unknown; nsIHttpChannel: unknown };
declare var Cc: Record<string, { createInstance(interfaceID: unknown): LocalFile } | undefined>;
declare var ChromeUtils: { importESModule(url: string): any };

declare var module: { exports?: unknown } | undefined;
