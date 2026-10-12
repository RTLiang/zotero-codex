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
}

interface ZoteroHost {
  isWin: boolean;
}

declare var IOUtils: IOUtilsHost;
declare var PathUtils: PathUtilsHost;
declare var Services: ServicesHost;
declare var Zotero: ZoteroHost;

declare var module: { exports?: unknown } | undefined;
