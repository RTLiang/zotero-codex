(function (global) {
  "use strict";

  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};
  const Protocol = modules.Protocol;
  const ClientTools = modules.CodexClient;
  const Markdown = modules.Markdown;
  const L10N_RESOURCE = "zotero-codex.ftl";
  const EFFORT_L10N_IDS = {
    none: "zotero-codex-effort-none",
    minimal: "zotero-codex-effort-minimal",
    low: "zotero-codex-effort-low",
    medium: "zotero-codex-effort-medium",
    high: "zotero-codex-effort-high",
    xhigh: "zotero-codex-effort-xhigh",
    max: "zotero-codex-effort-max",
    ultra: "zotero-codex-effort-ultra",
  };
  const MAX_IMAGE_COUNT = 10;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_SELECTION_ATTACHMENTS = 50;
  const THREAD_LIST_BATCH_SIZE = 40;
  const SLASH_COMMANDS = [
    { name: "skills", descriptionID: "zotero-codex-command-skills", description: "Choose a skill" },
    { name: "approvals", descriptionID: "zotero-codex-command-approvals", description: "Adjust approvals and access" },
    { name: "model", descriptionID: "zotero-codex-command-model", description: "Choose model and reasoning" },
    { name: "new", descriptionID: "zotero-codex-command-new", description: "Start a new chat" },
  ];
  const MIN_SHELL_HEIGHT = 360;
  const MAX_SHELL_HEIGHT = 1200;
  const SHELL_HEIGHT_STEP = 24;
  const ACCEPTED_IMAGE_TYPES = new Set([
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  function normalizeShellHeight(value) {
    const height = Math.round(Number(value));
    if (!Number.isFinite(height) || height <= 0) return 0;
    return Math.max(MIN_SHELL_HEIGHT, Math.min(MAX_SHELL_HEIGHT, height));
  }

  function create(doc, tag, className = "", text = null) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function createUIIcon(doc, name) {
    const paths = {
      codex: "M8 4 3 9l5 5m8-10 5 5-5 5M13.5 2l-3 14",
      plus: "M9 3v12M3 9h12",
      search: "M12 12l4 4M13 7.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0",
      refresh: "M15 7a6 6 0 1 0-1 6M15 2v5h-5",
      chevron: "m6 7 3 3 3-3",
      back: "M15 9H3m5-5L3 9l5 5",
      close: "M5 5l8 8M13 5l-8 8",
      skill: "m9 1 2.2 5.8L17 9l-5.8 2.2L9 17l-2.2-5.8L1 9l5.8-2.2Z",
      shield: "M9 1.5 15 4v5c0 3.2-3 5.8-6 7.5C6 14.8 3 12.2 3 9V4Zm-3 7 2 2 4-4",
      chat: "M3 2.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7L2 17V3.5a1 1 0 0 1 1-1Z",
    };
    const icon = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "zcs-ui-icon");
    icon.setAttribute("viewBox", name === "codex" ? "0 0 24 18" : "0 0 18 18");
    icon.setAttribute("aria-hidden", "true");
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", paths[name]);
    icon.append(path);
    return icon;
  }

  function createDocumentIcon(doc) {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = doc.createElementNS(namespace, "svg");
    icon.setAttribute("class", "zcs-document-icon");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("fill", "none");
    icon.setAttribute("aria-hidden", "true");
    const page = doc.createElementNS(namespace, "rect");
    page.setAttribute("x", "3");
    page.setAttribute("y", "2.25");
    page.setAttribute("width", "10");
    page.setAttribute("height", "11.5");
    page.setAttribute("rx", "1.5");
    const lines = doc.createElementNS(namespace, "path");
    lines.setAttribute("d", "M5.25 5.5h5.5M5.25 8h5.5M5.25 10.5h3.75");
    icon.append(page, lines);
    return icon;
  }

  function createImageIcon(doc) {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = doc.createElementNS(namespace, "svg");
    icon.setAttribute("class", "zcs-image-icon");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("fill", "none");
    icon.setAttribute("aria-hidden", "true");
    const frame = doc.createElementNS(namespace, "rect");
    frame.setAttribute("x", "2.25");
    frame.setAttribute("y", "2.25");
    frame.setAttribute("width", "11.5");
    frame.setAttribute("height", "11.5");
    frame.setAttribute("rx", "2");
    const picture = doc.createElementNS(namespace, "path");
    picture.setAttribute("d", "m4.25 11 2.4-2.55 1.8 1.7 1.35-1.35 1.95 2.2M5.5 5.75h.01");
    icon.append(frame, picture);
    return icon;
  }

  function createSparkleIcon(doc) {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = doc.createElementNS(namespace, "svg");
    icon.setAttribute("class", "zcs-image-icon");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("fill", "none");
    icon.setAttribute("aria-hidden", "true");
    const sparkles = doc.createElementNS(namespace, "path");
    sparkles.setAttribute("d", "M8 1.75 9.4 6.6 14.25 8 9.4 9.4 8 14.25 6.6 9.4 1.75 8 6.6 6.6 8 1.75ZM12.75 1.75v2.5m-1.25-1.25H14");
    icon.append(sparkles);
    return icon;
  }

  function fileToDataURL(doc, file) {
    return new Promise((resolve, reject) => {
      const reader = new doc.defaultView.FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
      reader.addEventListener("error", () => reject(reader.error || new Error("Could not read image")), { once: true });
      reader.readAsDataURL(file);
    });
  }

  function formatFileSize(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
    return `${Math.round(value / 1024 / 102.4) / 10} MB`;
  }

  function displayableImageSource(image) {
    const url = String(image?.url || "");
    return /^data:image\/(?:gif|jpeg|png|webp);base64,/iu.test(url) ? url : "";
  }

  function setL10n(element, id, args = null) {
    if (!element || !id) return element;
    const l10n = element.ownerDocument?.l10n;
    if (l10n?.setAttributes) l10n.setAttributes(element, id, args || undefined);
    else {
      element.setAttribute("data-l10n-id", id);
      if (args) element.setAttribute("data-l10n-args", JSON.stringify(args));
      else element.removeAttribute("data-l10n-args");
    }
    return element;
  }

  function clearL10n(element) {
    element?.removeAttribute?.("data-l10n-id");
    element?.removeAttribute?.("data-l10n-args");
    return element;
  }

  function createL10n(doc, tag, className, id, fallback, args = null) {
    return setL10n(create(doc, tag, className, fallback), id, args);
  }

  function setLocalizedText(element, id, fallback, args = null) {
    element.textContent = fallback;
    return setL10n(element, id, args);
  }

  function setPlainText(element, text) {
    clearL10n(element);
    element.textContent = text;
    return element;
  }

  async function formatValue(doc, id, args, fallback) {
    try {
      return await doc?.l10n?.formatValue?.(id, args || undefined) || fallback;
    }
    catch (_error) {
      return fallback;
    }
  }

  async function copyMessageText(doc, value) {
    const text = String(value || "");
    try {
      const clipboard = doc?.defaultView?.navigator?.clipboard;
      if (clipboard?.writeText) {
        await clipboard.writeText(text);
        return true;
      }
    }
    catch (_error) {}
    try {
      const helper = global.Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(global.Ci.nsIClipboardHelper);
      helper.copyString(text);
      return true;
    }
    catch (_error) {}
    try {
      const input = create(doc, "textarea", "zcs-clipboard-fallback", text);
      doc.body.append(input);
      input.select();
      const copied = Boolean(doc.execCommand?.("copy"));
      input.remove();
      return copied;
    }
    catch (_error) {
      return false;
    }
  }

  function setButtonLabel(button, label, l10nID, fallbackTitle) {
    button.textContent = label;
    button.title = fallbackTitle;
    button.setAttribute("aria-label", fallbackTitle);
    setL10n(button, l10nID);
  }

  function openMarkdownTarget(target) {
    const value = String(target || "").trim();
    if (/^https?:\/\//iu.test(value)) {
      global.Zotero.launchURL(value);
      return;
    }
    const path = value.replace(/^file:\/\//iu, "");
    if (!path.startsWith("/")) return;
    if (typeof global.Zotero.launchFile === "function") {
      global.Zotero.launchFile(path);
      return;
    }
    global.Zotero.File?.reveal?.(path);
  }

  function getField(item, field) {
    try {
      return String(item?.getField?.(field) || "").trim();
    }
    catch (_error) {
      return "";
    }
  }

  function isPDF(item) {
    try {
      if (item?.isPDFAttachment?.()) return true;
    }
    catch (_error) {}
    return String(item?.attachmentContentType || "").toLowerCase() === "application/pdf";
  }

  async function attachmentPath(item) {
    try {
      return String((await item?.getFilePathAsync?.()) || "").trim();
    }
    catch (_error) {
      return "";
    }
  }

  function pathDirectory(path) {
    const value = String(path || "");
    const index = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
    return index > 0 ? value.slice(0, index) : "";
  }

  async function resolveItemContext(item, tabType) {
    if (!item) return { tabType };
    let bibliographicItem = item;
    let pdfItem = isPDF(item) ? item : null;

    if (item.parentItemID) {
      const parent = global.Zotero.Items.get(item.parentItemID);
      if (parent) bibliographicItem = parent;
    }

    if (!pdfItem) {
      let ids = [];
      try {
        ids = bibliographicItem.getAttachments?.() || [];
      }
      catch (_error) {}
      for (const id of ids) {
        const candidate = global.Zotero.Items.get(id);
        if (candidate && isPDF(candidate)) {
          pdfItem = candidate;
          break;
        }
      }
    }

    const creators = (() => {
      try {
        return Protocol.formatCreators(bibliographicItem.getCreators?.() || []);
      }
      catch (_error) {
        return "";
      }
    })();
    const pdfPath = await attachmentPath(pdfItem);
    return {
      tabType,
      libraryID: Number(bibliographicItem.libraryID) || 0,
      itemID: Number(bibliographicItem.id) || null,
      itemKey: bibliographicItem.key || "",
      attachmentID: Number(pdfItem?.id) || null,
      title: getField(bibliographicItem, "title") || getField(item, "title"),
      creators,
      date: getField(bibliographicItem, "date"),
      doi: getField(bibliographicItem, "DOI"),
      url: getField(bibliographicItem, "url"),
      abstract: getField(bibliographicItem, "abstractNote"),
      pdfPath,
    };
  }

  function appendMarkdown(doc, parent, value) {
    Markdown.appendMarkdown(doc, parent, value, { openTarget: openMarkdownTarget });
  }

  class SidebarView {
    constructor(manager, props) {
      this.manager = manager;
      this.client = manager.client;
      this.doc = props.doc;
      this.body = props.body;
      this.item = props.item;
      this.tabType = props.tabType;
      this.context = null;
      this.threadID = "";
      this.thread = null;
      this.threads = [];
      this.models = [];
      this.skills = [];
      this.skillsCwd = "";
      this.skillsLoadSerial = 0;
      this.commandMatches = [];
      this.commandIndex = 0;
      this.activePage = "chat";
      this.selectedModel = "";
      this.selectedEffort = "";
      this.nextTurnSelectionPending = false;
      this.activeTurnID = "";
      this.running = false;
      this.creatingTask = false;
      this.streamingText = "";
      this.streamingNode = null;
      this.streamingItemID = "";
      this.streamingPhase = "final";
      this.pendingResponseNode = null;
      this.editingMessage = null;
      this.images = [];
      this.loadSerial = 0;
      this.initialized = false;
      this.initializing = false;
      this.activePaperKey = "";
      this.destroyed = false;
      this.pendingRequests = new Map();
      this.shellResize = null;
      this.contextEpoch = 0;
      this.contextTransitioning = false;
      this.threadRefreshSerial = 0;
      this.threadListLimit = THREAD_LIST_BATCH_SIZE;
      this.threadListMatchCount = 0;
      this.statusRevision = 0;
      this.managingThreadID = "";
      this.contextMenuThreadID = "";
      this.cleanupClient = this.client.subscribe((event) => this._handleClientEvent(event));
      this.mount();
    }

    mount() {
      const doc = this.doc;
      this.body.replaceChildren();
      const root = create(doc, "section", "zcs-shell");
      root.setAttribute("aria-label", "Codex");

      const topbar = create(doc, "header", "zcs-topbar");
      const connectionState = createL10n(doc, "span", "zcs-connection-state", "zotero-codex-offline", "Not connected");
      connectionState.setAttribute("role", "status");
      const headerNewButton = createL10n(doc, "button", "zcs-icon-button", "zotero-codex-new-chat-button", null);
      headerNewButton.type = "button";
      headerNewButton.setAttribute("aria-label", "New chat");
      headerNewButton.title = "New chat";
      headerNewButton.append(createUIIcon(doc, "plus"));
      const pagePrefix = `zcs-page-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const workspace = create(doc, "div", "zcs-workspace");
      const chatView = create(doc, "section", "zcs-chat-view");
      chatView.id = `${pagePrefix}-chat`;
      const threadButton = create(doc, "button", "zcs-thread-trigger");
      threadButton.type = "button";
      threadButton.setAttribute("aria-haspopup", "dialog");
      threadButton.setAttribute("aria-expanded", "false");
      const threadTitle = createL10n(
        doc,
        "span",
        "zcs-thread-title",
        "zotero-codex-new-task",
        "New chat",
      );
      threadButton.append(threadTitle, createUIIcon(doc, "chevron"));
      const moreButton = create(doc, "button", "zcs-icon-button zcs-more-button", "•••");
      moreButton.type = "button";
      moreButton.setAttribute("aria-haspopup", "dialog");
      moreButton.setAttribute("aria-expanded", "false");
      moreButton.title = "Settings";
      moreButton.setAttribute("aria-label", "Settings");
      setL10n(moreButton, "zotero-codex-settings-button");
      topbar.append(headerNewButton, threadButton, moreButton);

      const threadPopover = create(doc, "section", "zcs-popover zcs-thread-popover");
      threadPopover.id = `${pagePrefix}-threads`;
      threadPopover.hidden = true;
      threadPopover.setAttribute("role", "dialog");
      threadPopover.setAttribute("aria-label", "Recent conversations");
      setL10n(threadPopover, "zotero-codex-recent-tasks");
      const threadSearchBox = create(doc, "div", "zcs-search-box");
      threadSearchBox.append(createUIIcon(doc, "search"));
      const threadSearch = create(doc, "input", "zcs-thread-search");
      threadSearch.type = "search";
      threadSearch.placeholder = "Search conversations";
      threadSearch.setAttribute("aria-label", "Search conversations");
      setL10n(threadSearch, "zotero-codex-search-tasks");
      threadSearchBox.append(threadSearch);
      const newThreadButton = create(doc, "button", "zcs-menu-row zcs-new-thread-row");
      newThreadButton.type = "button";
      newThreadButton.append(
        create(doc, "span", "zcs-row-icon", "+"),
        createL10n(doc, "span", "zcs-row-copy", "zotero-codex-new-task", "New chat"),
      );
      const paperOnlyFilter = create(doc, "label", "zcs-paper-only-filter");
      const paperOnlyCheckbox = create(doc, "input");
      paperOnlyCheckbox.type = "checkbox";
      paperOnlyFilter.append(
        paperOnlyCheckbox,
        createL10n(doc, "span", "", "zotero-codex-paper-only-chats", "Only chats for this paper"),
      );
      const threadList = create(doc, "div", "zcs-thread-list");
      threadList.setAttribute("role", "list");
      const threadPageHeader = create(doc, "header", "zcs-page-header");
      threadPageHeader.append(createL10n(doc, "h2", "zcs-page-title", "zotero-codex-nav-chats", "Chats"));
      threadPopover.append(threadPageHeader, threadSearchBox, newThreadButton, paperOnlyFilter, threadList);

      const threadContextMenu = create(doc, "div", "zcs-popover zcs-thread-context-menu");
      threadContextMenu.hidden = true;
      threadContextMenu.setAttribute("role", "menu");
      const archiveThreadButton = createL10n(
        doc, "button", "zcs-menu-row", "zotero-codex-archive-task", "Archive chat",
      );
      archiveThreadButton.type = "button";
      archiveThreadButton.setAttribute("role", "menuitem");
      const deleteThreadButton = createL10n(
        doc, "button", "zcs-menu-row zcs-danger-row", "zotero-codex-delete-task", "Delete chat",
      );
      deleteThreadButton.type = "button";
      deleteThreadButton.setAttribute("role", "menuitem");
      threadContextMenu.append(archiveThreadButton, deleteThreadButton);

      const refreshButton = createL10n(doc, "button", "zcs-icon-button", "zotero-codex-refresh-chats-button", null);
      refreshButton.type = "button";
      refreshButton.setAttribute("aria-label", "Refresh chats");
      refreshButton.append(createUIIcon(doc, "refresh"));
      threadPageHeader.append(refreshButton);

      const settingsView = create(doc, "section", "zcs-page zcs-settings-view");
      settingsView.id = `${pagePrefix}-settings`;
      settingsView.hidden = true;
      settingsView.tabIndex = -1;
      settingsView.setAttribute("aria-label", "Codex settings");
      setL10n(settingsView, "zotero-codex-settings-view");
      const settingsHeader = create(doc, "header", "zcs-settings-header");
      const settingsBackButton = create(doc, "button", "zcs-settings-back");
      settingsBackButton.type = "button";
      settingsBackButton.append(createUIIcon(doc, "back"));
      settingsBackButton.title = "Back to chat";
      settingsBackButton.setAttribute("aria-label", "Back to chat");
      setL10n(settingsBackButton, "zotero-codex-back-to-chat");
      settingsHeader.append(
        settingsBackButton,
        createL10n(doc, "div", "zcs-settings-title", "zotero-codex-settings", "Settings"),
        create(doc, "span", "zcs-settings-header-spacer"),
      );
      const settingsContent = create(doc, "div", "zcs-settings-content");
      settingsContent.append(createL10n(
        doc,
        "div",
        "zcs-settings-section-title",
        "zotero-codex-local-codex",
        "Codex connection",
      ));
      const connectionCard = create(doc, "div", "zcs-connection-card");
      const connectionTop = create(doc, "div", "zcs-connection-top");
      const connectionIcon = create(doc, "span", "zcs-connection-icon", "C");
      const connectionCopy = create(doc, "div", "zcs-connection-copy");
      const connectionTitle = create(doc, "div", "zcs-connection-title", "Codex CLI");
      const isolatedStorage = Boolean(this.manager.getPreference("codexHome"));
      const connectionSubtitle = createL10n(
        doc,
        "div",
        "zcs-connection-subtitle",
        isolatedStorage ? "zotero-codex-cli-subtitle-isolated" : "zotero-codex-cli-subtitle",
        isolatedStorage ? "Uses a dedicated Codex storage directory." : "Uses the same sign-in and conversations as other Codex apps on this computer.",
      );
      connectionCopy.append(connectionTitle, connectionSubtitle);
      connectionTop.append(connectionIcon, connectionCopy, connectionState);
      const pathLabel = create(doc, "label", "zcs-setting-label");
      pathLabel.append(createL10n(doc, "span", "", "zotero-codex-cli-path", "Codex executable path"));
      const pathInput = create(doc, "input", "zcs-path-input");
      pathInput.type = "text";
      pathInput.placeholder = "Find automatically";
      setL10n(pathInput, "zotero-codex-cli-path-input");
      pathInput.value = String(this.manager.getPreference("codexPath") || "");
      pathLabel.append(pathInput);
      const pathStatus = createL10n(
        doc,
        "div",
        "zcs-path-status",
        "zotero-codex-cli-path-help",
        "Leave blank and Zotero will look for Codex automatically.",
      );
      const settingsActions = create(doc, "div", "zcs-settings-actions");
      const autoPathButton = createL10n(
        doc,
        "button",
        "zcs-secondary-button",
        "zotero-codex-use-auto-detect",
        "Use auto-detect",
      );
      autoPathButton.type = "button";
      const reconnectButton = createL10n(
        doc,
        "button",
        "zcs-primary-button",
        "zotero-codex-save-reconnect",
        "Save and reconnect",
      );
      reconnectButton.type = "button";
      settingsActions.append(autoPathButton, reconnectButton);
      const runtimeSettingsButton = createL10n(doc, "button", "zcs-settings-navigation",
        "zotero-codex-runtime-settings", "Proxy and storage");
      runtimeSettingsButton.type = "button";
      connectionCard.append(connectionTop, pathLabel, pathStatus, settingsActions, runtimeSettingsButton);
      const sharingNote = create(doc, "div", "zcs-settings-note");
      sharingNote.append(
        createL10n(doc, "div", "zcs-settings-note-title",
          isolatedStorage ? "zotero-codex-task-isolation" : "zotero-codex-task-sharing",
          isolatedStorage ? "Dedicated conversations" : "Shared conversations"),
        createL10n(
          doc,
          "div",
          "zcs-settings-note-copy",
          isolatedStorage ? "zotero-codex-task-isolation-copy" : "zotero-codex-task-sharing-copy",
          isolatedStorage ? "These conversations live in the selected Codex storage directory. Other Codex apps must use that directory to see them." : "Conversations you open or start here are also available in Codex Desktop, the command line, and the browser sidebar on this computer.",
        ),
      );
      const chatSectionTitle = createL10n(
        doc,
        "div",
        "zcs-settings-section-title zcs-settings-section-spaced",
        "zotero-codex-chat-settings",
        "Chat",
      );
      const chatSettingsCard = create(doc, "div", "zcs-settings-toggle-card");
      const workProcessLabel = create(doc, "label", "zcs-settings-toggle-row");
      const workProcessCopy = create(doc, "span", "zcs-settings-toggle-copy");
      workProcessCopy.append(
        createL10n(
          doc,
          "span",
          "zcs-settings-toggle-title",
          "zotero-codex-show-work-process",
          "Show activity details",
        ),
        createL10n(
          doc,
          "span",
          "zcs-settings-toggle-description",
          "zotero-codex-show-work-process-description",
          "Show tool use, file changes, and reasoning summaries when available.",
        ),
      );
      const showWorkProcessToggle = create(doc, "input", "zcs-switch-input");
      showWorkProcessToggle.type = "checkbox";
      showWorkProcessToggle.setAttribute("role", "switch");
      setL10n(showWorkProcessToggle, "zotero-codex-show-work-process-control");
      const workProcessSwitch = create(doc, "span", "zcs-switch");
      workProcessSwitch.setAttribute("aria-hidden", "true");
      workProcessLabel.append(workProcessCopy, showWorkProcessToggle, workProcessSwitch);
      chatSettingsCard.append(workProcessLabel);
      const permissionsCard = create(doc, "section", "zcs-popover zcs-permissions-card");
      permissionsCard.hidden = true;
      permissionsCard.setAttribute("role", "dialog");
      setL10n(permissionsCard, "zotero-codex-permissions-dialog");
      permissionsCard.append(createL10n(doc, "div", "zcs-page-title", "zotero-codex-permissions", "Permissions"));
      const permissionInputs = {};
      for (const [key, labelID, label, options] of [
        ["approvalPolicy", "zotero-codex-approval-policy", "Approval policy", [
          ["untrusted", "zotero-codex-approval-untrusted", "Ask for untrusted commands"],
          ["on-request", "zotero-codex-approval-on-request", "Ask when needed"],
          ["never", "zotero-codex-approval-never", "Never ask"],
        ]],
        ["approvalsReviewer", "zotero-codex-approval-reviewer", "Approval reviewer", [
          ["user", "zotero-codex-reviewer-user", "Ask me"],
          ["auto_review", "zotero-codex-reviewer-auto", "Automatic review"],
        ]],
        ["sandbox", "zotero-codex-access-level", "File access", [
          ["read-only", "zotero-codex-access-read-only", "Read only"],
          ["workspace-write", "zotero-codex-access-workspace", "Write in the working folder"],
          ["danger-full-access", "zotero-codex-access-full", "Full access"],
        ]],
      ]) {
        const field = create(doc, "label", "zcs-permission-field");
        const select = create(doc, "select", "zcs-permission-select");
        for (const [value, id, fallback] of options) {
          const option = createL10n(doc, "option", "", id, fallback);
          option.value = value;
          select.append(option);
        }
        permissionInputs[key] = select;
        field.append(createL10n(doc, "span", "", labelID, label), select);
        permissionsCard.append(field);
      }
      const networkLabel = create(doc, "label", "zcs-permission-network");
      const networkAccess = create(doc, "input");
      networkAccess.type = "checkbox";
      permissionInputs.networkAccess = networkAccess;
      networkLabel.append(networkAccess, createL10n(doc, "span", "", "zotero-codex-network-access", "Allow network access"));
      permissionsCard.append(networkLabel, createL10n(
        doc, "p", "zcs-permission-hint", "zotero-codex-permissions-hint",
        "Applies to the next reply. Full access allows file changes and network access. Never ask blocks actions requiring approval.",
      ));
      settingsContent.append(
        connectionCard,
        sharingNote,
        chatSectionTitle,
        chatSettingsCard,
      );
      settingsView.append(settingsHeader, settingsContent);

      const transcript = create(doc, "div", "zcs-transcript");
      transcript.setAttribute("role", "log");
      transcript.setAttribute("aria-live", "polite");
      transcript.append(create(doc, "div", "zcs-empty"));

      const requestArea = create(doc, "div", "zcs-request-area");
      requestArea.hidden = true;

      const composer = create(doc, "div", "zcs-composer");
      const editBanner = create(doc, "div", "zcs-edit-banner");
      editBanner.hidden = true;
      const editBannerLabel = createL10n(
        doc,
        "span",
        "zcs-edit-banner-label",
        "zotero-codex-editing-message",
        "Editing message",
      );
      const cancelEditButton = createL10n(
        doc,
        "button",
        "zcs-edit-cancel",
        "zotero-codex-cancel-edit",
        "Cancel",
      );
      cancelEditButton.type = "button";
      editBanner.append(editBannerLabel, cancelEditButton);
      const attachments = create(doc, "div", "zcs-attachments");
      attachments.hidden = true;
      const input = create(doc, "textarea", "zcs-input");
      input.rows = 1;
      input.placeholder = "Ask anything";
      setL10n(input, "zotero-codex-composer-input");
      const commandMenu = create(doc, "div", "zcs-command-menu");
      commandMenu.hidden = true;
      commandMenu.id = `zcs-commands-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      commandMenu.setAttribute("role", "listbox");
      commandMenu.setAttribute("aria-label", "Commands and skills");
      setL10n(commandMenu, "zotero-codex-command-menu");
      input.setAttribute("aria-controls", commandMenu.id);
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-expanded", "false");
      const imageInput = create(doc, "input", "zcs-image-input");
      imageInput.type = "file";
      imageInput.accept = "image/png,image/jpeg,image/webp,image/gif";
      imageInput.multiple = true;
      imageInput.hidden = true;
      const composerFooter = create(doc, "div", "zcs-composer-footer");
      const composerTools = create(doc, "div", "zcs-composer-tools");
      const contextAddButton = create(doc, "button", "zcs-composer-tool zcs-add-button", "+");
      contextAddButton.type = "button";
      contextAddButton.title = "Add Zotero context";
      contextAddButton.setAttribute("aria-label", "Add Zotero context");
      setL10n(contextAddButton, "zotero-codex-add-context");
      contextAddButton.setAttribute("aria-expanded", "false");
      const contextModeButton = create(doc, "button", "zcs-composer-tool zcs-context-mode");
      contextModeButton.type = "button";
      contextModeButton.title = "Zotero context settings";
      contextModeButton.setAttribute("aria-expanded", "false");
      setL10n(contextModeButton, "zotero-codex-context-settings");
      contextModeButton.append(
        createDocumentIcon(doc),
        createL10n(doc, "span", "zcs-context-mode-label", "zotero-codex-item", "Item"),
      );
      composerTools.append(contextAddButton, contextModeButton);
      const modelTrigger = create(doc, "button", "zcs-model-trigger");
      modelTrigger.type = "button";
      modelTrigger.setAttribute("aria-haspopup", "dialog");
      modelTrigger.setAttribute("aria-expanded", "false");
      modelTrigger.title = "Choose model and reasoning effort";
      modelTrigger.setAttribute("aria-label", modelTrigger.title);
      setL10n(modelTrigger, "zotero-codex-model-settings");
      const modelTriggerName = create(doc, "span", "zcs-model-trigger-name", "Codex");
      const modelTriggerEffort = create(doc, "span", "zcs-model-trigger-effort");
      const modelChevron = create(doc, "span", "zcs-model-chevron");
      modelChevron.setAttribute("aria-hidden", "true");
      modelTrigger.append(modelTriggerName, modelTriggerEffort, modelChevron);
      const sendButton = create(doc, "button", "zcs-send-button", "↑");
      sendButton.type = "button";
      sendButton.title = "Send";
      sendButton.setAttribute("aria-label", "Send");
      setL10n(sendButton, "zotero-codex-send");
      const permissionsButton = createL10n(doc, "button", "zcs-permissions-trigger", "zotero-codex-access-settings", null);
      permissionsButton.type = "button";
      permissionsButton.setAttribute("aria-haspopup", "dialog");
      permissionsButton.setAttribute("aria-expanded", "false");
      const permissionLabel = create(doc, "span", "zcs-permissions-label", "Read only");
      permissionsButton.append(createUIIcon(doc, "shield"), permissionLabel);
      const quickControls = create(doc, "div", "zcs-quick-controls");
      quickControls.append(modelTrigger, permissionsButton);
      composerFooter.append(composerTools, sendButton);
      composer.append(commandMenu, editBanner, attachments, input, imageInput, composerFooter);

      const contextPopover = create(doc, "div", "zcs-popover zcs-context-popover");
      contextPopover.hidden = true;
      contextPopover.setAttribute("role", "menu");
      const imageOption = create(doc, "button", "zcs-menu-row zcs-image-option");
      imageOption.type = "button";
      const imageOptionIcon = create(doc, "span", "zcs-row-icon");
      imageOptionIcon.append(createImageIcon(doc));
      imageOption.append(
        imageOptionIcon,
        createL10n(doc, "span", "zcs-row-copy", "zotero-codex-add-image", "Add image"),
      );
      const generateImageOption = create(doc, "button", "zcs-menu-row zcs-generate-image-option");
      generateImageOption.type = "button";
      const generateImageIcon = create(doc, "span", "zcs-row-icon");
      generateImageIcon.append(createSparkleIcon(doc));
      generateImageOption.append(
        generateImageIcon,
        createL10n(doc, "span", "zcs-row-copy", "zotero-codex-generate-image", "Generate image"),
      );
      const contextOption = create(doc, "button", "zcs-menu-row zcs-context-option");
      contextOption.type = "button";
      const contextCheck = create(doc, "span", "zcs-row-icon zcs-context-check", "✓");
      const contextCopy = create(doc, "span", "zcs-row-copy");
      const contextTitle = createL10n(
        doc,
        "span",
        "zcs-row-title",
        "zotero-codex-include-current-item",
        "Include current item",
      );
      const contextMeta = createL10n(
        doc,
        "span",
        "zcs-row-meta",
        "zotero-codex-reading-current-item",
        "Reading current item…",
      );
      contextCopy.append(contextTitle, contextMeta);
      contextOption.append(contextCheck, contextCopy);
      const selections = create(doc, "div", "zcs-context-selections");
      contextPopover.append(imageOption, generateImageOption, contextOption, selections);

      const modelPopover = create(doc, "section", "zcs-popover zcs-model-popover");
      modelPopover.hidden = true;
      modelPopover.setAttribute("role", "dialog");
      modelPopover.setAttribute("aria-label", "Model and reasoning");
      setL10n(modelPopover, "zotero-codex-model-dialog");
      const modelPopoverTitle = createL10n(
        doc,
        "div",
        "zcs-model-popover-title",
        "zotero-codex-model-and-reasoning",
        "Model and reasoning",
      );
      const modelNextTurnHint = createL10n(
        doc,
        "div",
        "zcs-model-next-turn",
        "zotero-codex-model-next-reply",
        "Applies to the next reply",
      );
      modelNextTurnHint.hidden = true;
      const modelField = create(doc, "div", "zcs-model-field");
      modelField.append(createL10n(doc, "span", "zcs-model-field-label", "zotero-codex-model", "Model"));
      const modelChoice = create(doc, "button", "zcs-model-choice");
      modelChoice.type = "button";
      modelChoice.setAttribute("aria-haspopup", "listbox");
      modelChoice.setAttribute("aria-expanded", "false");
      modelChoice.setAttribute("aria-label", "Model");
      setL10n(modelChoice, "zotero-codex-model-choice");
      const modelChoiceText = create(doc, "span", "zcs-model-choice-text", "Codex");
      modelChoice.append(modelChoiceText, create(doc, "span", "zcs-model-choice-chevron", "⌄"));
      const modelOptions = create(doc, "div", "zcs-model-options");
      modelOptions.hidden = true;
      modelOptions.setAttribute("role", "listbox");
      modelField.append(modelChoice, modelOptions);
      const effortField = create(doc, "div", "zcs-model-field");
      effortField.append(createL10n(
        doc,
        "span",
        "zcs-model-field-label",
        "zotero-codex-reasoning-effort",
        "Reasoning effort",
      ));
      const effortChoice = create(doc, "button", "zcs-model-choice");
      effortChoice.type = "button";
      effortChoice.setAttribute("aria-haspopup", "listbox");
      effortChoice.setAttribute("aria-expanded", "false");
      effortChoice.setAttribute("aria-label", "Reasoning effort");
      setL10n(effortChoice, "zotero-codex-effort-choice");
      const effortChoiceText = create(doc, "span", "zcs-model-choice-text");
      effortChoice.append(effortChoiceText, create(doc, "span", "zcs-model-choice-chevron", "⌄"));
      const effortOptions = create(doc, "div", "zcs-model-options zcs-effort-options");
      effortOptions.hidden = true;
      effortOptions.setAttribute("role", "listbox");
      effortField.append(effortChoice, effortOptions);
      modelPopover.append(modelPopoverTitle, modelNextTurnHint, modelField, effortField);

      const status = create(doc, "div", "zcs-toast");
      status.hidden = true;
      status.setAttribute("role", "alert");
      const statusText = create(doc, "span", "zcs-status-text");
      status.append(statusText);

      const resizeHandle = create(doc, "div", "zcs-resize-handle");
      resizeHandle.tabIndex = 0;
      resizeHandle.setAttribute("role", "separator");
      resizeHandle.setAttribute("aria-orientation", "horizontal");
      resizeHandle.setAttribute("aria-valuemin", String(MIN_SHELL_HEIGHT));
      resizeHandle.setAttribute("aria-valuemax", String(MAX_SHELL_HEIGHT));
      resizeHandle.setAttribute("aria-label", "Resize chat height");
      resizeHandle.title = "Drag to resize chat height";
      setL10n(resizeHandle, "zotero-codex-resize-height");

      chatView.append(transcript, requestArea, composer, quickControls);
      workspace.append(chatView, settingsView);
      root.append(
        topbar,
        workspace,
        threadPopover,
        threadContextMenu,
        contextPopover,
        modelPopover,
        permissionsCard,
        status,
        resizeHandle,
      );
      this.body.append(root);
      this.elements = {
        root,
        topbar,
        chatView,
        connectionState,
        headerNewButton,
        permissionsButton,
        permissionLabel,
        permissionsCard,
        threadButton,
        threadTitle,
        moreButton,
        threadPopover,
        threadContextMenu,
        archiveThreadButton,
        deleteThreadButton,
        threadSearch,
        newThreadButton,
        paperOnlyFilter,
        paperOnlyCheckbox,
        threadList,
        settingsView,
        settingsBackButton,
        runtimeSettingsButton,
        refreshButton,
        status,
        statusText,
        resizeHandle,
        contextPopover,
        contextAddButton,
        contextModeButton,
        imageOption,
        generateImageOption,
        contextOption,
        contextCheck,
        contextTitle,
        contextMeta,
        selections,
        attachments,
        transcript,
        requestArea,
        composer,
        editBanner,
        cancelEditButton,
        input,
        imageInput,
        modelTrigger,
        modelTriggerName,
        modelTriggerEffort,
        modelPopover,
        modelNextTurnHint,
        modelChoice,
        modelChoiceText,
        modelOptions,
        effortChoice,
        effortChoiceText,
        effortOptions,
        sendButton,
        pathInput,
        pathStatus,
        autoPathButton,
        connectionCard,
        connectionTitle,
        connectionSubtitle,
        reconnectButton,
        showWorkProcessToggle,
        permissionInputs,
        commandMenu,
      };

      this.handlers = {
        permissionSettings: () => {
          this.togglePopover("permissions");
        },
        openRuntimeSettings: () => global.Zotero.getMainWindow().ZoteroPane.openPreferences("zotero-codex-settings"),
        toggleThreads: () => this.togglePopover("threads"),
        threadHeaderContextMenu: (event) => {
          if (!this.threadID) return;
          event.preventDefault();
          this.openThreadContextMenu(this.threadID, event.clientX, event.clientY);
        },
        toggleSettings: () => this.openSettings(),
        toggleContextMenu: () => this.togglePopover("context"),
        toggleModelMenu: () => this.togglePopover("model"),
        toggleModelOptions: () => this.toggleModelOptions("model"),
        toggleEffortOptions: () => this.toggleModelOptions("effort"),
        cancelEdit: () => this.cancelEdit(),
        newTask: () => void this.newTask(),
        togglePaperOnly: () => {
          this.manager.setPreference("paperOnlyChats", paperOnlyCheckbox.checked);
          this.threadListLimit = THREAD_LIST_BATCH_SIZE;
          threadList.scrollTop = 0;
          this.renderThreadPicker();
          void this.refreshThreads();
        },
        refresh: () => {
          this.closePopovers();
          void this.refreshThreads({ reloadCurrent: true });
        },
        closeSettings: () => this.closeSettings(),
        useAutoPath: () => {
          pathInput.value = "";
          pathInput.focus();
        },
        searchThreads: () => {
          this.threadListLimit = THREAD_LIST_BATCH_SIZE;
          threadList.scrollTop = 0;
          this.renderThreadPicker();
        },
        loadMoreThreads: () => this.loadMoreThreads(),
        archiveThread: () => void this.manageThread("archive"),
        deleteThread: () => void this.manageThread("delete"),
        toggleContext: () => this.toggleItemContext(),
        chooseImages: () => {
          this.closePopovers();
          imageInput.click();
        },
        chooseImageGeneration: () => {
          this.closePopovers();
          const current = input.value.trim();
          if (!/(^|\s)\$imagegen\b/u.test(current)) {
            input.value = current ? `$imagegen ${current}` : "$imagegen ";
          }
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          this.resizeComposer();
          this.updateComposerState();
        },
        imagesSelected: () => {
          const files = Array.from(imageInput.files || []);
          imageInput.value = "";
          void this.addImageFiles(files);
        },
        paste: (event) => {
          const files = Array.from(event.clipboardData?.items || [])
            .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter(Boolean);
          if (!files.length) return;
          event.preventDefault();
          void this.addImageFiles(files);
        },
        dragover: (event) => {
          if (this.running || this.creatingTask) return;
          const hasImage = Array.from(event.dataTransfer?.items || [])
            .some((item) => item.kind === "file" && item.type.startsWith("image/"));
          if (!hasImage) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          composer.classList.add("zcs-composer-dragging");
        },
        dragleave: (event) => {
          if (!composer.contains(event.relatedTarget)) composer.classList.remove("zcs-composer-dragging");
        },
        drop: (event) => {
          composer.classList.remove("zcs-composer-dragging");
          if (this.running || this.creatingTask) return;
          const files = Array.from(event.dataTransfer?.files || [])
            .filter((file) => file.type.startsWith("image/"));
          if (!files.length) return;
          event.preventDefault();
          void this.addImageFiles(files);
        },
        sendOrStop: () => this.running ? void this.stop() : void this.send(),
        reconnect: () => void this.reconnect(),
        toggleWorkProcess: () => {
          this.manager.setShowWorkProcess(showWorkProcessToggle.checked);
        },
        resizeStart: (event) => this.startShellResize(event),
        resizeMove: (event) => this.moveShellResize(event),
        resizeEnd: (event) => this.finishShellResize(event),
        resizeKeydown: (event) => this.resizeShellWithKeyboard(event),
        input: () => {
          this.closePopovers();
          this.commandIndex = 0;
          this.resizeComposer();
          this.updateComposerState();
          this.updateCommandMenu();
        },
        keydown: (event) => {
          if (this.handleCommandKey(event)) return;
          if ((!this.running || input.value.startsWith("/")) && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            void this.send();
          }
        },
        documentPointerdown: (event) => this.handleDocumentPointerdown(event),
        permissionChange: () => this.savePermissions(),
        documentKeydown: (event) => {
          if (event.key !== "Escape") return;
          if (!this.elements.settingsView.hidden) this.closeSettings();
          else this.closePopovers();
        },
      };
      threadButton.addEventListener("click", this.handlers.toggleThreads);
      headerNewButton.addEventListener("click", this.handlers.newTask);
      permissionsButton.addEventListener("click", this.handlers.permissionSettings);
      threadButton.addEventListener("contextmenu", this.handlers.threadHeaderContextMenu);
      moreButton.addEventListener("click", this.handlers.toggleSettings);
      contextAddButton.addEventListener("click", this.handlers.toggleContextMenu);
      contextModeButton.addEventListener("click", this.handlers.toggleContextMenu);
      modelTrigger.addEventListener("click", this.handlers.toggleModelMenu);
      modelChoice.addEventListener("click", this.handlers.toggleModelOptions);
      effortChoice.addEventListener("click", this.handlers.toggleEffortOptions);
      cancelEditButton.addEventListener("click", this.handlers.cancelEdit);
      newThreadButton.addEventListener("click", this.handlers.newTask);
      paperOnlyCheckbox.addEventListener("change", this.handlers.togglePaperOnly);
      refreshButton.addEventListener("click", this.handlers.refresh);
      runtimeSettingsButton.addEventListener("click", this.handlers.openRuntimeSettings);
      settingsBackButton.addEventListener("click", this.handlers.closeSettings);
      autoPathButton.addEventListener("click", this.handlers.useAutoPath);
      threadSearch.addEventListener("input", this.handlers.searchThreads);
      threadList.addEventListener("scroll", this.handlers.loadMoreThreads);
      archiveThreadButton.addEventListener("click", this.handlers.archiveThread);
      deleteThreadButton.addEventListener("click", this.handlers.deleteThread);
      contextOption.addEventListener("click", this.handlers.toggleContext);
      imageOption.addEventListener("click", this.handlers.chooseImages);
      generateImageOption.addEventListener("click", this.handlers.chooseImageGeneration);
      sendButton.addEventListener("click", this.handlers.sendOrStop);
      reconnectButton.addEventListener("click", this.handlers.reconnect);
      showWorkProcessToggle.addEventListener("change", this.handlers.toggleWorkProcess);
      for (const control of Object.values(permissionInputs)) control.addEventListener("change", this.handlers.permissionChange);
      resizeHandle.addEventListener("pointerdown", this.handlers.resizeStart);
      resizeHandle.addEventListener("pointermove", this.handlers.resizeMove);
      resizeHandle.addEventListener("pointerup", this.handlers.resizeEnd);
      resizeHandle.addEventListener("pointercancel", this.handlers.resizeEnd);
      resizeHandle.addEventListener("keydown", this.handlers.resizeKeydown);
      input.addEventListener("input", this.handlers.input);
      input.addEventListener("keydown", this.handlers.keydown);
      input.addEventListener("paste", this.handlers.paste);
      imageInput.addEventListener("change", this.handlers.imagesSelected);
      composer.addEventListener("dragover", this.handlers.dragover);
      composer.addEventListener("dragleave", this.handlers.dragleave);
      composer.addEventListener("drop", this.handlers.drop);
      doc.addEventListener("pointerdown", this.handlers.documentPointerdown);
      doc.addEventListener("keydown", this.handlers.documentKeydown);
      this.setStatus("idle", "");
      this.applyWorkProcessPreference();
      this.renderContextAttachment();
      this.updateComposerState();
      this.applyPermissions();
      this.lockInitialShellHeight();
    }

    lockInitialShellHeight(retries = 2) {
      const root = this.elements?.root;
      if (!root || root.dataset.shellHeightLocked === "true" || this.destroyed) return;
      const savedHeight = this.manager.getSidebarHeight?.()
        || normalizeShellHeight(this.manager.getPreference("sidebarHeight"));
      if (savedHeight) {
        this.applyShellHeight(savedHeight);
        return;
      }
      const height = Math.round(root.getBoundingClientRect().height);
      if (height > 0) {
        this.applyShellHeight(height);
        return;
      }
      if (retries <= 0) return;
      this.doc.defaultView?.requestAnimationFrame?.(() => this.lockInitialShellHeight(retries - 1));
    }

    applyShellHeight(value) {
      const height = normalizeShellHeight(value);
      if (!height || !this.elements?.root) return 0;
      this.elements.root.style.setProperty("--zcs-shell-height", `${height}px`);
      this.elements.root.dataset.shellHeightLocked = "true";
      this.elements.resizeHandle.setAttribute("aria-valuenow", String(height));
      return height;
    }

    persistShellHeight(value) {
      const height = normalizeShellHeight(value);
      if (!height) return;
      if (this.manager.setSidebarHeight) this.manager.setSidebarHeight(height);
      else {
        this.manager.setPreference("sidebarHeight", height);
        this.applyShellHeight(height);
      }
    }

    startShellResize(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      const height = Math.round(this.elements.root.getBoundingClientRect().height);
      this.shellResize = { pointerID: event.pointerId, startY: event.clientY, height };
      this.elements.root.classList.add("zcs-resizing");
      this.elements.resizeHandle.setPointerCapture?.(event.pointerId);
    }

    moveShellResize(event) {
      if (!this.shellResize || event.pointerId !== this.shellResize.pointerID) return;
      event.preventDefault();
      this.applyShellHeight(this.shellResize.height + event.clientY - this.shellResize.startY);
    }

    finishShellResize(event) {
      if (!this.shellResize || event.pointerId !== this.shellResize.pointerID) return;
      event.preventDefault();
      const height = Math.round(this.elements.root.getBoundingClientRect().height);
      this.elements.resizeHandle.releasePointerCapture?.(event.pointerId);
      this.elements.root.classList.remove("zcs-resizing");
      this.shellResize = null;
      this.persistShellHeight(height);
    }

    resizeShellWithKeyboard(event) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const current = Math.round(this.elements.root.getBoundingClientRect().height);
      const direction = event.key === "ArrowUp" ? -1 : 1;
      this.persistShellHeight(current + direction * SHELL_HEIGHT_STEP);
    }

    showPage(page, { focus = true } = {}) {
      if (!this.elements.chatView || !this.elements.settingsView) return;
      this.closePopovers();
      this.activePage = page === "chat" ? "chat" : "settings";
      this.elements.root.dataset.page = this.activePage;
      this.elements.chatView.hidden = this.activePage !== "chat";
      this.elements.settingsView.hidden = this.activePage !== "settings";
      this.elements.topbar.hidden = this.activePage !== "chat";
      this.elements.moreButton.setAttribute("aria-expanded", String(this.activePage === "settings"));
      if (this.activePage === "chat" && focus) this.elements.input.focus();
    }

    openSettings() {
      this.showPage("settings", { focus: false });
      this.elements.pathInput.value = String(this.manager.getPreference("codexPath") || "");
      this.applyWorkProcessPreference();
      this.elements.settingsView.focus({ preventScroll: true });
    }

    applyWorkProcessPreference() {
      if (!this.elements) return;
      const visible = this.manager.isWorkProcessVisible();
      this.elements.root.classList.toggle("zcs-show-work-process", visible);
      this.elements.showWorkProcessToggle.checked = visible;
    }

    closeSettings() {
      this.showPage("chat");
    }

    closePopovers(except = "") {
      this.hideCommandMenu();
      this.elements.threadContextMenu.hidden = true;
      this.contextMenuThreadID = "";
      const pairs = [
        ["threads", this.elements.threadPopover, this.elements.threadButton],
        ["context", this.elements.contextPopover, this.elements.contextAddButton],
        ["model", this.elements.modelPopover, this.elements.modelTrigger],
        ["permissions", this.elements.permissionsCard, this.elements.permissionsButton],
      ];
      for (const [name, popover, trigger] of pairs) {
        if (name === except) continue;
        popover.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        if (name === "context") this.elements.contextModeButton.setAttribute("aria-expanded", "false");
        if (name === "model") this.closeModelOptions();
      }
    }

    togglePopover(name) {
      const map = {
        threads: [this.elements.threadPopover, this.elements.threadButton],
        context: [this.elements.contextPopover, this.elements.contextAddButton],
        model: [this.elements.modelPopover, this.elements.modelTrigger],
        permissions: [this.elements.permissionsCard, this.elements.permissionsButton],
      };
      const [popover, trigger] = map[name];
      const willOpen = popover.hidden;
      this.closePopovers(name);
      popover.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
      if (willOpen && ["context", "model", "permissions"].includes(name)) {
        const root = this.elements.root.getBoundingClientRect();
        const anchor = trigger.getBoundingClientRect();
        popover.style.bottom = `${Math.max(8, root.bottom - anchor.top + 8)}px`;
        popover.style.maxHeight = `${Math.max(80, anchor.top - root.top - 12)}px`;
      }
      if (name === "context") this.elements.contextModeButton.setAttribute("aria-expanded", String(willOpen));
      if (willOpen && name === "model") {
        this.renderModelControls();
        this.elements.modelChoice.focus();
      }
      if (willOpen && name === "permissions") {
        this.applyPermissions();
        this.elements.permissionInputs.approvalPolicy.focus();
      }
      if (willOpen && name === "threads") {
        this.threadListLimit = THREAD_LIST_BATCH_SIZE;
        this.renderThreadPicker();
        global.setTimeout(() => this.elements.threadSearch.focus(), 0);
      }
    }

    handleDocumentPointerdown(event) {
      const target = event.target;
      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      const containers = [
        this.elements.threadContextMenu,
        this.elements.threadPopover,
        this.elements.contextPopover,
        this.elements.modelPopover,
        this.elements.permissionsCard,
        this.elements.permissionsButton,
        this.elements.threadButton,
        this.elements.moreButton,
        this.elements.contextAddButton,
        this.elements.contextModeButton,
        this.elements.modelTrigger,
        this.elements.commandMenu,
        this.elements.input,
      ];
      if (containers.some((element) => element?.contains?.(target) || eventPath.includes(element))) return;
      this.closePopovers();
    }

    updateComposerState() {
      const send = this.elements.sendButton;
      const unavailable = this.creatingTask || this.contextTransitioning;
      this.elements.input.disabled = this.contextTransitioning;
      this.elements.newThreadButton.disabled = unavailable;
      if (this.elements.headerNewButton) this.elements.headerNewButton.disabled = unavailable;
      this.elements.threadButton.disabled = unavailable;
      this.elements.contextAddButton.disabled = this.running || this.contextTransitioning;
      this.elements.contextModeButton.disabled = this.running || this.contextTransitioning;
      this.elements.imageOption.disabled = this.running || this.contextTransitioning;
      this.elements.generateImageOption.disabled = this.running || this.contextTransitioning;
      this.elements.imageInput.disabled = this.running || this.contextTransitioning;
      this.elements.modelTrigger.disabled = unavailable || !this.models.length;
      this.elements.modelChoice.disabled = unavailable || !this.models.length;
      this.elements.effortChoice.disabled = unavailable || !this.selectedEffort;
      this.elements.modelNextTurnHint.hidden = !this.running;
      if (this.contextTransitioning) {
        send.disabled = true;
        setButtonLabel(send, "↑", "zotero-codex-send", "Send");
        send.classList.remove("zcs-send-stop");
        return;
      }
      if (this.creatingTask) {
        send.disabled = true;
        setButtonLabel(send, "…", "zotero-codex-creating-task", "Starting chat");
        send.classList.remove("zcs-send-stop");
        return;
      }
      if (this.running) {
        send.disabled = false;
        setButtonLabel(send, "■", "zotero-codex-stop", "Stop generating");
        send.classList.add("zcs-send-stop");
        return;
      }
      const prompt = this.elements.input.value.trim().replace(/^\$imagegen\b\s*/u, "");
      send.disabled = !prompt && !this.images.length;
      setButtonLabel(send, "↑", "zotero-codex-send", "Send");
      send.classList.remove("zcs-send-stop");
    }

    resizeComposer() {
      const input = this.elements.input;
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    }

    applyPermissions() {
      const controls = this.elements.permissionInputs;
      const settings = Protocol.normalizePermissions(Object.fromEntries(
        Object.keys(controls).map((key) => [key, this.manager.getPreference(key)]),
      ));
      for (const [key, control] of Object.entries(controls)) {
        if (key === "networkAccess") {
          control.checked = settings.networkAccess;
          control.disabled = settings.sandbox === "danger-full-access";
        }
        else control.value = settings[key];
      }
      const trigger = this.elements.permissionsButton;
      if (trigger) {
        trigger.dataset.access = settings.sandbox;
        trigger.setAttribute("aria-label", controls.sandbox.selectedOptions?.[0]?.textContent || "File access settings");
        trigger.title = controls.sandbox.selectedOptions?.[0]?.textContent || "File access settings";
        if (this.elements.permissionLabel) {
          const [id, fallback] = settings.sandbox === "danger-full-access"
            ? ["zotero-codex-quick-full", "Full access"]
            : settings.sandbox === "workspace-write"
              ? ["zotero-codex-quick-workspace", "Workspace"]
              : ["zotero-codex-access-read-only", "Read only"];
          setLocalizedText(this.elements.permissionLabel, id, fallback);
        }
      }
    }

    savePermissions() {
      const settings = Protocol.normalizePermissions(Object.fromEntries(
        Object.entries(this.elements.permissionInputs).map(([key, control]) =>
          [key, key === "networkAccess" ? control.checked : control.value]),
      ));
      for (const [key, value] of Object.entries(settings)) this.manager.setPreference(key, value);
      for (const view of this.manager.views.values()) view.applyPermissions();
    }

    skillDirectory() {
      return this.thread?.cwd || this.manager.paperDirectory(this.context) || ClientTools.getHomeDirectory();
    }

    async refreshSkills({ forceReload = false } = {}) {
      const cwd = this.skillDirectory();
      if (this.skillsCwd === cwd && !forceReload) {
        if (this.skillsLoading) return this.skillLoadPromise;
        if (this.skillsLoaded) return this.skills;
      }
      const serial = ++this.skillsLoadSerial;
      this.skillsCwd = cwd;
      this.skillsLoaded = false;
      this.skillsLoading = true;
      this.skills = [];
      this.updateCommandMenu();
      this.skillLoadPromise = this.client.listSkills({ cwd, forceReload }).then((skills) => {
        if (serial !== this.skillsLoadSerial || this.destroyed || cwd !== this.skillDirectory()) return [];
        this.skills = skills;
        return skills;
      }).catch((error) => {
        if (!this.destroyed && serial === this.skillsLoadSerial && cwd === this.skillDirectory()) {
          this.showError(error);
        }
        return [];
      }).finally(() => {
        if (!this.destroyed && serial === this.skillsLoadSerial) {
          this.skillsLoading = false;
          this.skillsLoaded = cwd === this.skillDirectory();
          this.updateCommandMenu();
        }
      });
      return this.skillLoadPromise;
    }

    hideCommandMenu() {
      if (!this.elements?.commandMenu) return;
      this.elements.commandMenu.hidden = true;
      this.elements.input.setAttribute("aria-expanded", "false");
      this.elements.input.removeAttribute("aria-activedescendant");
    }

    updateCommandMenu() {
      const menu = this.elements.commandMenu;
      const text = this.elements.input.value.trimStart();
      const skillsOnly = text.match(/^\/skills(?:\s+(.*))?$/iu);
      const rootQuery = text.match(/^\/([^\s/]*)$/u);
      if (!skillsOnly && !rootQuery) { this.hideCommandMenu(); return; }
      const query = (skillsOnly ? skillsOnly[1] || "" : rootQuery[1]).toLowerCase();
      const currentSkills = this.skillsCwd === this.skillDirectory() ? this.skills : [];
      const entries = [
        ...(skillsOnly ? [] : SLASH_COMMANDS),
        ...currentSkills.map((skill) => ({ ...skill, skill: true })),
      ].filter((entry) => `${entry.name} ${entry.displayName || ""} ${entry.description}`.toLowerCase().includes(query));
      this.commandMatches = entries;
      this.commandIndex = Math.min(this.commandIndex, Math.max(0, entries.length - 1));
      menu.replaceChildren();
      for (const [index, entry] of entries.entries()) {
        const row = create(this.doc, "button", "zcs-command-row");
        row.type = "button";
        row.id = `${menu.id}-${index}`;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(index === this.commandIndex));
        const description = create(this.doc, "span", "zcs-command-description", entry.description);
        if (entry.descriptionID) setL10n(description, entry.descriptionID);
        row.append(create(this.doc, "span", "zcs-command-name", `/${entry.name}`), description);
        row.addEventListener("mousedown", (event) => event.preventDefault());
        row.addEventListener("click", () => this.chooseCommand(entry));
        menu.append(row);
      }
      if (!entries.length || this.skillsLoading) {
        menu.append(createL10n(this.doc, "div", "zcs-command-empty",
          this.skillsLoading ? "zotero-codex-skills-loading" : "zotero-codex-no-commands",
          this.skillsLoading ? "Loading skills…" : "No matching commands or enabled skills"));
      }
      menu.hidden = false;
      this.elements.input.setAttribute("aria-expanded", "true");
      if (entries.length) this.elements.input.setAttribute("aria-activedescendant", `${menu.id}-${this.commandIndex}`);
      else this.elements.input.removeAttribute("aria-activedescendant");
      if (!this.skillsLoading && (this.skillsCwd !== this.skillDirectory() || !this.skillsLoaded)) {
        void this.refreshSkills();
      }
    }

    chooseCommand(entry) {
      this.hideCommandMenu();
      this.elements.input.value = entry.skill ? `$${entry.name} ` : `/${entry.name}`;
      this.elements.input.focus();
      this.elements.input.setSelectionRange?.(this.elements.input.value.length, this.elements.input.value.length);
      this.resizeComposer();
      this.updateComposerState();
      if (!entry.skill) void this.send();
    }

    handleCommandKey(event) {
      if (event.isComposing || this.elements.commandMenu.hidden) return false;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.hideCommandMenu();
        return true;
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && this.commandMatches.length) {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        this.commandIndex = (this.commandIndex + direction + this.commandMatches.length) % this.commandMatches.length;
        this.updateCommandMenu();
        this.elements.commandMenu.children[this.commandIndex]?.scrollIntoView({ block: "nearest" });
        return true;
      }
      if (this.commandMatches.length && ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab")) {
        event.preventDefault();
        const entry = this.commandMatches[this.commandIndex];
        if (entry) this.chooseCommand(entry);
        return true;
      }
      return false;
    }

    async resolveSlashInput(text) {
      if (text === "/") { this.updateCommandMenu(); return null; }
      const currentSkills = this.skillsCwd === this.skillDirectory() ? this.skills || [] : [];
      let command = Protocol.parseSlashCommand(text, currentSkills);
      if (command?.kind === "unknown") {
        const skills = await this.refreshSkills();
        command = Protocol.parseSlashCommand(text, skills);
      }
      if (!command) return text;
      if (command.kind === "skill") return command.text;
      if (command.kind === "unknown") throw ClientTools.clientError(
        "zotero-codex-unknown-command", null, "Unknown command. Type / to see commands and skills.",
      );
      this.hideCommandMenu();
      if (command.name === "skills") {
        this.elements.input.value = `/skills ${command.argument}`;
        await this.refreshSkills({ forceReload: true });
        this.updateCommandMenu();
        this.elements.input.focus();
      }
      else {
        this.elements.input.value = "";
        if (command.name === "new") this.newTask();
        if (command.name === "model") this.togglePopover("model");
        if (command.name === "approvals") {
          if (this.elements.permissionsCard.hidden) this.togglePopover("permissions");
          this.elements.permissionInputs.approvalPolicy.focus();
        }
        this.resizeComposer();
        this.updateComposerState();
      }
      return null;
    }

    async refreshModels() {
      this.models = await this.client.listModels();
      const requestedModel = this.thread?.model
        || this.selectedModel
        || String(this.manager.getPreference("model") || "");
      const requestedEffort = this.thread?.reasoningEffort
        || this.selectedEffort
        || String(this.manager.getPreference("reasoningEffort") || "");
      this.applyModelSelection(requestedModel, requestedEffort);
    }

    applyModelSelection(requestedModel, requestedEffort, { persist = false } = {}) {
      const selection = Protocol.resolveModelSelection(
        this.models,
        requestedModel,
        requestedEffort,
      );
      this.selectedModel = selection.model;
      this.selectedEffort = selection.effort;
      if (persist) {
        this.manager.setPreference("model", this.selectedModel);
        this.manager.setPreference("reasoningEffort", this.selectedEffort);
      }
      this.renderModelControls();
      this.updateComposerState();
    }

    closeModelOptions(except = "") {
      const pairs = [
        ["model", this.elements.modelOptions, this.elements.modelChoice],
        ["effort", this.elements.effortOptions, this.elements.effortChoice],
      ];
      for (const [name, options, choice] of pairs) {
        if (name === except) continue;
        options.hidden = true;
        choice.setAttribute("aria-expanded", "false");
      }
    }

    toggleModelOptions(name) {
      if (this.creatingTask) return;
      const map = {
        model: [this.elements.modelOptions, this.elements.modelChoice],
        effort: [this.elements.effortOptions, this.elements.effortChoice],
      };
      const [options, choice] = map[name];
      const willOpen = options.hidden;
      this.closeModelOptions(name);
      options.hidden = !willOpen;
      choice.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) global.setTimeout(() => options.querySelector("button")?.focus(), 0);
    }

    selectModel(model) {
      if (this.creatingTask) return;
      this.applyModelSelection(model, this.selectedEffort, { persist: true });
      if (this.running) this.nextTurnSelectionPending = true;
      this.closeModelOptions();
      this.elements.modelChoice.focus();
    }

    selectEffort(effort) {
      if (this.creatingTask) return;
      const selection = Protocol.resolveModelSelection(this.models, this.selectedModel, effort);
      if (selection.effort !== effort) return;
      this.selectedEffort = effort;
      if (this.running) this.nextTurnSelectionPending = true;
      this.manager.setPreference("reasoningEffort", effort);
      this.renderModelControls();
      this.updateComposerState();
      this.closeModelOptions();
      this.elements.effortChoice.focus();
    }

    renderModelControls() {
      if (!this.elements) return;
      const {
        modelChoice,
        modelChoiceText,
        modelOptions,
        effortChoice,
        effortChoiceText,
        effortOptions,
        modelTriggerName,
        modelTriggerEffort,
      } = this.elements;
      modelOptions.replaceChildren();
      effortOptions.replaceChildren();

      if (!this.models.length) {
        setLocalizedText(
          modelChoiceText,
          "zotero-codex-models-unavailable",
          "Models unavailable",
        );
        setPlainText(effortChoiceText, "—");
        modelChoice.disabled = true;
        effortChoice.disabled = true;
        modelTriggerName.textContent = "Codex";
        modelTriggerEffort.textContent = "";
        modelTriggerEffort.hidden = true;
        return;
      }

      for (const model of this.models) {
        const option = create(this.doc, "button", "zcs-model-option");
        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(model.model === this.selectedModel));
        option.append(
          create(this.doc, "span", "zcs-model-option-label", model.displayName || model.model),
          create(this.doc, "span", "zcs-model-option-check", model.model === this.selectedModel ? "✓" : ""),
        );
        option.addEventListener("click", (event) => {
          event.stopPropagation();
          this.selectModel(model.model);
        });
        modelOptions.append(option);
      }
      const selected = this.models.find((model) => model.model === this.selectedModel);
      for (const effort of selected?.supportedReasoningEfforts || []) {
        const l10nID = EFFORT_L10N_IDS[effort];
        const fallback = effort === "xhigh"
          ? "Extra high"
          : effort.charAt(0).toUpperCase() + effort.slice(1);
        const option = create(this.doc, "button", "zcs-model-option");
        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(effort === this.selectedEffort));
        const label = l10nID
          ? createL10n(this.doc, "span", "zcs-model-option-label", l10nID, fallback)
          : create(this.doc, "span", "zcs-model-option-label", fallback);
        option.append(
          label,
          create(this.doc, "span", "zcs-model-option-check", effort === this.selectedEffort ? "✓" : ""),
        );
        option.addEventListener("click", (event) => {
          event.stopPropagation();
          this.selectEffort(effort);
        });
        effortOptions.append(option);
      }
      const modelName = selected?.displayName || this.selectedModel || "Codex";
      setPlainText(modelChoiceText, modelName);
      modelTriggerName.textContent = modelName;
      const effortL10nID = EFFORT_L10N_IDS[this.selectedEffort];
      if (effortL10nID) {
        const fallback = this.selectedEffort === "xhigh"
          ? "Extra high"
          : this.selectedEffort.charAt(0).toUpperCase() + this.selectedEffort.slice(1);
        setLocalizedText(effortChoiceText, effortL10nID, fallback);
        setLocalizedText(modelTriggerEffort, effortL10nID, fallback);
      }
      else {
        setPlainText(effortChoiceText, this.selectedEffort || "—");
        setPlainText(modelTriggerEffort, this.selectedEffort);
      }
      modelTriggerEffort.hidden = !this.selectedEffort;
    }

    setItem(item, tabType) {
      const changed = item !== this.item || tabType !== this.tabType;
      this.item = item;
      this.tabType = tabType;
      if (changed) this.beginContextTransition();
      if (changed && this.initialized) {
        void this.loadCurrentItem(this.contextEpoch);
      }
    }

    beginContextTransition() {
      this.closeImagePreview?.();
      this.hideCommandMenu?.();
      this.contextEpoch++;
      this.contextTransitioning = true;
      this.loadSerial++;
      this.threadRefreshSerial++;
      this.context = null;
      this.threadID = "";
      this.thread = null;
      this.activePaperKey = "";
      this.activeTurnID = "";
      this.running = false;
      this.streamingText = "";
      this.streamingNode = null;
      this.streamingItemID = "";
      this.streamingPhase = "final";
      this.nextTurnSelectionPending = false;
      this.images = [];
      if (!this.elements) return;
      this.hidePendingResponse();
      this.clearResponseScrollSpace();
      this.cancelEdit({ clearInput: true, focus: false });
      this.elements.input.value = "";
      this.renderSelections();
      this.renderContextAttachment();
      this.renderRequests();
      this.renderEmpty("", "");
      this.updateThreadHeader();
      this.resizeComposer();
      this.updateComposerState();
    }

    isCurrentContext(epoch, context = this.context) {
      return !this.destroyed && !this.manager.reconfiguring && epoch === this.contextEpoch && context === this.context;
    }

    isThreadVisible(threadID) {
      return !this.destroyed && this.threadID === threadID && !this.doc.hidden
        && !this.elements.chatView?.hidden && this.doc.hasFocus() && Boolean(this.body.getClientRects().length);
    }

    async loadCurrentItem(epoch) {
      try {
        const context = await this.refreshContext();
        if (!context || !this.isCurrentContext(epoch, context)) return;
        await this.activatePaperConversation(epoch);
      }
      catch (error) {
        if (epoch === this.contextEpoch && !this.destroyed) this.showError(error);
      }
      finally {
        if (epoch === this.contextEpoch && !this.destroyed) {
          this.contextTransitioning = false;
          this.manager.restoreRuntimeDraft?.(this);
          this.updateComposerState();
        }
      }
    }

    async initialize() {
      if (this.destroyed || this.manager.reconfiguring || this.initialized || this.initializing) return;
      this.initializing = true;
      this.contextTransitioning = true;
      let epoch = this.contextEpoch;
      try {
        this.setStatus("busy", "");
        await this.client.connect();
        if (this.destroyed) return;
        if (this.client.binaryPath) setPlainText(this.elements.pathStatus, this.client.binaryPath);
        else setLocalizedText(
          this.elements.pathStatus,
          "zotero-codex-auto-detected",
          "Connected using auto-detect.",
        );
        await this.refreshModels();
        if (this.destroyed) return;
        this.initialized = true;
        epoch = this.contextEpoch;
        const context = await this.refreshContext();
        if (context && this.isCurrentContext(epoch, context)) await this.refreshThreads();
        else if (!this.destroyed) await this.loadCurrentItem(this.contextEpoch);
      }
      catch (error) {
        this.showError(error);
      }
      finally {
        this.initializing = false;
        if (!this.destroyed && (!this.initialized || epoch === this.contextEpoch)) {
          this.contextTransitioning = false;
          this.manager.restoreRuntimeDraft?.(this);
          this.updateComposerState();
        }
      }
    }

    async refreshContext() {
      const epoch = this.contextEpoch;
      const item = this.item;
      const context = await resolveItemContext(item, this.tabType);
      if (this.destroyed || epoch !== this.contextEpoch || item !== this.item) return null;
      this.context = context;
      if (context.title) setPlainText(this.elements.contextMeta, context.title);
      else setLocalizedText(
        this.elements.contextMeta,
        "zotero-codex-no-recognized-item",
        "No recognized item selected",
      );
      const [pdfAvailable, noLocalPDF] = await Promise.all([
        formatValue(this.doc, "zotero-codex-pdf-available", null, "PDF available"),
        formatValue(this.doc, "zotero-codex-no-local-pdf", null, "No local PDF"),
      ]);
      if (this.destroyed || epoch !== this.contextEpoch || item !== this.item) return null;
      const meta = [
        Protocol.firstLine(context.creators, 58),
        context.date,
        context.pdfPath ? pdfAvailable : noLocalPDF,
      ].filter(Boolean);
      this.elements.contextMeta.title = [context.title, ...meta].filter(Boolean).join("\n");
      this.renderSelections();
      this.renderContextAttachment();
      return context;
    }

    renderSelections({ highlightSelectionID = "" } = {}) {
      const container = this.elements.selections;
      container.replaceChildren();
      const selections = this.manager.getSelections(this.context?.attachmentID);
      const liveSelection = this.manager.getLiveSelection(this.context?.attachmentID);
      const mergedSelections = Protocol.mergeContextSelections(liveSelection, selections);
      const showLiveSelection = Boolean(
        liveSelection && mergedSelections.length > selections.length,
      );
      if (!showLiveSelection && !selections.length) {
        container.hidden = true;
        this.renderContextAttachment();
        return;
      }
      container.hidden = false;
      container.append(createL10n(
        this.doc,
        "div",
        "zcs-selection-heading",
        "zotero-codex-pdf-context",
        "PDF context",
      ));
      if (showLiveSelection) {
        const chip = create(this.doc, "div", "zcs-selection-chip zcs-live-selection-chip");
        const page = liveSelection.pageLabel || liveSelection.pageNumber || "?";
        const label = createL10n(
          this.doc,
          "span",
          "",
          "zotero-codex-current-selection-page",
          `Current selection · page ${page}`,
          { page },
        );
        const remove = create(this.doc, "button", "zcs-selection-remove", "×");
        remove.type = "button";
        remove.title = "Remove the current selection";
        setL10n(remove, "zotero-codex-remove-current-selection");
        remove.addEventListener("click", () => {
          this.manager.clearLiveSelection(this.context?.attachmentID);
        });
        chip.append(label, remove);
        container.append(chip);
      }
      for (const selection of selections) {
        const chip = create(this.doc, "div", "zcs-selection-chip");
        const page = selection.pageLabel || selection.pageNumber || "?";
        const label = createL10n(
          this.doc,
          "span",
          "",
          "zotero-codex-selection-page",
          `Selection · page ${page}`,
          { page },
        );
        const remove = create(this.doc, "button", "zcs-selection-remove", "×");
        remove.title = "Remove this selection";
        setL10n(remove, "zotero-codex-remove-selection");
        remove.addEventListener("click", () => {
          this.manager.removeSelection(this.context?.attachmentID, selection.id);
        });
        chip.append(label, remove);
        container.append(chip);
      }
      this.renderContextAttachment({ highlightSelectionID });
    }

    async addImageFiles(files) {
      if (this.running || this.creatingTask || !files?.length) return;
      const contextEpoch = this.contextEpoch;
      const room = Math.max(0, MAX_IMAGE_COUNT - this.images.length);
      if (!room) {
        this.showError(ClientTools.clientError(
          "zotero-codex-error-image-count",
          { count: MAX_IMAGE_COUNT },
          `You can attach up to ${MAX_IMAGE_COUNT} images.`,
        ));
        return;
      }
      const candidates = [...files].slice(0, room);
      try {
        for (const file of candidates) {
          const type = String(file?.type || "").toLowerCase();
          if (!ACCEPTED_IMAGE_TYPES.has(type)) throw ClientTools.clientError(
            "zotero-codex-error-image-type",
            null,
            "Use a PNG, JPEG, WebP, or GIF image.",
          );
          if (Number(file.size || 0) > MAX_IMAGE_BYTES) throw ClientTools.clientError(
            "zotero-codex-error-image-size",
            { size: 20 },
            "Each image must be 20 MB or smaller.",
          );
          const url = await fileToDataURL(this.doc, file);
          if (this.destroyed || contextEpoch !== this.contextEpoch) return;
          if (!url.startsWith("data:image/")) throw new Error("Could not read image");
          this.images.push({
            id: global.crypto?.randomUUID?.() || `${Date.now()}-${this.images.length}`,
            name: String(file.name || "image").trim() || "image",
            size: Number(file.size || 0),
            type,
            url,
            detail: "auto",
          });
        }
        if (files.length > room) this.showError(ClientTools.clientError(
          "zotero-codex-error-image-count",
          { count: MAX_IMAGE_COUNT },
          `You can attach up to ${MAX_IMAGE_COUNT} images.`,
        ));
        else this.setStatus("ready", "");
        this.renderContextAttachment();
        this.updateComposerState();
        this.elements.input.focus();
      }
      catch (error) {
        if (!this.destroyed && contextEpoch === this.contextEpoch) this.showError(error);
      }
    }

    removeImage(imageID) {
      this.images = this.images.filter((image) => image.id !== imageID);
      this.renderContextAttachment();
      this.updateComposerState();
    }

    renderContextAttachment({ highlightSelectionID = "" } = {}) {
      if (!this.elements) return;
      const enabled = Boolean(this.manager.getPreference("includeItemContext"));
      const selections = this.context
        ? this.manager.getSelections(this.context.attachmentID)
        : [];
      const liveSelection = this.context
        ? this.manager.getLiveSelection(this.context.attachmentID)
        : null;
      const mergedSelections = Protocol.mergeContextSelections(liveSelection, selections);
      const showLiveSelection = Boolean(
        liveSelection && mergedSelections.length > selections.length,
      );
      const itemAvailable = Boolean(this.context?.title);
      this.elements.contextOption.disabled = !itemAvailable;
      this.elements.contextOption.dataset.selected = String(enabled && itemAvailable);
      this.elements.contextCheck.textContent = enabled && itemAvailable ? "✓" : "";
      if (this.context?.title) setPlainText(this.elements.contextMeta, this.context.title);
      else setLocalizedText(
        this.elements.contextMeta,
        "zotero-codex-no-item-to-include",
        "No item available to include",
      );
      this.elements.contextModeButton.classList.toggle("zcs-context-off", !enabled || !itemAvailable);
      this.elements.contextModeButton.title = enabled && itemAvailable
        ? "Include the current item when sending"
        : "Do not include Zotero context when sending";
      setL10n(
        this.elements.contextModeButton,
        enabled && itemAvailable ? "zotero-codex-context-on" : "zotero-codex-context-off",
      );

      const attachments = this.elements.attachments;
      attachments.replaceChildren();
      const showItem = enabled && itemAvailable;
      attachments.hidden = !this.images.length && !showItem && !showLiveSelection && !selections.length;

      for (const image of this.images) {
        const chip = create(this.doc, "div", "zcs-attachment-chip zcs-image-attachment");
        const preview = create(this.doc, "img", "zcs-image-preview");
        preview.src = image.url;
        preview.alt = "";
        this.makeImagePreviewable(preview, image.name);
        const copy = create(this.doc, "span", "zcs-attachment-copy");
        copy.append(
          create(this.doc, "span", "zcs-attachment-title", image.name),
          createL10n(
            this.doc,
            "span",
            "zcs-attachment-meta",
            "zotero-codex-image-attachment-meta",
            `Image · ${formatFileSize(image.size)}`,
            { size: formatFileSize(image.size) },
          ),
        );
        const remove = create(this.doc, "button", "zcs-attachment-remove", "×");
        remove.type = "button";
        setL10n(remove, "zotero-codex-remove-image");
        remove.addEventListener("click", () => this.removeImage(image.id));
        chip.append(preview, copy, remove);
        attachments.append(chip);
      }

      if (showItem) {
        const chip = create(this.doc, "div", "zcs-attachment-chip");
        const icon = create(this.doc, "span", "zcs-attachment-icon");
        icon.append(createDocumentIcon(this.doc));
        const copy = create(this.doc, "span", "zcs-attachment-copy");
        copy.append(
          create(this.doc, "span", "zcs-attachment-title", Protocol.firstLine(this.context.title, 44)),
          createL10n(
            this.doc,
            "span",
            "zcs-attachment-meta",
            this.context?.pdfPath
              ? "zotero-codex-attachment-meta-pdf"
              : "zotero-codex-attachment-meta-item",
            this.context?.pdfPath ? "PDF" : "Item",
            { count: 0 },
          ),
        );
        const remove = create(this.doc, "button", "zcs-attachment-remove", "×");
        remove.type = "button";
        remove.title = "Do not include Zotero context this time";
        remove.setAttribute("aria-label", remove.title);
        setL10n(remove, "zotero-codex-remove-context");
        remove.addEventListener("click", () => {
          this.manager.setPreference("includeItemContext", false);
          this.renderContextAttachment();
        });
        chip.append(icon, copy, remove);
        attachments.append(chip);
      }

      if (showLiveSelection) {
        const page = liveSelection.pageLabel || liveSelection.pageNumber || "";
        const chip = create(
          this.doc,
          "div",
          "zcs-attachment-chip zcs-selection-attachment zcs-live-selection-attachment",
        );
        chip.dataset.new = "true";
        const copy = create(this.doc, "span", "zcs-attachment-copy");
        copy.append(
          page
            ? createL10n(
                this.doc,
                "span",
                "zcs-attachment-title",
                "zotero-codex-current-selection-page",
                `Current selection · page ${page}`,
                { page },
              )
            : createL10n(
                this.doc,
                "span",
                "zcs-attachment-title",
                "zotero-codex-current-selection",
                "Current selection",
              ),
          create(this.doc, "span", "zcs-attachment-meta", Protocol.firstLine(liveSelection.text, 72)),
        );
        const remove = create(this.doc, "button", "zcs-attachment-remove", "×");
        remove.type = "button";
        remove.title = "Remove the current selection";
        setL10n(remove, "zotero-codex-remove-current-selection");
        remove.addEventListener("click", () => {
          this.manager.clearLiveSelection(this.context?.attachmentID);
        });
        chip.append(copy, remove);
        attachments.append(chip);
      }

      for (const selection of selections) {
        const page = selection.pageLabel || selection.pageNumber || "";
        const chip = create(this.doc, "div", "zcs-attachment-chip zcs-selection-attachment");
        if (selection.id === highlightSelectionID) chip.dataset.new = "true";
        const copy = create(this.doc, "span", "zcs-attachment-copy");
        copy.append(
          page
            ? createL10n(
                this.doc,
                "span",
                "zcs-attachment-title",
                "zotero-codex-selection-added-page",
                `Selection added · page ${page}`,
                { page },
              )
            : createL10n(
                this.doc,
                "span",
                "zcs-attachment-title",
                "zotero-codex-selection-added",
                "Selection added",
              ),
          create(this.doc, "span", "zcs-attachment-meta", Protocol.firstLine(selection.text, 72)),
        );
        const remove = create(this.doc, "button", "zcs-attachment-remove", "×");
        remove.type = "button";
        remove.title = "Remove this selection";
        setL10n(remove, "zotero-codex-remove-selection");
        remove.addEventListener("click", () => {
          this.manager.removeSelection(this.context?.attachmentID, selection.id);
        });
        chip.append(copy, remove);
        attachments.append(chip);
        if (selection.id === highlightSelectionID) {
          this.doc.defaultView?.requestAnimationFrame?.(() => chip.scrollIntoView?.({ block: "nearest" }));
        }
      }
    }

    toggleItemContext() {
      if (this.elements.contextOption.disabled) return;
      const next = !Boolean(this.manager.getPreference("includeItemContext"));
      this.manager.setPreference("includeItemContext", next);
      this.renderContextAttachment();
      this.closePopovers();
    }

    async refreshThreads({ reloadCurrent = false } = {}) {
      const refreshSerial = ++this.threadRefreshSerial;
      const contextEpoch = this.contextEpoch;
      const previousID = this.threadID;
      this.setStatus("busy", "");
      try {
        const paperKey = Protocol.paperContextKey(this.context);
        const paperCwd = this.manager.paperDirectory(this.context);
        const onlyThisPaper = Boolean(paperKey && this.manager.getPreference("paperOnlyChats"));
        const [recent, inPaperDirectory] = await Promise.all([
          this.client.listThreads(500),
          onlyThisPaper && paperCwd ? this.client.listThreads(500, { cwd: paperCwd }) : [],
        ]);
        if (
          this.destroyed ||
          refreshSerial !== this.threadRefreshSerial ||
          contextEpoch !== this.contextEpoch
        ) return;
        this.threads = [...new Map([...inPaperDirectory, ...recent]
          .map((thread) => [thread.id, thread])).values()]
          .sort((left, right) => right.timestamp - left.timestamp);
        this.renderThreadPicker();
        this.activePaperKey = paperKey;
        const boundID = paperKey ? this.manager.getPaperThread(paperKey) : "";
        const remembered = paperKey ? "" : String(this.manager.getPreference("lastThreadId") || "");
        const nextID = boundID ||
          (!paperKey && previousID && this.threads.some((thread) => thread.id === previousID) && previousID) ||
          (!paperKey && remembered && this.threads.some((thread) => thread.id === remembered) && remembered) ||
          (!paperKey && this.threads[0]?.id) ||
          "";
        if (nextID && (reloadCurrent || nextID !== this.threadID || !this.thread)) {
          const selected = await this.selectThread(nextID, { bind: false, quiet: Boolean(paperKey) });
          if (
            this.destroyed ||
            refreshSerial !== this.threadRefreshSerial ||
            contextEpoch !== this.contextEpoch
          ) return;
          if (!selected && paperKey) {
            this.manager.clearPaperThread(paperKey);
            this.resetConversation({ focus: false });
          }
        }
        else if (!nextID) {
          this.threadID = "";
          this.thread = null;
          this.renderTranscript([]);
          this.setStatus("ready", "");
        }
        else {
          this.setStatus("ready", this.connectionLabel());
        }
        this.updateThreadHeader();
      }
      catch (error) {
        if (
          !this.destroyed &&
          refreshSerial === this.threadRefreshSerial &&
          contextEpoch === this.contextEpoch
        ) this.showError(error);
      }
    }

    async activatePaperConversation(expectedEpoch = this.contextEpoch) {
      if (expectedEpoch !== this.contextEpoch || this.destroyed) return;
      const paperKey = Protocol.paperContextKey(this.context);
      if (paperKey === this.activePaperKey) return;
      this.activePaperKey = paperKey;
      if (this.running) {
        this.running = false;
        this.activeTurnID = "";
        this.streamingText = "";
        this.streamingNode = null;
      }
      const threadID = paperKey ? this.manager.getPaperThread(paperKey) : "";
      if (threadID) {
        const selected = await this.selectThread(threadID, { bind: false, quiet: true });
        if (expectedEpoch !== this.contextEpoch || this.destroyed) return;
        if (selected) return;
        this.manager.clearPaperThread(paperKey);
      }
      this.resetConversation({ focus: false, force: true });
    }

    renderThreadPicker() {
      const list = this.elements.threadList;
      const scrollTop = list.scrollTop;
      list.replaceChildren();
      const paperKey = Protocol.paperContextKey(this.context);
      const onlyThisPaper = Boolean(paperKey && this.manager.getPreference("paperOnlyChats"));
      this.elements.paperOnlyFilter.hidden = !paperKey;
      this.elements.paperOnlyCheckbox.checked = onlyThisPaper;
      const paperCwd = this.manager.paperDirectory(this.context);
      const allThreads = this.thread?.id && !this.threads.some((thread) => thread.id === this.thread.id)
        ? [this.thread, ...this.threads]
        : this.threads;
      const visible = onlyThisPaper
        ? Protocol.filterThreadsForPaper(allThreads, paperCwd, this.manager.getPaperThread(paperKey))
        : allThreads;
      const query = this.elements.threadSearch.value.trim();
      const matches = Protocol.filterThreads(visible, query);
      this.threadListMatchCount = matches.length;
      const rows = matches.slice(0, this.threadListLimit);
      if (!matches.length) {
        const noPaperChats = onlyThisPaper && !visible.length;
        list.append(createL10n(
          this.doc,
          "div",
          "zcs-thread-empty",
          noPaperChats
            ? "zotero-codex-no-paper-chats"
            : visible.length ? "zotero-codex-no-matching-tasks" : "zotero-codex-no-tasks",
          noPaperChats
            ? "No chats for this paper yet"
            : visible.length ? "No matching conversations" : "No conversations yet",
        ));
        return;
      }
      for (const thread of rows) {
        const row = create(this.doc, "button", "zcs-menu-row zcs-thread-row");
        row.type = "button";
        row.dataset.selected = String(thread.id === this.threadID);
        row.title = `${thread.label}\n${thread.cwd || ""}`.trim();
        const copy = create(this.doc, "span", "zcs-row-copy");
        const meta = this.manager.runningTurns.has(thread.id)
          ? createL10n(this.doc, "span", "zcs-row-meta", "zotero-codex-chat-running", "Replying…")
          : create(
            this.doc,
            "span",
            "zcs-row-meta",
            Protocol.relativeThreadTime(thread.timestamp, Date.now(), this.manager.locale),
          );
        copy.append(
          create(this.doc, "span", "zcs-row-title", thread.label),
          meta,
        );
        row.append(create(this.doc, "span", "zcs-row-icon", thread.id === this.threadID ? "✓" : ""), copy);
        row.addEventListener("click", () => {
          this.closePopovers();
          void this.selectThread(thread.id);
        });
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          this.openThreadContextMenu(thread.id, event.clientX, event.clientY);
        });
        row.addEventListener("keydown", (event) => {
          if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
          event.preventDefault();
          const rect = row.getBoundingClientRect();
          this.openThreadContextMenu(thread.id, rect.left + 24, rect.bottom);
        });
        list.append(row);
      }
      list.scrollTop = scrollTop;
    }

    loadMoreThreads() {
      const list = this.elements.threadList;
      if (
        this.threadListLimit >= this.threadListMatchCount ||
        list.scrollTop + list.clientHeight < list.scrollHeight - 64
      ) return;
      this.threadListLimit += THREAD_LIST_BATCH_SIZE;
      this.renderThreadPicker();
    }

    updateThreadHeader() {
      const thread = this.threads.find((candidate) => candidate.id === this.threadID) || this.thread;
      const label = thread ? Protocol.threadLabel(thread) : "";
      if (label) setPlainText(this.elements.threadTitle, label);
      else setLocalizedText(this.elements.threadTitle, "zotero-codex-new-task", "New chat");
      this.elements.threadButton.title = label;
      this.renderThreadPicker();
    }

    openThreadContextMenu(threadID, clientX, clientY) {
      if (!threadID || this.destroyed) return;
      this.closePopovers("threads");
      this.contextMenuThreadID = threadID;
      const menu = this.elements.threadContextMenu;
      const root = this.elements.root.getBoundingClientRect();
      menu.style.left = `${Math.max(0, Math.min(clientX - root.left, root.width - 184))}px`;
      menu.style.top = `${Math.max(0, Math.min(clientY - root.top, root.height - 88))}px`;
      const unavailable = this.running || this.creatingTask || this.contextTransitioning || Boolean(this.managingThreadID);
      this.elements.archiveThreadButton.disabled = unavailable;
      this.elements.deleteThreadButton.disabled = unavailable;
      menu.hidden = false;
      this.elements.archiveThreadButton.focus();
    }

    async manageThread(action) {
      const threadID = this.contextMenuThreadID;
      if (!threadID || this.destroyed || this.running || this.creatingTask || this.contextTransitioning || this.managingThreadID) return;
      const thread = this.threads.find((candidate) => candidate.id === threadID)
        || (this.thread?.id === threadID ? this.thread : null);
      this.closePopovers();
      if (action === "delete") {
        const title = Protocol.threadLabel(thread) || threadID;
        const message = await formatValue(
          this.doc,
          "zotero-codex-confirm-delete-task",
          { title },
          `Permanently delete “${title}” and any spawned tasks? This cannot be undone.`,
        );
        if (!this.doc.defaultView?.confirm?.(message)) return;
      }
      this.managingThreadID = threadID;
      try {
        if (action === "archive") await this.client.archiveThread(threadID);
        else if (action === "delete") await this.client.deleteThread(threadID);
        else return;
        this.manager.handleThreadRemoved(threadID);
      }
      catch (error) {
        if (!this.destroyed) this.showError(error);
      }
      finally {
        this.managingThreadID = "";
      }
    }

    onThreadRemoved(threadID) {
      if (this.destroyed || !threadID) return;
      this.threadRefreshSerial++;
      this.threads = this.threads.filter((thread) => thread.id !== threadID);
      if (this.contextMenuThreadID === threadID) {
        this.elements.threadContextMenu.hidden = true;
        this.contextMenuThreadID = "";
      }
      for (const [requestID, request] of this.pendingRequests) {
        if (request.contextThreadID === threadID) this.pendingRequests.delete(requestID);
      }
      this.renderRequests();
      if (this.threadID === threadID) {
        this.setRunning(false);
        this.resetConversation({ focus: false, force: true });
      }
      else this.updateThreadHeader();
    }

    async selectThread(threadID, { bind = true, quiet = false, preserveScroll = false } = {}) {
      if (!quiet) this.showPage?.("chat", { focus: false });
      if (!threadID || this.destroyed || this.manager.reconfiguring || this.creatingTask) return false;
      this.hideCommandMenu?.();
      const contextEpoch = this.contextEpoch;
      const context = this.context;
      const switching = threadID !== this.threadID;
      if (switching) this.closeImagePreview?.();
      if (bind) this.threadRefreshSerial++;
      if (!preserveScroll) this.clearResponseScrollSpace();
      const preserveNextTurnSelection = Boolean(
        this.nextTurnSelectionPending && threadID === this.threadID,
      );
      this.images = [];
      this.renderContextAttachment();
      this.cancelEdit({ clearInput: true, focus: false });
      const serial = ++this.loadSerial;
      this.threadID = threadID;
      this.thread = null;
      this.streamingText = "";
      this.streamingNode = null;
      this.streamingItemID = "";
      this.streamingPhase = "final";
      this.hidePendingResponse();
      if (switching) this.renderEmpty("", "");
      const active = this.manager.runningTurns.get(threadID);
      this.activeTurnID = active?.turnID || "";
      this.setRunning(Boolean(active));
      this.updateThreadHeader();
      this.renderRequests();
      this.manager.setPreference("lastThreadId", threadID);
      this.setStatus("busy", "");
      try {
        const thread = await this.client.readThread(threadID);
        if (
          serial !== this.loadSerial ||
          this.destroyed ||
          this.threadID !== threadID ||
          !this.isCurrentContext(contextEpoch, context)
        ) return false;
        this.thread = thread;
        const inProgress = thread.turns?.find((turn) => turn.status === "inProgress"
          && !this.manager.completedTurnIDs.has(turn.id));
        const running = this.manager.runningTurns.get(threadID) || (inProgress
          ? this.manager.trackTurn(threadID, {
            context: this.context, label: Protocol.threadLabel(thread), doc: this.doc,
            turnID: inProgress.id,
          })
          : null);
        this.activeTurnID = running?.turnID || "";
        this.setRunning(Boolean(running));
        if (bind) this.manager.setPaperThread(this.context, threadID);
        if (!preserveNextTurnSelection) {
          this.nextTurnSelectionPending = false;
          this.applyModelSelection(thread.model, thread.reasoningEffort);
        }
        const scrollTop = preserveScroll ? this.elements.transcript.scrollTop : null;
        this.renderTranscript(Protocol.flattenTurns(thread.turns));
        if (running) this.showPendingResponse();
        if (scrollTop !== null) this.elements.transcript.scrollTop = scrollTop;
        this.updateThreadHeader();
        this.setStatus("ready", this.connectionLabel());
        return true;
      }
      catch (error) {
        if (
          serial === this.loadSerial &&
          this.isCurrentContext(contextEpoch, context) &&
          !quiet
        ) this.showError(error);
        return false;
      }
    }

    connectionLabel() {
      return "";
    }

    setStatus(state, text) {
      const revision = ++this.statusRevision;
      this.elements.status.dataset.state = state;
      this.elements.statusText.textContent = text;
      this.elements.status.hidden = state !== "error";
      if (this.elements.connectionState) {
        const connected = Boolean(this.client.process);
        const busy = connected && this.running;
        this.elements.connectionState.dataset.state = state === "error" ? "error" : busy ? "busy" : connected ? "ready" : "idle";
        setLocalizedText(this.elements.connectionState,
          busy ? "zotero-codex-chat-running" : connected ? "zotero-codex-online" : "zotero-codex-offline",
          busy ? "Replying…" : connected ? "Connected" : "Not connected");
      }
      return revision;
    }

    showError(error) {
      const message = ClientTools.publicError(error);
      const revision = this.setStatus("error", message);
      setPlainText(this.elements.pathStatus, message);
      if (error?.l10nID) {
        void formatValue(this.doc, error.l10nID, error.l10nArgs, message).then((localized) => {
          if (this.destroyed || revision !== this.statusRevision) return;
          this.setStatus("error", localized);
          setPlainText(this.elements.pathStatus, localized);
        });
      }
      this.manager.log(message, error);
    }

    renderTranscript(entries) {
      const transcript = this.elements.transcript;
      this.clearResponseScrollSpace();
      transcript.replaceChildren();
      const messages = Protocol.groupTranscriptEntries(entries);
      if (!messages.length) {
        this.renderEmpty("", "");
        return;
      }
      const latestUserIndex = messages.findLastIndex?.((entry) => entry.role === "user")
        ?? (() => {
          for (let index = messages.length - 1; index >= 0; index--) {
            if (messages[index]?.role === "user") return index;
          }
          return -1;
        })();
      messages.forEach((entry, index) => this.appendEntry(entry, {
        editMode: index === latestUserIndex ? "revert" : "fork",
      }));
      transcript.scrollTop = transcript.scrollHeight;
    }

    clearResponseScrollSpace() {
      this.elements?.transcript.style.removeProperty("--zcs-transcript-bottom-space");
    }

    positionMessageAtTop(message) {
      const transcript = this.elements.transcript;
      this.clearResponseScrollSpace();
      const style = this.doc.defaultView?.getComputedStyle?.(transcript);
      const topInset = Number.parseFloat(style?.paddingTop || "0") || 0;
      const bottomInset = Number.parseFloat(style?.paddingBottom || "0") || 0;
      const transcriptRect = transcript.getBoundingClientRect();
      const messageRect = message.getBoundingClientRect();
      const target = Math.max(
        0,
        transcript.scrollTop + messageRect.top - transcriptRect.top - topInset,
      );
      const extraSpace = Math.max(
        0,
        Math.ceil(target + transcript.clientHeight - transcript.scrollHeight),
      );
      transcript.style.setProperty(
        "--zcs-transcript-bottom-space",
        `${bottomInset + extraSpace}px`,
      );
      transcript.scrollTop = target;
      const shortfall = Math.max(0, Math.ceil(target - transcript.scrollTop));
      if (shortfall) {
        const appliedBottom = Number.parseFloat(
          this.doc.defaultView?.getComputedStyle?.(transcript)?.paddingBottom || "0",
        ) || 0;
        transcript.style.setProperty(
          "--zcs-transcript-bottom-space",
          `${appliedBottom + shortfall}px`,
        );
        transcript.scrollTop = target;
      }
    }

    renderEmpty(title, copy, { busy = false } = {}) {
      const transcript = this.elements.transcript;
      transcript.replaceChildren();
      const empty = create(this.doc, "div", `zcs-empty${busy ? " zcs-empty-busy" : ""}`);
      if (busy) {
        empty.append(create(this.doc, "span", "zcs-spinner"));
      }
      else if (!title && !copy) {
        const mark = create(this.doc, "span", "zcs-empty-mark");
        mark.append(createUIIcon(this.doc, "codex"));
        empty.append(mark,
          createL10n(this.doc, "div", "zcs-empty-title", "zotero-codex-start-reading", "Read with Codex"),
          createL10n(this.doc, "p", "zcs-empty-copy", "zotero-codex-start-reading-copy", "Ask about this paper, explore a method, or compare ideas."));
        const suggestions = create(this.doc, "div", "zcs-suggestions");
        for (const [id, label, promptID, prompt] of [
          ["zotero-codex-suggest-summary", "Explain this paper", "zotero-codex-prompt-summary", "Explain this paper's motivation, method, and main findings."],
          ["zotero-codex-suggest-method", "Walk through the method", "zotero-codex-prompt-method", "Walk through this paper's method step by step, with an example."],
        ]) {
          const button = createL10n(this.doc, "button", "zcs-suggestion", id, label);
          button.type = "button";
          button.addEventListener("click", async () => {
            const text = await formatValue(this.doc, promptID, null, prompt);
            if (this.destroyed) return;
            this.elements.input.value = text;
            this.elements.input.focus();
            this.resizeComposer();
            this.updateComposerState();
          });
          suggestions.append(button);
        }
        empty.append(suggestions);
      }
      if (title) empty.append(create(this.doc, "div", "zcs-empty-title", title));
      if (copy) empty.append(create(this.doc, "div", "zcs-empty-copy", copy));
      transcript.append(empty);
    }

    appendProcessGroup(entries) {
      const details = create(this.doc, "details", "zcs-process");
      const count = entries.length;
      details.append(createL10n(
        this.doc,
        "summary",
        "",
        "zotero-codex-processed-steps",
        count > 1 ? `Processed ${count} steps` : "Processed",
        { count },
      ));
      const body = create(this.doc, "div", "zcs-process-body");
      for (const entry of entries) {
        if (entry.role === "activity") {
          const activity = create(this.doc, "div", "zcs-process-activity", entry.text);
          const descriptor = Protocol.activityDescriptor(entry.item);
          setLocalizedText(activity, descriptor.l10nID, descriptor.fallback, descriptor.args);
          body.append(activity);
        }
        else {
          const message = create(this.doc, "div", "zcs-process-message");
          appendMarkdown(this.doc, message, entry.text);
          body.append(message);
        }
      }
      details.append(body);
      this.elements.transcript.append(details);
      return details;
    }

    makeImagePreviewable(preview, name = preview.alt) {
      preview.tabIndex = 0;
      preview.setAttribute("role", "button");
      preview.setAttribute("aria-haspopup", "dialog");
      preview.title = "Click to enlarge";
      setL10n(preview, "zotero-codex-image-enlarge");
      preview.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openImagePreview(preview, name);
      });
      preview.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        this.openImagePreview(preview, name);
      });
    }

    openImagePreview(preview, name = preview.alt) {
      const source = displayableImageSource({ url: preview.src });
      if (!source || this.destroyed) return;
      this.closeImagePreview?.();
      const doc = this.doc;
      const dialog = doc.createElementNS("http://www.w3.org/1999/xhtml", "dialog");
      dialog.className = "zcs-image-dialog";
      dialog.setAttribute("aria-label", "Image preview");
      setL10n(dialog, "zotero-codex-image-preview-dialog");
      const toolbar = create(doc, "div", "zcs-image-dialog-toolbar");
      const caption = create(doc, "span", "zcs-image-dialog-caption", Protocol.firstLine(name, 120));
      const close = create(doc, "button", "zcs-image-dialog-close");
      close.append(createUIIcon(doc, "close"));
      close.type = "button";
      close.title = "Close image preview";
      close.setAttribute("aria-label", close.title);
      setL10n(close, "zotero-codex-image-preview-close");
      toolbar.append(caption, close);
      const stage = create(doc, "div", "zcs-image-dialog-stage");
      const image = create(doc, "img", "zcs-image-dialog-image");
      image.src = source;
      image.alt = String(name || "");
      stage.append(image);
      dialog.append(toolbar, stage);
      const dismiss = () => dialog.close();
      close.addEventListener("click", dismiss);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog || event.target === stage) dismiss();
      });
      dialog.addEventListener("close", () => {
        dialog.remove();
        if (this.closeImagePreview === dismiss) this.closeImagePreview = null;
        if (!this.closeImagePreview && preview.isConnected && !this.destroyed) preview.focus({ preventScroll: true });
      }, { once: true });
      doc.documentElement.append(dialog);
      dialog.showModal();
      this.closeImagePreview = dismiss;
      close.focus();
    }

    appendMessageImages(parent, images) {
      const visible = (Array.isArray(images) ? images : [])
        .map((image) => ({ image, source: displayableImageSource(image) }))
        .filter(({ source }) => source);
      if (!visible.length) return;
      const gallery = create(this.doc, "div", "zcs-message-images");
      gallery.dataset.count = String(visible.length);
      for (const { image, source } of visible) {
        const preview = create(this.doc, "img", "zcs-message-image");
        preview.src = source;
        preview.alt = String(image.name || "");
        preview.loading = "eager";
        this.makeImagePreviewable(preview);
        gallery.append(preview);
      }
      parent.append(gallery);
    }

    appendEntry(entry, { streaming = false, editMode = "fork" } = {}) {
      const transcript = this.elements.transcript;
      if (entry.role === "process") return this.appendProcessGroup(entry.entries || []);
      if (entry.role === "generatedImage") {
        const article = create(this.doc, "article", "zcs-message zcs-assistant zcs-generated-image");
        this.appendMessageImages(article, entry.images);
        transcript.append(article);
        return article;
      }
      if (entry.role === "activity") {
        const details = create(this.doc, "details", "zcs-activity");
        const summary = create(this.doc, "summary", "", entry.text);
        const descriptor = Protocol.activityDescriptor(entry.item);
        setLocalizedText(summary, descriptor.l10nID, descriptor.fallback, descriptor.args);
        details.append(summary);
        transcript.append(details);
        return details;
      }
      if (entry.role === "assistant" && entry.phase === "commentary") {
        const details = create(this.doc, "details", "zcs-process zcs-live-process");
        details.open = streaming;
        details.append(createL10n(
          this.doc,
          "summary",
          "",
          streaming ? "zotero-codex-working" : "zotero-codex-work-process",
          streaming ? "Working…" : "Work process",
        ));
        const content = create(this.doc, "div", "zcs-message-content zcs-process-body");
        appendMarkdown(this.doc, content, entry.text);
        details.append(content);
        if (streaming) details.classList.add("zcs-streaming");
        transcript.append(details);
        return details;
      }
      const article = create(this.doc, "article", `zcs-message zcs-${entry.role}`);
      const content = create(this.doc, "div", "zcs-message-content");
      if (entry.text) appendMarkdown(this.doc, content, entry.text);
      const body = create(this.doc, "div", "zcs-message-body");
      if (entry.text) body.append(content);
      this.appendMessageImages(body, entry.images);
      if (!streaming && (entry.role === "user" || entry.role === "assistant")) {
        const actions = create(this.doc, "div", "zcs-message-actions");
        if (entry.text) {
          const copyButton = createL10n(
            this.doc,
            "button",
            "zcs-message-action",
            "zotero-codex-copy-message",
            "Copy",
          );
          copyButton.type = "button";
          copyButton.addEventListener("click", async () => {
            if (!(await copyMessageText(this.doc, entry.text))) return;
            setLocalizedText(copyButton, "zotero-codex-message-copied", "Copied");
            global.setTimeout(() => {
              if (!copyButton.isConnected) return;
              setLocalizedText(copyButton, "zotero-codex-copy-message", "Copy");
            }, 2000);
          });
          actions.append(copyButton);
        }
        if (entry.role === "user" && entry.turnID) {
          const editButton = createL10n(
            this.doc,
            "button",
            "zcs-message-action",
            "zotero-codex-edit-message",
            "Edit",
          );
          editButton.type = "button";
          editButton.addEventListener("click", () => this.beginEdit(entry, editMode));
          actions.append(editButton);
        }
        if (actions.childElementCount) article.append(actions);
      }
      article.prepend(body);
      if (streaming) article.classList.add("zcs-streaming");
      transcript.append(article);
      return article;
    }

    appendOptimisticUser(text, images = []) {
      this.elements.transcript.querySelector(".zcs-empty")?.remove();
      const message = this.appendEntry({ role: "user", text, images });
      this.positionMessageAtTop(message);
    }

    beginEdit(entry, mode = "fork") {
      if (this.running || this.creatingTask || !entry?.turnID || !this.threadID) return;
      this.closePopovers();
      this.editingMessage = {
        threadID: this.threadID,
        turnID: entry.turnID,
        text: String(entry.text || ""),
        images: Array.isArray(entry.images) ? entry.images : [],
        mode: mode === "revert" ? "revert" : "fork",
      };
      this.images = this.editingMessage.images.map((image, index) => ({
        ...image,
        id: global.crypto?.randomUUID?.() || `${Date.now()}-${index}`,
        name: image.name || image.path?.split(/[\\/]/u).pop() || `image-${index + 1}`,
        size: Number(image.size || 0),
      }));
      this.elements.editBanner.hidden = false;
      this.elements.composer.classList.add("zcs-composer-editing");
      this.elements.input.value = this.editingMessage.text;
      this.renderContextAttachment();
      this.resizeComposer();
      this.updateComposerState();
      this.elements.input.focus();
      this.elements.input.setSelectionRange?.(
        this.elements.input.value.length,
        this.elements.input.value.length,
      );
    }

    cancelEdit({ clearInput = false, focus = true } = {}) {
      if (!this.elements) return;
      const hadEdit = Boolean(this.editingMessage);
      this.editingMessage = null;
      this.elements.editBanner.hidden = true;
      this.elements.composer.classList.remove("zcs-composer-editing");
      if (hadEdit) {
        this.images = [];
        this.renderContextAttachment();
      }
      if (clearInput && hadEdit) this.elements.input.value = "";
      this.resizeComposer();
      this.updateComposerState();
      if (focus && hadEdit) this.elements.input.focus();
    }

    beginStreamingMessage(item) {
      if (!item || item.type !== "agentMessage") return;
      const itemID = String(item.id || "");
      if (itemID && itemID === this.streamingItemID) return;
      this.streamingItemID = itemID;
      this.streamingPhase = Protocol.normalizeMessagePhase(item.phase);
      this.streamingText = "";
      this.streamingNode = null;
    }

    showPendingResponse() {
      this.hidePendingResponse();
      const pending = create(this.doc, "div", "zcs-pending-response");
      pending.setAttribute("role", "status");
      pending.setAttribute("aria-live", "polite");
      pending.append(createL10n(
        this.doc,
        "span",
        "zcs-pending-response-label",
        "zotero-codex-working",
        "Working…",
      ));
      this.elements.transcript.append(pending);
      this.pendingResponseNode = pending;
    }

    hidePendingResponse() {
      this.pendingResponseNode?.remove();
      this.pendingResponseNode = null;
    }

    renderStreamingDelta(delta, itemID = "") {
      if (!delta) return;
      if (itemID && itemID !== this.streamingItemID) {
        this.streamingItemID = itemID;
        this.streamingPhase = "final";
        this.streamingText = "";
        this.streamingNode = null;
      }
      this.streamingText += delta;
      if (this.streamingPhase !== "commentary" || this.manager.isWorkProcessVisible()) {
        this.hidePendingResponse();
      }
      if (!this.streamingNode) {
        this.streamingNode = this.appendEntry(
          { role: "assistant", phase: this.streamingPhase, text: this.streamingText },
          { streaming: true },
        );
      }
      else {
        const content = this.streamingNode.querySelector(".zcs-message-content");
        content.replaceChildren();
        appendMarkdown(this.doc, content, this.streamingText);
      }
    }

    resetConversation({ clearBinding = false, focus = true, force = false } = {}) {
      if (!force && this.creatingTask) return;
      this.showPage?.("chat", { focus: false });
      this.closeImagePreview?.();
      this.loadSerial++;
      this.threadRefreshSerial++;
      this.closePopovers();
      this.threadID = "";
      this.thread = null;
      this.activeTurnID = "";
      this.running = false;
      this.streamingText = "";
      this.streamingNode = null;
      this.streamingItemID = "";
      this.streamingPhase = "final";
      this.nextTurnSelectionPending = false;
      this.images = [];
      this.hidePendingResponse();
      this.clearResponseScrollSpace();
      this.manager.setPreference("lastThreadId", "");
      if (clearBinding) this.manager.clearPaperThread(Protocol.paperContextKey(this.context));
      this.cancelEdit({ clearInput: true, focus: false });
      this.applyModelSelection(
        String(this.manager.getPreference("model") || ""),
        String(this.manager.getPreference("reasoningEffort") || ""),
      );
      this.elements.input.value = "";
      this.renderContextAttachment();
      this.resizeComposer();
      this.updateComposerState();
      this.renderEmpty("", "");
      this.updateThreadHeader();
      this.setStatus("ready", "");
      if (focus) this.elements.input.focus();
    }

    newTask() {
      this.resetConversation({ clearBinding: true, focus: true });
    }

    async createThreadForMessage(text, { epoch = this.contextEpoch, context = this.context } = {}) {
      if (this.destroyed || this.manager.reconfiguring) return null;
      if (this.threadID) return this.thread;
      this.creatingTask = true;
      this.elements.newThreadButton.disabled = true;
      this.elements.threadButton.disabled = true;
      this.updateComposerState();
      try {
        if (!context) context = await this.refreshContext();
        if (!context || !this.isCurrentContext(epoch, context)) return null;
        this.setStatus("busy", "");
        const title = Protocol.firstLine(
          this.manager.getPreference("includeItemContext") ? context.title || text : text,
          58,
        ) || "Zotero research";
        const thread = await this.client.startThread({
          cwd: this.manager.paperDirectory(context) || ClientTools.getHomeDirectory(),
          title,
          model: this.selectedModel,
        });
        if (!this.isCurrentContext(epoch, context)) return null;
        this.threadID = thread.id;
        this.thread = thread;
        this.manager.setPreference("lastThreadId", thread.id);
        this.manager.setPaperThread(context, thread.id);
        this.threads = [
          { ...thread, label: Protocol.threadLabel(thread), timestamp: Date.now() },
          ...this.threads.filter((candidate) => candidate.id !== thread.id),
        ];
        this.updateThreadHeader();
        return thread;
      }
      finally {
        this.creatingTask = false;
        this.elements.newThreadButton.disabled = this.creatingTask || this.contextTransitioning;
        this.elements.threadButton.disabled = this.creatingTask || this.contextTransitioning;
        this.updateComposerState();
      }
    }

    async send() {
      if (this.destroyed || this.manager.reconfiguring) return;
      let text = this.elements.input.value.trim();
      if (text.startsWith("/") && !this.creatingTask && !this.contextTransitioning) {
        const epoch = this.contextEpoch;
        const threadID = this.threadID;
        const draft = this.elements.input.value;
        try { text = await this.resolveSlashInput(text); }
        catch (error) { this.showError(error); return; }
        if (text === null || this.destroyed || epoch !== this.contextEpoch || threadID !== this.threadID ||
          this.elements.input.value !== draft) return;
      }
      const images = this.images.map((image) => ({ ...image }));
      const prompt = text.replace(/^\$imagegen\b\s*/u, "");
      if (
        (!prompt && !images.length) ||
        this.running ||
        this.creatingTask ||
        this.contextTransitioning
      ) return;
      const shouldAutoTitle = !this.threadID && !this.editingMessage;
      const contextEpoch = this.contextEpoch;
      let clearedInput = false;
      let sendingThreadID = "";
      let runningTurn = null;
      try {
        let paperContext = this.context;
        if (!paperContext) paperContext = await this.refreshContext();
        if (!paperContext || !this.isCurrentContext(contextEpoch, paperContext)) return;
        if (this.editingMessage) {
          const prepared = await this.prepareEditedThread(this.editingMessage, {
            epoch: contextEpoch,
            context: paperContext,
          });
          if (!prepared || !this.isCurrentContext(contextEpoch, paperContext)) return;
        }
        else if (!this.threadID) await this.createThreadForMessage(
          text || images[0]?.name || "Image",
          { epoch: contextEpoch, context: paperContext },
        );
        if (!this.threadID || !this.isCurrentContext(contextEpoch, paperContext)) return;
        const threadID = this.threadID;
        sendingThreadID = threadID;
        if (this.manager.runningTurns.has(threadID)) return;

        const pinnedSelections = this.manager.getSelections(paperContext.attachmentID);
        const liveSelection = this.manager.getLiveSelection(paperContext.attachmentID);
        const selections = Protocol.mergeContextSelections(liveSelection, pinnedSelections);
        const includeItem = Boolean(this.manager.getPreference("includeItemContext"));
        const additionalContext = includeItem || selections.length
          ? Protocol.buildZoteroContext(paperContext, selections, { includeItem })
          : null;
        this.elements.input.value = "";
        this.hideCommandMenu?.();
        this.images = [];
        clearedInput = true;
        this.resizeComposer();
        this.renderContextAttachment();
        this.updateComposerState();
        this.appendOptimisticUser(text, images);
        this.streamingText = "";
        this.streamingNode = null;
        this.streamingItemID = "";
        this.streamingPhase = "final";
        this.showPendingResponse();
        this.setRunning(true);

        let titleRequest = null;
        if (shouldAutoTitle) {
          const titleModel = this.models.find((model) =>
            model.model === this.selectedModel || model.id === this.selectedModel,
          );
          const titleEffort = titleModel?.supportedReasoningEfforts?.includes("low")
            ? "low"
            : titleModel?.defaultReasoningEffort || this.selectedEffort;
          titleRequest = {
            threadID,
            text: text || images[0]?.name || "Image",
            context: includeItem || selections.length
              ? Protocol.buildZoteroContext({
                title: paperContext.title,
                creators: paperContext.creators,
                date: paperContext.date,
                abstract: paperContext.abstract,
              }, selections, { includeItem })
              : null,
            initialName: this.thread?.name || "",
            model: this.selectedModel,
            effort: titleEffort,
          };
        }

        runningTurn = this.manager.trackTurn(threadID, {
          context: paperContext, label: Protocol.threadLabel(this.thread),
          doc: this.doc, titleRequest,
        });

        const turn = await this.client.startTurn({
          threadID,
          text,
          images,
          context: additionalContext,
          model: this.selectedModel,
          effort: this.selectedEffort,
          cwd: this.thread?.cwd || this.manager.paperDirectory(paperContext) || ClientTools.getHomeDirectory(),
          useOfficialZoteroSkill: true,
        });
        if (this.manager.runningTurns.get(threadID) === runningTurn) runningTurn.turnID = turn.id;
        this.manager.consumeSelections?.(paperContext.attachmentID, {
          liveSelectionID: liveSelection?.id || "",
          selectionIDs: pinnedSelections.map((selection) => selection.id),
        });
        if (!this.isCurrentContext(contextEpoch, paperContext) || this.threadID !== threadID) return;
        this.activeTurnID = this.manager.runningTurns.get(threadID)?.turnID || "";
        this.nextTurnSelectionPending = false;
      }
      catch (error) {
        if (runningTurn && this.manager.runningTurns.get(sendingThreadID) === runningTurn) {
          this.manager.finishTurn(runningTurn, "failed");
        }
        if (contextEpoch !== this.contextEpoch || this.destroyed ||
          (sendingThreadID && this.threadID !== sendingThreadID)) return;
        this.setRunning(false);
        this.hidePendingResponse();
        this.showError(error);
        if (clearedInput && !this.elements.input.value) {
          this.elements.input.value = text;
          this.images = images;
          this.resizeComposer();
          this.renderContextAttachment();
          this.updateComposerState();
        }
        if (this.threadID && !this.editingMessage) {
          await this.selectThread(this.threadID).catch(() => null);
        }
      }
    }

    async prepareEditedThread(
      edit,
      { epoch = this.contextEpoch, context = this.context } = {},
    ) {
      if (this.destroyed || this.manager.reconfiguring || !edit?.threadID || !edit?.turnID) return;
      this.creatingTask = true;
      this.updateComposerState();
      try {
        const thread = edit.mode === "revert"
          ? await this.client.revertThreadBeforeTurn({
              threadID: edit.threadID,
              beforeTurnID: edit.turnID,
            })
          : await this.client.forkThreadBeforeTurn({
              threadID: edit.threadID,
              beforeTurnID: edit.turnID,
              model: this.selectedModel,
            });
        if (!this.isCurrentContext(epoch, context)) return null;
        this.threadID = thread.id;
        this.thread = thread;
        this.manager.setPreference("lastThreadId", thread.id);
        this.manager.setPaperThread(context, thread.id);
        if (edit.mode === "fork") {
          this.threads = [
            { ...thread, label: Protocol.threadLabel(thread), timestamp: Date.now() },
            ...this.threads.filter((candidate) => candidate.id !== thread.id),
          ];
        }
        this.cancelEdit({ clearInput: false, focus: false });
        this.renderTranscript(Protocol.flattenTurns(thread.turns));
        this.updateThreadHeader();
        return thread;
      }
      finally {
        this.creatingTask = false;
        this.updateComposerState();
      }
    }

    setRunning(running, statusText = "") {
      this.running = running;
      this.elements.newThreadButton.disabled = this.creatingTask || this.contextTransitioning;
      this.elements.threadButton.disabled = this.creatingTask || this.contextTransitioning;
      this.elements.contextAddButton.disabled = running || this.contextTransitioning;
      this.elements.contextModeButton.disabled = running || this.contextTransitioning;
      this.elements.imageOption.disabled = running || this.contextTransitioning;
      this.elements.generateImageOption.disabled = running || this.contextTransitioning;
      this.elements.imageInput.disabled = running || this.contextTransitioning;
      this.elements.reconnectButton.disabled = this.manager.runningTurns.size > 0;
      this.updateComposerState();
      if (running) this.setStatus("busy", statusText);
      else this.setStatus("ready", this.connectionLabel());
    }

    async stop() {
      if (!this.running || !this.threadID || !this.activeTurnID) return;
      this.elements.sendButton.disabled = true;
      try {
        await this.client.interruptTurn(this.threadID, this.activeTurnID);
      }
      catch (error) {
        this.showError(error);
      }
      finally {
        this.elements.sendButton.disabled = false;
      }
    }

    async reconnect() {
      if (this.destroyed || this.manager.reconfiguring || this.manager.runningTurns.size) return;
      const path = this.elements.pathInput.value.trim();
      this.manager.setPreference("codexPath", path);
      this.setStatus("busy", "");
      try {
        await this.client.reconnect();
        if (this.client.binaryPath) setPlainText(this.elements.pathStatus, this.client.binaryPath);
        else setLocalizedText(
          this.elements.pathStatus,
          "zotero-codex-auto-detected",
          "Connected using auto-detect.",
        );
        await this.refreshModels();
        await this.refreshThreads({ reloadCurrent: true });
      }
      catch (error) {
        this.showError(error);
      }
    }

    _handleClientEvent(event) {
      if (this.destroyed) return;
      if (event.type === "connected") {
        this.setStatus("ready", "");
        if (event.binaryPath) setPlainText(this.elements.pathStatus, event.binaryPath);
        else setLocalizedText(
          this.elements.pathStatus,
          "zotero-codex-auto-detected",
          "Connected using auto-detect.",
        );
        return;
      }
      if (event.type === "disconnected") {
        this.pendingRequests.clear();
        this.renderRequests();
        this.setRunning(false);
        this.hidePendingResponse();
        this.showError(event.error || ClientTools.clientError(
          "zotero-codex-error-disconnected",
          null,
          "The connection to Codex was lost.",
        ));
        return;
      }
      if (event.type === "serverRequest") {
        this.pendingRequests.set(event.id, {
          ...event,
          contextThreadID: String(event.params?.threadId || this.threadID || ""),
          contextEpoch: this.contextEpoch,
        });
        while (this.pendingRequests.size > 100) {
          this.pendingRequests.delete(this.pendingRequests.keys().next().value);
        }
        this.renderRequests();
        return;
      }
      if (event.type !== "notification") return;
      const params = event.params || {};
      if (event.method === "skills/changed") {
        this.skillsLoaded = false;
        if (!this.elements.commandMenu.hidden) void this.refreshSkills({ forceReload: true });
        return;
      }
      if (event.method === "thread/archived" || event.method === "thread/deleted") {
        this.manager.handleThreadRemoved(String(params.threadId || ""));
        return;
      }
      if (event.method === "serverRequest/resolved") {
        this.pendingRequests.delete(params.requestId);
        this.renderRequests();
        return;
      }
      if (event.method === "turn/completed") {
        const completedThreadID = String(params.threadId || this.threadID || "");
        for (const [requestID, request] of this.pendingRequests) {
          if (request.contextThreadID === completedThreadID) this.pendingRequests.delete(requestID);
        }
        this.renderRequests();
        if (params.threadId && params.threadId !== this.threadID) return;
        if (params.turn?.id && this.activeTurnID && params.turn.id !== this.activeTurnID) return;
        this.activeTurnID = "";
        this.setRunning(false);
        this.hidePendingResponse();
        this.streamingText = "";
        this.streamingNode = null;
        this.streamingItemID = "";
        this.streamingPhase = "final";
        const epoch = this.contextEpoch;
        void this.selectThread(completedThreadID, { preserveScroll: true })
          .then((selected) => selected && this.threadID === completedThreadID &&
            epoch === this.contextEpoch && this.refreshThreads())
          .catch((error) => this.showError(error));
        return;
      }
      if (params.threadId && params.threadId !== this.threadID) return;
      if (event.method === "turn/started") {
        this.activeTurnID = params.turn?.id || this.activeTurnID;
        this.setRunning(true);
      }
      else if (event.method === "item/agentMessage/delta") {
        this.renderStreamingDelta(String(params.delta || ""), String(params.itemId || ""));
      }
      else if (event.method === "item/started") {
        const type = params.item?.type;
        if (type === "agentMessage") this.beginStreamingMessage(params.item);
        if (type && !["agentMessage", "userMessage", "reasoning"].includes(type)) {
          this.setStatus("busy", Protocol.describeActivity(params.item));
        }
      }
      else if (event.method === "error") {
        this.hidePendingResponse();
        this.showError(
          params.error?.message || params.message
            ? new Error(params.error?.message || params.message)
            : ClientTools.clientError(
                "zotero-codex-error-server",
                null,
                "Codex returned an error",
              ),
        );
      }
    }

    requestDescription(request) {
      const params = request.params || {};
      if (request.method.includes("commandExecution") || request.method === "execCommandApproval") {
        return params.command || params.reason
          ? { text: params.command || params.reason }
          : {
              id: "zotero-codex-request-command",
              text: "Codex wants to run a command",
            };
      }
      if (request.method.includes("fileChange") || request.method === "applyPatchApproval") {
        return params.reason || params.grantRoot
          ? { text: params.reason || params.grantRoot }
          : {
              id: "zotero-codex-request-file-change",
              text: "Codex wants to modify files",
            };
      }
      if (request.method.includes("permissions")) {
        return params.reason
          ? { text: params.reason }
          : {
              id: "zotero-codex-request-permissions",
              text: "Codex wants additional file or network access",
            };
      }
      return params.reason
        ? { text: params.reason }
        : { id: "zotero-codex-request-confirmation", text: "Codex needs your confirmation" };
    }

    renderRequests() {
      const area = this.elements.requestArea;
      area.replaceChildren();
      const requests = [...this.pendingRequests.values()].filter(
        (request) => request.contextThreadID
          ? request.contextThreadID === this.threadID
          : request.contextEpoch === this.contextEpoch,
      );
      area.hidden = requests.length === 0;
      for (const request of requests) {
        const card = create(this.doc, "div", "zcs-request-card");
        const description = this.requestDescription(request);
        const descriptionNode = create(this.doc, "pre", "zcs-request-description", description.text);
        if (description.id) setL10n(descriptionNode, description.id);
        card.append(
          createL10n(
            this.doc,
            "div",
            "zcs-request-title",
            "zotero-codex-confirmation-required",
            "Confirmation required",
          ),
          descriptionNode,
        );

        if (request.method.endsWith("requestUserInput")) {
          const inputs = new Map();
          for (const question of request.params?.questions || []) {
            const labelText = question.question || question.header || "Enter a value";
            const label = create(this.doc, "label", "zcs-question-label", labelText);
            if (!question.question && !question.header) setL10n(label, "zotero-codex-enter-value");
            let input;
            if (Array.isArray(question.options) && question.options.length) {
              input = create(this.doc, "select", "zcs-question-input");
              for (const optionValue of question.options) {
                const value = typeof optionValue === "string" ? optionValue : optionValue.label;
                const option = create(this.doc, "option", "", value);
                option.value = value;
                input.append(option);
              }
            }
            else {
              input = create(this.doc, "input", "zcs-question-input");
              input.type = question.isSecret ? "password" : "text";
            }
            label.append(input);
            inputs.set(question.id, input);
            card.append(label);
          }
          const submit = createL10n(
            this.doc,
            "button",
            "zcs-primary-button",
            "zotero-codex-submit",
            "Submit",
          );
          submit.addEventListener("click", () => {
            const answers = {};
            for (const [id, input] of inputs) answers[id] = { answers: [input.value] };
            this.resolveRequest(request, { answers });
          });
          card.append(submit);
        }
        else {
          const buttons = create(this.doc, "div", "zcs-request-actions");
          const deny = createL10n(
            this.doc,
            "button",
            "zcs-secondary-button",
            "zotero-codex-deny",
            "Deny",
          );
          const allow = createL10n(
            this.doc,
            "button",
            "zcs-primary-button",
            "zotero-codex-allow-once",
            "Allow once",
          );
          deny.addEventListener("click", () => this.resolveApproval(request, false));
          allow.addEventListener("click", () => this.resolveApproval(request, true));
          buttons.append(deny, allow);
          card.append(buttons);
        }
        area.append(card);
      }
    }

    resolveApproval(request, approved) {
      if (request.method.includes("permissions")) {
        this.resolveRequest(request, {
          permissions: approved ? request.params?.permissions || {} : {},
          scope: "turn",
        });
      }
      else if (request.method === "mcpServer/elicitation/request") {
        this.resolveRequest(request, { action: approved ? "accept" : "decline" });
      }
      else {
        this.resolveRequest(request, { decision: approved ? "accept" : "decline" });
      }
    }

    resolveRequest(request, result) {
      try {
        this.client.respond(request.id, result);
      }
      catch (error) {
        this.showError(error);
      }
      this.pendingRequests.delete(request.id);
      this.renderRequests();
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.closeImagePreview?.();
      this.loadSerial++;
      this.threadRefreshSerial++;
      this.pendingRequests.clear();
      this.shellResize = null;
      this.hidePendingResponse();
      this.cleanupClient?.();
      const e = this.elements;
      e.threadButton.removeEventListener("click", this.handlers.toggleThreads);
      e.headerNewButton.removeEventListener("click", this.handlers.newTask);
      e.permissionsButton.removeEventListener("click", this.handlers.permissionSettings);
      e.threadButton.removeEventListener("contextmenu", this.handlers.threadHeaderContextMenu);
      e.moreButton.removeEventListener("click", this.handlers.toggleSettings);
      e.contextAddButton.removeEventListener("click", this.handlers.toggleContextMenu);
      e.contextModeButton.removeEventListener("click", this.handlers.toggleContextMenu);
      e.modelTrigger.removeEventListener("click", this.handlers.toggleModelMenu);
      e.modelChoice.removeEventListener("click", this.handlers.toggleModelOptions);
      e.effortChoice.removeEventListener("click", this.handlers.toggleEffortOptions);
      e.cancelEditButton.removeEventListener("click", this.handlers.cancelEdit);
      e.newThreadButton.removeEventListener("click", this.handlers.newTask);
      e.paperOnlyCheckbox.removeEventListener("change", this.handlers.togglePaperOnly);
      e.refreshButton.removeEventListener("click", this.handlers.refresh);
      e.runtimeSettingsButton.removeEventListener("click", this.handlers.openRuntimeSettings);
      e.settingsBackButton.removeEventListener("click", this.handlers.closeSettings);
      e.autoPathButton.removeEventListener("click", this.handlers.useAutoPath);
      e.threadSearch.removeEventListener("input", this.handlers.searchThreads);
      e.threadList.removeEventListener("scroll", this.handlers.loadMoreThreads);
      e.archiveThreadButton.removeEventListener("click", this.handlers.archiveThread);
      e.deleteThreadButton.removeEventListener("click", this.handlers.deleteThread);
      e.contextOption.removeEventListener("click", this.handlers.toggleContext);
      e.imageOption.removeEventListener("click", this.handlers.chooseImages);
      e.generateImageOption.removeEventListener("click", this.handlers.chooseImageGeneration);
      e.sendButton.removeEventListener("click", this.handlers.sendOrStop);
      e.reconnectButton.removeEventListener("click", this.handlers.reconnect);
      e.showWorkProcessToggle.removeEventListener("change", this.handlers.toggleWorkProcess);
      for (const control of Object.values(e.permissionInputs)) control.removeEventListener("change", this.handlers.permissionChange);
      e.resizeHandle.removeEventListener("pointerdown", this.handlers.resizeStart);
      e.resizeHandle.removeEventListener("pointermove", this.handlers.resizeMove);
      e.resizeHandle.removeEventListener("pointerup", this.handlers.resizeEnd);
      e.resizeHandle.removeEventListener("pointercancel", this.handlers.resizeEnd);
      e.resizeHandle.removeEventListener("keydown", this.handlers.resizeKeydown);
      e.input.removeEventListener("input", this.handlers.input);
      e.input.removeEventListener("keydown", this.handlers.keydown);
      e.input.removeEventListener("paste", this.handlers.paste);
      e.imageInput.removeEventListener("change", this.handlers.imagesSelected);
      e.composer.removeEventListener("dragover", this.handlers.dragover);
      e.composer.removeEventListener("dragleave", this.handlers.dragleave);
      e.composer.removeEventListener("drop", this.handlers.drop);
      this.doc.removeEventListener("pointerdown", this.handlers.documentPointerdown);
      this.doc.removeEventListener("keydown", this.handlers.documentKeydown);
      this.body.replaceChildren();
    }
  }

  class SidebarManager {
    constructor({ client, stylesheetText, rootURI, getPreference, setPreference, log } = {}) {
      this.client = client;
      this.stylesheetText = stylesheetText || "";
      this.rootURI = rootURI;
      this.getPreference = getPreference;
      this.setPreference = setPreference;
      this.log = log || (() => {});
      this.locale = global.Services?.locale?.appLocaleAsBCP47 || "en-US";
      this.pluginID = "";
      this.paneID = "";
      this.views = new Map();
      this.reconfiguring = false;
      this.runtimeViews = new Map();
      this.runtimeDrafts = new WeakMap();
      this.runningTurns = new Map();
      this.completedTurnIDs = new Set();
      this.shuttingDown = false;
      this.cleanupClient = this.client?.subscribe?.((event) => this.handleTurnEvent(event));
      this.windowCleanups = new Map();
      this.styles = new Set();
      this.selections = new Map();
      this.liveSelections = new Map();
      this.liveSelectionSequence = 0;
      this.selectionPopupCleanups = new Set();
      this.readerSelectionHandler = (event) => this.handleReaderSelection(event);
    }

    trackTurn(threadID, { turnID = "", label, context, doc, titleRequest = null } = {}) {
      const run = { threadID, turnID, label, context: { ...context }, doc, titleRequest };
      this.runningTurns.set(threadID, run);
      for (const view of this.views.values()) {
        if (view.threadID === threadID) {
          view.activeTurnID = turnID;
          view.setRunning(true);
        }
        view.elements.reconnectButton.disabled = true;
        view.renderThreadPicker();
      }
      return run;
    }

    handleTurnEvent(event) {
      if (this.shuttingDown) return;
      if (event.type === "disconnected") {
        this.runningTurns.clear();
        return;
      }
      if (event.type !== "notification") return;
      const params = event.params || {};
      const threadID = String(params.threadId || "");
      const run = this.runningTurns.get(threadID);
      if (!run) return;
      if (event.method === "turn/started") {
        run.turnID = params.turn?.id || run.turnID;
        return;
      }
      if (event.method !== "turn/completed") return;
      if (run.turnID && params.turn?.id && run.turnID !== params.turn.id) return;
      if (params.turn?.id) run.turnID = params.turn.id;
      const status = params.turn?.status || "completed";
      this.finishTurn(run, status);
    }

    finishTurn(run, status) {
      if (this.runningTurns.get(run.threadID) !== run) return;
      this.runningTurns.delete(run.threadID);
      if (run.turnID) {
        this.completedTurnIDs.add(run.turnID);
        if (this.completedTurnIDs.size > 500) this.completedTurnIDs.delete(this.completedTurnIDs.values().next().value);
      }
      if (status === "completed" && run.titleRequest) void this.autoNameThread(run.titleRequest);
      const visible = [...this.views.values()].some((view) => view.isThreadVisible(run.threadID));
      if (!visible && status !== "interrupted") {
        void this.notifyTurnCompleted(run, status).catch((error) => this.log("Chat notification failed", error));
      }
      for (const view of this.views.values()) {
        if (view.threadID === run.threadID) {
          view.activeTurnID = "";
          view.setRunning(false);
        }
        view.elements.reconnectButton.disabled = this.runningTurns.size > 0;
        view.renderThreadPicker();
      }
    }

    async autoNameThread(request) {
      try {
        const history = await this.client.readThread(request.threadID);
        if (history.name && history.name !== request.initialName) return;
        const answer = Protocol.flattenTurns(history.turns?.slice(0, 1))
          .filter((message) => message.role === "assistant" && message.phase !== "commentary")
          .map((message) => message.text)
          .join("\n\n");
        const title = await this.client.generateThreadTitle({ ...request, answer });
        const current = await this.client.readThread(request.threadID);
        if (this.shuttingDown || (current.name && current.name !== request.initialName)) return;
        await this.client.setThreadName(request.threadID, title);
        for (const view of this.views.values()) {
          view.threads = view.threads.map((thread) => thread.id === request.threadID
            ? { ...thread, name: title, label: title }
            : thread);
          if (view.thread?.id === request.threadID) view.thread = { ...view.thread, name: title };
          view.updateThreadHeader();
          view.renderThreadPicker();
        }
      }
      catch (error) {
        this.log("Automatic chat title generation failed", error);
      }
    }

    async notifyTurnCompleted(run, status) {
      const failed = status === "failed";
      const headline = await formatValue(
        run.doc, failed ? "zotero-codex-chat-failed" : "zotero-codex-chat-completed",
        null, failed ? "Codex reply failed" : "Codex reply ready",
      );
      if (this.shuttingDown) return;
      try {
        const alerts = global.Cc["@mozilla.org/alerts-service;1"].getService(global.Ci.nsIAlertsService);
        alerts.showAlertNotification(
          this.rootURI + "content/icon.svg", headline, run.label || run.context.title || "Codex", true,
          run.threadID,
          { observe: (_subject, topic) => {
            if (topic === "alertclickcallback" && !this.shuttingDown) {
              void this.openTurnNotification(run).catch((error) => this.log("Could not open chat", error));
            }
          } },
          `zotero-codex-${run.threadID}`,
        );
      }
      catch (_error) {
        const popup = new global.Zotero.ProgressWindow();
        popup.changeHeadline(headline);
        popup.addLines(run.label || run.context.title || "Codex", "item");
        popup.show();
        popup.startCloseTimer(8_000);
      }
    }

    async openTurnNotification(run) {
      this.setPaperThread(run.context, run.threadID);
      if (run.context.attachmentID) {
        const reader = await global.Zotero.Reader.open(run.context.attachmentID);
        if (reader) await this.revealReaderPane(reader);
      }
      else if (run.context.itemID) {
        const win = global.Zotero.getMainWindow();
        win.focus();
        await win.ZoteroPane.selectItem(run.context.itemID);
      }
      const key = Protocol.paperContextKey(run.context);
      for (const view of this.views.values()) {
        if (Protocol.paperContextKey(view.context) !== key) continue;
        await view.selectThread(run.threadID, { bind: false });
        view.body.closest("item-details")?.scrollToPane?.(this.paneID, "smooth");
        break;
      }
    }

    runtimeDraftKey(view) {
      return JSON.stringify([view.item?.libraryID || 0, view.item?.id || view.item?.key || ""]);
    }

    saveRuntimeDraft(view) {
      const key = this.runtimeDraftKey(view);
      let drafts = this.runtimeDrafts.get(view.body);
      const text = view.elements.input.value;
      const images = view.images.map(image => ({ ...image }));
      if (!text && !images.length) {
        drafts?.delete(key);
        return;
      }
      if (!drafts) this.runtimeDrafts.set(view.body, drafts = new Map());
      drafts.set(key, { text, images });
    }

    restoreRuntimeDraft(view) {
      if (view.destroyed || view.contextTransitioning || this.views.get(view.body) !== view) return;
      const drafts = this.runtimeDrafts.get(view.body);
      const key = this.runtimeDraftKey(view);
      const draft = drafts?.get(key);
      if (!draft || view.elements.input.value || view.images.length) return;
      drafts.delete(key);
      view.elements.input.value = draft.text;
      view.images = draft.images;
      view.resizeComposer();
      view.renderContextAttachment();
      view.updateComposerState();
    }

    detachRuntimeViews() {
      this.reconfiguring = true;
      for (const [body, view] of this.views) {
        this.runtimeViews.set(body, { doc: view.doc, body, item: view.item, tabType: view.tabType });
        this.saveRuntimeDraft(view);
        view.destroy();
      }
      this.views.clear();
    }

    restoreRuntimeViews() {
      this.reconfiguring = false;
      const pending = [...this.runtimeViews.values()];
      this.runtimeViews.clear();
      for (const props of pending) {
        if (!props.body.isConnected) continue;
        const view = new SidebarView(this, props);
        this.views.set(props.body, view);
        void view.initialize().finally(() => this.restoreRuntimeDraft(view))
          .catch(error => view.showError(error));
      }
    }

    paperDirectory(context) {
      const base = this.getPreference("workingDirectory");
      if (!base) return pathDirectory(context?.pdfPath);
      const key = Protocol.paperContextKey(context);
      return key ? global.PathUtils.join(base, "papers", encodeURIComponent(key)) : base;
    }

    isWorkProcessVisible() {
      return this.getPreference("showWorkProcess") === true;
    }

    setShowWorkProcess(visible) {
      this.setPreference("showWorkProcess", Boolean(visible));
      for (const view of this.views.values()) view.applyWorkProcessPreference();
    }

    getSidebarHeight() {
      return normalizeShellHeight(this.getPreference("sidebarHeight"));
    }

    setSidebarHeight(value) {
      const height = normalizeShellHeight(value);
      if (!height) return;
      this.setPreference("sidebarHeight", height);
      for (const view of this.views.values()) view.applyShellHeight(height);
    }

    getPaperThread(contextOrKey) {
      const key = typeof contextOrKey === "string"
        ? contextOrKey
        : Protocol.paperContextKey(contextOrKey);
      if (!key) return "";
      return Protocol.normalizePaperThreadBindings(
        this.getPreference("paperThreads"),
      )[key] || "";
    }

    setPaperThread(contextOrKey, threadID) {
      const key = typeof contextOrKey === "string"
        ? contextOrKey
        : Protocol.paperContextKey(contextOrKey);
      if (!key || !threadID) return;
      this.setPreference(
        "paperThreads",
        Protocol.updatePaperThreadBindings(this.getPreference("paperThreads"), key, threadID),
      );
    }

    clearPaperThread(contextOrKey) {
      const key = typeof contextOrKey === "string"
        ? contextOrKey
        : Protocol.paperContextKey(contextOrKey);
      if (!key) return;
      this.setPreference(
        "paperThreads",
        Protocol.updatePaperThreadBindings(this.getPreference("paperThreads"), key, ""),
      );
    }

    handleThreadRemoved(threadID) {
      if (!threadID) return;
      this.runningTurns.delete(threadID);
      const bindings = Protocol.normalizePaperThreadBindings(this.getPreference("paperThreads"));
      const remaining = Object.fromEntries(
        Object.entries(bindings).filter(([, id]) => id !== threadID),
      );
      if (Object.keys(remaining).length !== Object.keys(bindings).length) {
        this.setPreference("paperThreads", JSON.stringify(remaining));
      }
      if (this.getPreference("lastThreadId") === threadID) {
        this.setPreference("lastThreadId", "");
      }
      this.client.loadedThreads?.delete(threadID);
      for (const view of this.views.values()) view.onThreadRemoved(threadID);
    }

    ensureLocalization(win) {
      if (!win?.document) return null;
      win.MozXULElement?.insertFTLIfNeeded?.(L10N_RESOURCE);
      return Array.from(win.document.querySelectorAll?.('link[rel="localization"]') || []).find(
        (link) => link.getAttribute("href") === L10N_RESOURCE,
      ) || null;
    }

    ensureStyles(doc) {
      let style = doc.querySelector('style[data-zotero-codex-sidebar="true"]');
      if (style) return style;
      style = doc.createElement("style");
      style.dataset.zoteroCodexSidebar = "true";
      style.textContent = this.stylesheetText;
      doc.documentElement.append(style);
      this.styles.add(style);
      return style;
    }

    init(pluginID) {
      if (this.paneID) return;
      this.pluginID = pluginID;
      for (const win of global.Zotero.getMainWindows?.() || []) this.ensureLocalization(win);
      this.paneID = global.Zotero.ItemPaneManager.registerSection({
        paneID: "codex-sidebar",
        pluginID,
        header: {
          l10nID: "zotero-codex-pane-header",
          icon: this.rootURI + "content/icon.svg",
        },
        sidenav: {
          l10nID: "zotero-codex-pane-sidenav",
          icon: this.rootURI + "content/icon.svg",
        },
        onInit: ({ doc }) => {
          this.ensureLocalization(doc.defaultView);
          this.ensureStyles(doc);
        },
        onDestroy: ({ body }) => this.destroyView(body),
        onItemChange: ({ body, item, tabType, setEnabled, setSectionSummary }) => {
          setEnabled(Boolean(item));
          if (!item) setSectionSummary("");
          else void formatValue(
            body.ownerDocument,
            this.getPreference("codexHome") ? "zotero-codex-section-summary-isolated" : "zotero-codex-section-summary",
            null,
            this.getPreference("codexHome") ? "Dedicated Zotero conversations" : "Shared local tasks",
          ).then(setSectionSummary);
          if (this.reconfiguring) {
            this.runtimeViews.set(body, { doc: body.ownerDocument, body, item, tabType });
          } else this.views.get(body)?.setItem(item, tabType);
        },
        onRender: (props) => {
          if (this.reconfiguring) {
            this.runtimeViews.set(props.body, props);
            return;
          }
          let view = this.views.get(props.body);
          if (!view) {
            view = new SidebarView(this, props);
            this.views.set(props.body, view);
          }
          else {
            view.setItem(props.item, props.tabType);
          }
        },
        onAsyncRender: async ({ body }) => {
          const view = this.views.get(body);
          if (!view) return;
          view.lockInitialShellHeight();
          if (!view.initialized) await view.initialize();
          else if (!view.contextTransitioning) {
            const epoch = view.contextEpoch;
            await view.refreshContext();
            await view.activatePaperConversation(epoch);
          }
        },
        onToggle: ({ body, event }) => {
          if (!event?.target?.open) return;
          const view = this.views.get(body);
          view?.lockInitialShellHeight();
          if (view && !view.initialized) void view.initialize();
        },
      });
      if (!this.paneID) throw ClientTools.clientError(
        "zotero-codex-error-register-sidebar",
        null,
        "Could not register the Zotero Codex sidebar",
      );
      global.Zotero.Reader.registerEventListener(
        "renderTextSelectionPopup",
        this.readerSelectionHandler,
        pluginID,
      );
    }

    addToWindow(win) {
      if (!win?.document || this.windowCleanups.has(win)) return;
      const localizationLink = this.ensureLocalization(win);
      const cleanup = () => localizationLink?.remove();
      this.windowCleanups.set(win, cleanup);
    }

    removeFromWindow(win) {
      this.windowCleanups.get(win)?.();
      this.windowCleanups.delete(win);
      for (const [body, view] of this.views) {
        if (body.ownerDocument?.defaultView === win) this.destroyView(body, view);
      }
    }

    handleReaderSelection({ reader, doc, params, append }) {
      const text = String(params?.annotation?.text || "").trim();
      const attachmentID = Number(reader?._item?.id || reader?.itemID);
      if (!text || !Number.isSafeInteger(attachmentID)) return;
      this.ensureLocalization(doc.defaultView);
      this.ensureStyles(doc);
      const pageIndex = Number(params?.annotation?.position?.pageIndex);
      const selection = {
        text,
        pageNumber: Number.isInteger(pageIndex) ? pageIndex + 1 : null,
        pageLabel: String(params?.annotation?.pageLabel || "").trim(),
      };
      const liveSelection = this.setLiveSelection(attachmentID, selection);
      const button = createL10n(
        doc,
        "button",
        "zcs-reader-add",
        "zotero-codex-reader-add-selection",
        "Add to Codex",
      );
      button.type = "button";
      let handled = false;
      const addToCodex = (event) => {
        if (handled || (typeof event.button === "number" && event.button !== 0)) return;
        handled = true;
        event.preventDefault();
        event.stopPropagation();
        const added = this.addSelection(attachmentID, selection);
        this.clearLiveSelection(attachmentID, liveSelection?.id);
        setLocalizedText(
          button,
          added ? "zotero-codex-reader-added-selection" : "zotero-codex-reader-selection-exists",
          added ? "Added to Codex" : "Already in Codex",
        );
        button.disabled = true;
        void this.revealReaderPane(reader);
      };
      button.addEventListener("pointerdown", addToCodex);
      button.addEventListener("mousedown", addToCodex);
      button.addEventListener("click", addToCodex);
      button.addEventListener("command", addToCodex);
      append(button);
      this.watchReaderSelectionPopup(doc, button, attachmentID, liveSelection?.id);
    }

    watchReaderSelectionPopup(doc, button, attachmentID, liveSelectionID) {
      const Observer = doc.defaultView?.MutationObserver;
      if (!Observer || !doc.documentElement || !liveSelectionID) return;
      let wasConnected = button.isConnected;
      const win = doc.defaultView;
      let observer;
      const cleanup = () => {
        observer?.disconnect();
        win?.removeEventListener?.("unload", cleanup);
        this.selectionPopupCleanups.delete(cleanup);
      };
      observer = new Observer(() => {
        if (button.isConnected) {
          wasConnected = true;
          return;
        }
        if (!wasConnected) return;
        cleanup();
        this.clearLiveSelection(attachmentID, liveSelectionID);
      });
      try {
        // Reader event documents belong to the content compartment. Its DOM
        // observer cannot read a privileged options dictionary through an Xray
        // wrapper; clone it into the observer's window before crossing realms.
        const options = { childList: true, subtree: true };
        const utils = global.Cu || global.Components?.utils;
        observer.observe(doc.documentElement, utils?.cloneInto ? utils.cloneInto(options, win) : options);
        this.selectionPopupCleanups.add(cleanup);
        win?.addEventListener?.("unload", cleanup, { once: true });
      }
      catch (error) {
        cleanup();
        this.clearLiveSelection(attachmentID, liveSelectionID);
        // Zotero dispatches plugin handlers sequentially without a per-handler
        // catch. Optional popup tracking must not prevent other plugins running.
        this.log("Could not track the PDF selection popup", error);
      }
    }

    setBoundedSelectionEntry(map, attachmentID, value) {
      map.delete(attachmentID);
      map.set(attachmentID, value);
      while (map.size > MAX_SELECTION_ATTACHMENTS) {
        const evictedID = map.keys().next().value;
        map.delete(evictedID);
        this.refreshSelectionViews(evictedID);
      }
    }

    async revealReaderPane(reader) {
      for (const win of global.Zotero.getMainWindows?.() || []) {
        const details = Array.from(win.document.querySelectorAll?.("item-details") || []).find(
          (candidate) => candidate.tabID === reader.tabID || candidate.dataset?.tabId === reader.tabID,
        );
        if (!details) continue;
        const paneButton = Array.from(details.sidenav?.querySelectorAll?.("[data-pane]") || []).find(
          (candidate) => candidate.dataset?.pane === this.paneID,
        );
        if (paneButton && typeof win.MouseEvent === "function") {
          // Zotero's sidenav only scrolls for a single click (detail === 1).
          paneButton.dispatchEvent(new win.MouseEvent("click", { bubbles: true, button: 0, detail: 1 }));
          return true;
        }
        if (typeof details.scrollToPane === "function") {
          await details.scrollToPane(this.paneID, "smooth");
          return true;
        }
      }
      return false;
    }

    addSelection(attachmentID, value) {
      const id = Number(attachmentID);
      if (!Number.isSafeInteger(id) || !value?.text) return false;
      const list = this.selections.get(id) || [];
      const duplicate = list.some(
        (entry) => entry.text === value.text && entry.pageNumber === value.pageNumber,
      );
      if (duplicate) return false;
      const selection = { ...value, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      list.push(selection);
      this.setBoundedSelectionEntry(this.selections, id, list.slice(-10));
      this.refreshSelectionViews(id, { highlightSelectionID: selection.id });
      return true;
    }

    getSelections(attachmentID) {
      const id = Number(attachmentID);
      return Number.isSafeInteger(id) ? [...(this.selections.get(id) || [])] : [];
    }

    setLiveSelection(attachmentID, value) {
      const id = Number(attachmentID);
      const text = String(value?.text || "").trim();
      if (!Number.isSafeInteger(id) || !text) return false;
      const next = {
        ...value,
        id: `current-${id}-${++this.liveSelectionSequence}`,
        text,
      };
      this.setBoundedSelectionEntry(this.liveSelections, id, next);
      this.refreshSelectionViews(id);
      return next;
    }

    getLiveSelection(attachmentID) {
      const id = Number(attachmentID);
      return Number.isSafeInteger(id) ? this.liveSelections.get(id) || null : null;
    }

    clearLiveSelection(attachmentID, expectedSelectionID = "") {
      const id = Number(attachmentID);
      if (!Number.isSafeInteger(id) || !this.liveSelections.has(id)) return;
      if (expectedSelectionID && this.liveSelections.get(id)?.id !== expectedSelectionID) return;
      this.liveSelections.delete(id);
      this.refreshSelectionViews(id);
    }

    consumeSelections(attachmentID, { liveSelectionID = "", selectionIDs = [] } = {}) {
      const id = Number(attachmentID);
      if (!Number.isSafeInteger(id)) return;
      const sentIDs = new Set(selectionIDs);
      if (sentIDs.size) {
        const remaining = (this.selections.get(id) || [])
          .filter((selection) => !sentIDs.has(selection.id));
        if (remaining.length) this.selections.set(id, remaining);
        else this.selections.delete(id);
      }
      if (liveSelectionID && this.liveSelections.get(id)?.id === liveSelectionID) {
        this.liveSelections.delete(id);
      }
      this.refreshSelectionViews(id);
    }

    removeSelection(attachmentID, selectionID) {
      const id = Number(attachmentID);
      if (!Number.isSafeInteger(id)) return;
      const remaining = (this.selections.get(id) || [])
        .filter((selection) => selection.id !== selectionID);
      if (remaining.length) this.selections.set(id, remaining);
      else this.selections.delete(id);
      this.refreshSelectionViews(id);
    }

    clearSelections(attachmentID) {
      const id = Number(attachmentID);
      if (!Number.isSafeInteger(id)) return;
      this.selections.delete(id);
      this.refreshSelectionViews(id);
    }

    refreshSelectionViews(attachmentID, options = {}) {
      for (const view of this.views.values()) {
        if (view.context?.attachmentID === attachmentID) view.renderSelections(options);
      }
    }

    destroyView(body, providedView = null) {
      const view = providedView || this.views.get(body);
      view?.destroy();
      this.views.delete(body);
      this.runtimeViews.delete(body);
      this.runtimeDrafts.delete(body);
    }

    async shutdown() {
      this.shuttingDown = true;
      this.cleanupClient?.();
      this.runningTurns.clear();
      this.completedTurnIDs.clear();
      for (const [body, view] of this.views) this.destroyView(body, view);
      if (this.paneID) global.Zotero.ItemPaneManager.unregisterSection(this.paneID);
      this.paneID = "";
      global.Zotero.Reader.unregisterEventListener?.(
        "renderTextSelectionPopup",
        this.readerSelectionHandler,
      );
      for (const cleanup of this.windowCleanups.values()) cleanup();
      this.windowCleanups.clear();
      for (const style of this.styles) style.remove();
      this.styles.clear();
      for (const cleanup of this.selectionPopupCleanups) cleanup();
      this.selectionPopupCleanups.clear();
      this.selections.clear();
      this.liveSelections.clear();
    }
  }

  modules.Sidebar = {
    SidebarManager,
    SidebarView,
    resolveItemContext,
    appendMarkdown,
    copyMessageText,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
