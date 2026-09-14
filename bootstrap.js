var ZoteroCodexPlugin;

function log(message, error) {
  Zotero.debug(`Codex Sidebar: ${message}`);
  if (error) Zotero.logError(error);
}

function install({ version }) {
  log(`Installed ${version}`);
}

async function startup({ id, version, rootURI }) {
  await Zotero.uiReadyPromise;

  for (const script of [
    "content/protocol.js",
    "content/codex-client.js",
    "content/markdown.js",
    "content/sidebar.js",
    "content/main.js",
  ]) {
    Services.scriptloader.loadSubScript(rootURI + script);
  }

  await ZoteroCodexPlugin.init({ id, version, rootURI });
  ZoteroCodexPlugin.addToAllWindows();
}

function onMainWindowLoad({ window }) {
  ZoteroCodexPlugin?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  ZoteroCodexPlugin?.removeFromWindow(window);
}

async function shutdown() {
  try {
    await ZoteroCodexPlugin?.shutdown();
  }
  catch (error) {
    log("Shutdown failed", error);
  }
  ZoteroCodexPlugin = undefined;
}

function uninstall({ version }) {
  log(`Uninstalled ${version}`);
}
