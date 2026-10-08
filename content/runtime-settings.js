(function (global) {
  "use strict";
  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};
  const KEYS = ["codexPath", "proxyMode", "proxyURL", "proxyBypass", "codexHome", "workingDirectory"];
  const PROXY_KEYS = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];

  function validate(values, windows = false) {
    const result = Object.fromEntries(KEYS.map(key => [key, String(values[key] || "").trim()]));
    result.proxyMode ||= "inherit";
    if (!["inherit", "direct", "manual"].includes(result.proxyMode)) throw new Error("Invalid proxy mode");
    const absolutePath = windows ? /^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/i : /^\//;
    for (const key of ["codexPath", "codexHome", "workingDirectory"]) {
      const path = result[key];
      if (path && (!absolutePath.test(path) || /[\x00-\x1f]/.test(path))) {
        throw new Error(`${key}: use an absolute path (no ~ or environment variables)`);
      }
    }
    if (result.proxyMode === "manual") {
      let url;
      try { url = new URL(result.proxyURL); } catch (_) { throw new Error("Proxy URL: use http://host:port or socks5h://host:port"); }
      if (!["http:", "https:", "socks5:", "socks5h:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
        throw new Error("Proxy URL must contain only a supported scheme, host and optional port; credentials are not stored here");
      }
    }
    return result;
  }

  function environment(settings) {
    const env = {};
    if (settings.proxyMode !== "inherit") {
      for (const key of PROXY_KEYS) env[key] = settings.proxyMode === "manual" ? settings.proxyURL : "";
      env.NO_PROXY = env.no_proxy = settings.proxyMode === "direct" ? "*" : (settings.proxyBypass || "localhost,127.0.0.1,::1");
    }
    if (settings.codexHome) {
      env.CODEX_HOME = settings.codexHome;
      // Do not let a desktop-wide override send this storage's DB elsewhere.
      env.CODEX_SQLITE_HOME = settings.codexHome;
    }
    return env;
  }

  function scopedKey(name, home) {
    return home && ["lastThreadId", "paperThreads"].includes(name)
      ? `storage.${encodeURIComponent(home)}.${name}` : name;
  }

  function read(getPreference) {
    return validate(Object.fromEntries(KEYS.map(key => [key, getPreference(key)])), Boolean(global.Zotero?.isWin));
  }

  async function prepare(settings) {
    for (const path of new Set([settings.codexHome, settings.workingDirectory].filter(Boolean))) {
      await global.IOUtils.makeDirectory(path, { createAncestors: true, permissions: 0o700 });
      if ((await global.IOUtils.stat(path)).type !== "directory") throw new Error(`Not a directory: ${path}`);
    }
  }

  async function importLogin(destination) {
    if (!destination) throw new Error("Choose a dedicated Codex storage directory first");
    const inherited = global.Services.env.get("CODEX_HOME");
    const home = modules.CodexClient.getHomeDirectory();
    const source = global.PathUtils.join(inherited || global.PathUtils.join(home, ".codex"), "auth.json");
    const target = global.PathUtils.join(destination, "auth.json");
    if (source === target) throw new Error("Source and destination are the same");
    // No token parsing or logging; never overwrite credentials refreshed by Codex.
    await global.IOUtils.copy(source, target, { noOverwrite: true });
    await global.IOUtils.setPermissions(target, 0o600);
  }

  modules.RuntimeSettings = { KEYS, PROXY_KEYS, validate, environment, scopedKey, read, prepare, importLogin };
})(typeof globalThis !== "undefined" ? globalThis : this);
