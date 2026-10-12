interface IOUtilsHost {
  makeDirectory(path: string, options?: { createAncestors?: boolean; permissions?: number }): Promise<void>;
  stat(path: string): Promise<{ type: string }>;
  copy(source: string, target: string, options?: { noOverwrite?: boolean }): Promise<void>;
  setPermissions(path: string, permissions: number): Promise<void>;
}

interface PathUtilsHost {
  join(...parts: string[]): string;
}

interface ServicesHost {
  env: { get(name: string): string };
  locale?: { appLocaleAsBCP47?: string };
}

interface ZoteroHost {
  isWin: boolean;
  getMainWindow?(): Window | null;
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

declare var module: { exports?: unknown } | undefined;
