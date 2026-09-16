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
  const ACCEPTED_IMAGE_TYPES = new Set([
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  function create(doc, tag, className = "", text = null) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
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
      this.editingMessage = null;
      this.images = [];
      this.loadSerial = 0;
      this.initialized = false;
      this.initializing = false;
      this.activePaperKey = "";
      this.destroyed = false;
      this.pendingRequests = new Map();
      this.cleanupClient = this.client.subscribe((event) => this._handleClientEvent(event));
      this.mount();
    }

    mount() {
      const doc = this.doc;
      this.body.replaceChildren();
      const root = create(doc, "section", "zcs-shell");
      root.setAttribute("aria-label", "Codex");

      const topbar = create(doc, "div", "zcs-topbar");
      topbar.append(create(doc, "span", "zcs-topbar-spacer"));
      const threadButton = create(doc, "button", "zcs-thread-trigger");
      threadButton.type = "button";
      threadButton.setAttribute("aria-haspopup", "dialog");
      threadButton.setAttribute("aria-expanded", "false");
      const threadTitle = createL10n(
        doc,
        "span",
        "zcs-thread-title",
        "zotero-codex-new-task",
        "New task",
      );
      threadButton.append(threadTitle, create(doc, "span", "zcs-chevron", "⌄"));
      const moreButton = create(doc, "button", "zcs-icon-button zcs-more-button", "•••");
      moreButton.type = "button";
      moreButton.setAttribute("aria-haspopup", "menu");
      moreButton.setAttribute("aria-expanded", "false");
      moreButton.title = "More actions";
      moreButton.setAttribute("aria-label", "More actions");
      setL10n(moreButton, "zotero-codex-more-actions");
      topbar.append(threadButton, moreButton);

      const threadPopover = create(doc, "div", "zcs-popover zcs-thread-popover");
      threadPopover.hidden = true;
      threadPopover.setAttribute("role", "dialog");
      threadPopover.setAttribute("aria-label", "Recent tasks");
      setL10n(threadPopover, "zotero-codex-recent-tasks");
      const threadSearchBox = create(doc, "div", "zcs-search-box");
      threadSearchBox.append(create(doc, "span", "zcs-search-icon", "⌕"));
      const threadSearch = create(doc, "input", "zcs-thread-search");
      threadSearch.type = "search";
      threadSearch.placeholder = "Search recent tasks";
      threadSearch.setAttribute("aria-label", "Search recent tasks");
      setL10n(threadSearch, "zotero-codex-search-tasks");
      threadSearchBox.append(threadSearch);
      const newThreadButton = create(doc, "button", "zcs-menu-row zcs-new-thread-row");
      newThreadButton.type = "button";
      newThreadButton.append(
        create(doc, "span", "zcs-row-icon", "+"),
        createL10n(doc, "span", "zcs-row-copy", "zotero-codex-new-task", "New task"),
      );
      const threadList = create(doc, "div", "zcs-thread-list");
      threadList.setAttribute("role", "list");
      threadPopover.append(threadSearchBox, newThreadButton, threadList);

      const settingsPopover = create(doc, "div", "zcs-popover zcs-settings-popover");
      settingsPopover.hidden = true;
      settingsPopover.setAttribute("role", "menu");
      const refreshButton = create(doc, "button", "zcs-menu-row zcs-settings-action");
      refreshButton.type = "button";
      refreshButton.append(
        create(doc, "span", "zcs-row-icon", "↻"),
        createL10n(doc, "span", "zcs-row-copy", "zotero-codex-refresh-tasks", "Refresh shared tasks"),
      );
      const openSettingsButton = create(doc, "button", "zcs-menu-row zcs-settings-action");
      openSettingsButton.type = "button";
      openSettingsButton.append(
        create(doc, "span", "zcs-row-icon", "⚙"),
        createL10n(doc, "span", "zcs-row-copy", "zotero-codex-settings", "Settings"),
      );
      settingsPopover.append(refreshButton, openSettingsButton);

      const settingsView = create(doc, "section", "zcs-settings-view");
      settingsView.hidden = true;
      settingsView.tabIndex = -1;
      settingsView.setAttribute("aria-label", "Codex settings");
      setL10n(settingsView, "zotero-codex-settings-view");
      const settingsHeader = create(doc, "header", "zcs-settings-header");
      const settingsBackButton = create(doc, "button", "zcs-settings-back", "‹");
      settingsBackButton.type = "button";
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
        "Local Codex",
      ));
      const connectionCard = create(doc, "div", "zcs-connection-card");
      const connectionTop = create(doc, "div", "zcs-connection-top");
      const connectionIcon = create(doc, "span", "zcs-connection-icon", "C");
      const connectionCopy = create(doc, "div", "zcs-connection-copy");
      const connectionTitle = create(doc, "div", "zcs-connection-title", "Codex CLI");
      const connectionSubtitle = createL10n(
        doc,
        "div",
        "zcs-connection-subtitle",
        "zotero-codex-cli-subtitle",
        "Shares local tasks and sign-in state",
      );
      connectionCopy.append(connectionTitle, connectionSubtitle);
      connectionTop.append(connectionIcon, connectionCopy);
      const pathLabel = create(doc, "label", "zcs-setting-label");
      pathLabel.append(createL10n(doc, "span", "", "zotero-codex-cli-path", "Codex CLI path"));
      const pathInput = create(doc, "input", "zcs-path-input");
      pathInput.type = "text";
      pathInput.placeholder = "Auto-detect";
      setL10n(pathInput, "zotero-codex-cli-path-input");
      pathInput.value = String(this.manager.getPreference("codexPath") || "");
      pathLabel.append(pathInput);
      const pathStatus = createL10n(
        doc,
        "div",
        "zcs-path-status",
        "zotero-codex-cli-path-help",
        "Leave blank to detect common install locations.",
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
      connectionCard.append(connectionTop, pathLabel, pathStatus, settingsActions);
      const sharingNote = create(doc, "div", "zcs-settings-note");
      sharingNote.append(
        createL10n(doc, "div", "zcs-settings-note-title", "zotero-codex-task-sharing", "Task sharing"),
        createL10n(
          doc,
          "div",
          "zcs-settings-note-copy",
          "zotero-codex-task-sharing-copy",
          "Tasks opened or created here also appear in Codex Desktop, the CLI, and the browser sidebar on this computer.",
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
          "Show work process (CoT)",
        ),
        createL10n(
          doc,
          "span",
          "zcs-settings-toggle-description",
          "zotero-codex-show-work-process-description",
          "Show reasoning summaries, tool activity, and processed steps when available.",
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
      composerFooter.append(composerTools, modelTrigger, sendButton);
      composer.append(editBanner, attachments, input, imageInput, composerFooter);

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
      contextPopover.append(imageOption, contextOption, selections);

      const modelPopover = create(doc, "div", "zcs-popover zcs-model-popover");
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

      root.append(
        topbar,
        threadPopover,
        settingsPopover,
        settingsView,
        transcript,
        requestArea,
        composer,
        contextPopover,
        modelPopover,
        status,
      );
      this.body.append(root);
      this.elements = {
        root,
        threadButton,
        threadTitle,
        moreButton,
        threadPopover,
        threadSearch,
        newThreadButton,
        threadList,
        settingsPopover,
        settingsView,
        openSettingsButton,
        settingsBackButton,
        refreshButton,
        status,
        statusText,
        contextPopover,
        contextAddButton,
        contextModeButton,
        imageOption,
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
      };

      this.handlers = {
        toggleThreads: () => this.togglePopover("threads"),
        toggleSettings: () => this.togglePopover("settings"),
        toggleContextMenu: () => this.togglePopover("context"),
        toggleModelMenu: () => this.togglePopover("model"),
        toggleModelOptions: () => this.toggleModelOptions("model"),
        toggleEffortOptions: () => this.toggleModelOptions("effort"),
        cancelEdit: () => this.cancelEdit(),
        newTask: () => void this.newTask(),
        refresh: () => {
          this.closePopovers();
          void this.refreshThreads({ reloadCurrent: true });
        },
        openSettings: () => this.openSettings(),
        closeSettings: () => this.closeSettings(),
        useAutoPath: () => {
          pathInput.value = "";
          pathInput.focus();
        },
        searchThreads: () => this.renderThreadPicker(),
        toggleContext: () => this.toggleItemContext(),
        chooseImages: () => {
          this.closePopovers();
          imageInput.click();
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
        input: () => {
          this.resizeComposer();
          this.updateComposerState();
        },
        keydown: (event) => {
          if (!this.running && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            void this.send();
          }
        },
        documentClick: (event) => this.handleDocumentClick(event),
        documentKeydown: (event) => {
          if (event.key !== "Escape") return;
          if (!this.elements.settingsView.hidden) this.closeSettings();
          else this.closePopovers();
        },
      };
      threadButton.addEventListener("click", this.handlers.toggleThreads);
      moreButton.addEventListener("click", this.handlers.toggleSettings);
      contextAddButton.addEventListener("click", this.handlers.toggleContextMenu);
      contextModeButton.addEventListener("click", this.handlers.toggleContextMenu);
      modelTrigger.addEventListener("click", this.handlers.toggleModelMenu);
      modelChoice.addEventListener("click", this.handlers.toggleModelOptions);
      effortChoice.addEventListener("click", this.handlers.toggleEffortOptions);
      cancelEditButton.addEventListener("click", this.handlers.cancelEdit);
      newThreadButton.addEventListener("click", this.handlers.newTask);
      refreshButton.addEventListener("click", this.handlers.refresh);
      openSettingsButton.addEventListener("click", this.handlers.openSettings);
      settingsBackButton.addEventListener("click", this.handlers.closeSettings);
      autoPathButton.addEventListener("click", this.handlers.useAutoPath);
      threadSearch.addEventListener("input", this.handlers.searchThreads);
      contextOption.addEventListener("click", this.handlers.toggleContext);
      imageOption.addEventListener("click", this.handlers.chooseImages);
      sendButton.addEventListener("click", this.handlers.sendOrStop);
      reconnectButton.addEventListener("click", this.handlers.reconnect);
      showWorkProcessToggle.addEventListener("change", this.handlers.toggleWorkProcess);
      input.addEventListener("input", this.handlers.input);
      input.addEventListener("keydown", this.handlers.keydown);
      input.addEventListener("paste", this.handlers.paste);
      imageInput.addEventListener("change", this.handlers.imagesSelected);
      composer.addEventListener("dragover", this.handlers.dragover);
      composer.addEventListener("dragleave", this.handlers.dragleave);
      composer.addEventListener("drop", this.handlers.drop);
      doc.addEventListener("click", this.handlers.documentClick);
      doc.addEventListener("keydown", this.handlers.documentKeydown);
      this.setStatus("idle", "");
      this.applyWorkProcessPreference();
      this.renderContextAttachment();
      this.updateComposerState();
    }

    openSettings() {
      this.closePopovers();
      this.elements.settingsView.hidden = false;
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
      this.elements.settingsView.hidden = true;
      this.elements.moreButton.focus();
    }

    closePopovers(except = "") {
      const pairs = [
        ["threads", this.elements.threadPopover, this.elements.threadButton],
        ["settings", this.elements.settingsPopover, this.elements.moreButton],
        ["context", this.elements.contextPopover, this.elements.contextAddButton],
        ["model", this.elements.modelPopover, this.elements.modelTrigger],
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
        settings: [this.elements.settingsPopover, this.elements.moreButton],
        context: [this.elements.contextPopover, this.elements.contextAddButton],
        model: [this.elements.modelPopover, this.elements.modelTrigger],
      };
      const [popover, trigger] = map[name];
      const willOpen = popover.hidden;
      this.closePopovers(name);
      popover.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
      if (name === "context") this.elements.contextModeButton.setAttribute("aria-expanded", String(willOpen));
      if (willOpen && name === "threads") {
        this.elements.threadSearch.value = "";
        this.renderThreadPicker();
        global.setTimeout(() => this.elements.threadSearch.focus(), 0);
      }
      if (willOpen && name === "model") {
        this.renderModelControls();
        global.setTimeout(() => this.elements.modelChoice.focus(), 0);
      }
    }

    handleDocumentClick(event) {
      const target = event.target;
      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      const containers = [
        this.elements.threadPopover,
        this.elements.settingsPopover,
        this.elements.contextPopover,
        this.elements.modelPopover,
        this.elements.threadButton,
        this.elements.moreButton,
        this.elements.contextAddButton,
        this.elements.contextModeButton,
        this.elements.modelTrigger,
      ];
      if (containers.some((element) => element?.contains?.(target) || eventPath.includes(element))) return;
      this.closePopovers();
    }

    updateComposerState() {
      const send = this.elements.sendButton;
      this.elements.modelTrigger.disabled = this.creatingTask || !this.models.length;
      this.elements.modelChoice.disabled = this.creatingTask || !this.models.length;
      this.elements.effortChoice.disabled = this.creatingTask || !this.selectedEffort;
      this.elements.modelNextTurnHint.hidden = !this.running;
      if (this.creatingTask) {
        send.disabled = true;
        setButtonLabel(send, "…", "zotero-codex-creating-task", "Creating task");
        send.classList.remove("zcs-send-stop");
        return;
      }
      if (this.running) {
        send.disabled = false;
        setButtonLabel(send, "■", "zotero-codex-stop", "Stop generating");
        send.classList.add("zcs-send-stop");
        return;
      }
      send.disabled = !this.elements.input.value.trim() && !this.images.length;
      setButtonLabel(send, "↑", "zotero-codex-send", "Send");
      send.classList.remove("zcs-send-stop");
    }

    resizeComposer() {
      const input = this.elements.input;
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
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
      this.context = null;
      if (this.elements) this.renderSelections();
      if (changed && this.initialized) {
        void this.refreshContext()
          .then((context) => context && this.activatePaperConversation())
          .catch((error) => this.showError(error));
      }
    }

    async initialize() {
      if (this.initialized || this.initializing) return;
      this.initializing = true;
      const serial = ++this.loadSerial;
      try {
        this.setStatus("busy", "");
        await this.client.connect();
        if (serial !== this.loadSerial || this.destroyed) return;
        if (this.client.binaryPath) setPlainText(this.elements.pathStatus, this.client.binaryPath);
        else setLocalizedText(
          this.elements.pathStatus,
          "zotero-codex-auto-detected",
          "Connected using auto-detect.",
        );
        await this.refreshModels();
        await this.refreshContext();
        await this.refreshThreads();
        this.initialized = true;
      }
      catch (error) {
        this.showError(error);
      }
      finally {
        this.initializing = false;
      }
    }

    async refreshContext() {
      const item = this.item;
      const context = await resolveItemContext(item, this.tabType);
      if (this.destroyed || item !== this.item) return null;
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
      if (this.destroyed || item !== this.item) return null;
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
        this.showError(error);
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
      const previousID = this.threadID;
      this.setStatus("busy", "");
      try {
        this.threads = await this.client.listThreads(100);
        if (this.destroyed) return;
        this.renderThreadPicker();
        const paperKey = Protocol.paperContextKey(this.context);
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
        this.showError(error);
      }
    }

    async activatePaperConversation() {
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
        if (selected) return;
        this.manager.clearPaperThread(paperKey);
      }
      this.resetConversation({ focus: false });
    }

    renderThreadPicker() {
      const list = this.elements.threadList;
      list.replaceChildren();
      const query = this.elements.threadSearch.value.trim();
      const matches = Protocol.filterThreads(this.threads, query);
      const limit = query ? 24 : 8;
      const rows = matches.slice(0, limit);
      if (!matches.length) {
        list.append(createL10n(
          this.doc,
          "div",
          "zcs-thread-empty",
          this.threads.length ? "zotero-codex-no-matching-tasks" : "zotero-codex-no-tasks",
          this.threads.length ? "No matching tasks" : "No Codex tasks yet",
        ));
        return;
      }
      for (const thread of rows) {
        const row = create(this.doc, "button", "zcs-menu-row zcs-thread-row");
        row.type = "button";
        row.dataset.selected = String(thread.id === this.threadID);
        row.title = `${thread.label}\n${thread.cwd || ""}`.trim();
        const copy = create(this.doc, "span", "zcs-row-copy");
        copy.append(
          create(this.doc, "span", "zcs-row-title", thread.label),
          create(
            this.doc,
            "span",
            "zcs-row-meta",
            Protocol.relativeThreadTime(thread.timestamp, Date.now(), this.manager.locale),
          ),
        );
        row.append(create(this.doc, "span", "zcs-row-icon", thread.id === this.threadID ? "✓" : ""), copy);
        row.addEventListener("click", () => {
          this.closePopovers();
          void this.selectThread(thread.id);
        });
        list.append(row);
      }
      if (matches.length > rows.length) {
        const remaining = matches.length - rows.length;
        list.append(createL10n(
          this.doc,
          "div",
          "zcs-thread-more",
          query ? "zotero-codex-more-matching-tasks" : "zotero-codex-search-older-tasks",
          query ? `${remaining} more matching tasks` : "Search to find older tasks",
          query ? { count: remaining } : null,
        ));
      }
    }

    updateThreadHeader() {
      const thread = this.threads.find((candidate) => candidate.id === this.threadID) || this.thread;
      const label = thread ? Protocol.threadLabel(thread) : "";
      if (label) setPlainText(this.elements.threadTitle, label);
      else setLocalizedText(this.elements.threadTitle, "zotero-codex-new-task", "New task");
      this.elements.threadButton.title = label;
      this.renderThreadPicker();
    }

    async selectThread(threadID, { bind = true, quiet = false, preserveScroll = false } = {}) {
      if (!threadID || this.destroyed) return false;
      const preserveNextTurnSelection = Boolean(
        this.nextTurnSelectionPending && threadID === this.threadID,
      );
      this.images = [];
      this.renderContextAttachment();
      this.cancelEdit({ clearInput: true, focus: false });
      const serial = ++this.loadSerial;
      this.threadID = threadID;
      this.updateThreadHeader();
      this.manager.setPreference("lastThreadId", threadID);
      this.setStatus("busy", "");
      try {
        const thread = await this.client.readThread(threadID);
        if (serial !== this.loadSerial || this.destroyed || this.threadID !== threadID) return;
        this.thread = thread;
        if (bind) this.manager.setPaperThread(this.context, threadID);
        if (!preserveNextTurnSelection) {
          this.nextTurnSelectionPending = false;
          this.applyModelSelection(thread.model, thread.reasoningEffort);
        }
        const scrollTop = preserveScroll ? this.elements.transcript.scrollTop : null;
        this.renderTranscript(Protocol.flattenTurns(thread.turns));
        if (scrollTop !== null) this.elements.transcript.scrollTop = scrollTop;
        this.updateThreadHeader();
        this.setStatus("ready", this.connectionLabel());
        return true;
      }
      catch (error) {
        if (serial === this.loadSerial && !quiet) this.showError(error);
        return false;
      }
    }

    connectionLabel() {
      return "";
    }

    setStatus(state, text) {
      this.elements.status.dataset.state = state;
      this.elements.statusText.textContent = text;
      this.elements.status.hidden = state !== "error";
    }

    showError(error) {
      const message = ClientTools.publicError(error);
      this.setStatus("error", message);
      setPlainText(this.elements.pathStatus, message);
      if (error?.l10nID) {
        void formatValue(this.doc, error.l10nID, error.l10nArgs, message).then((localized) => {
          if (this.destroyed) return;
          this.setStatus("error", localized);
          setPlainText(this.elements.pathStatus, localized);
        });
      }
      this.manager.log(message, error);
    }

    renderTranscript(entries) {
      const transcript = this.elements.transcript;
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

    renderEmpty(title, copy, { busy = false } = {}) {
      const transcript = this.elements.transcript;
      transcript.replaceChildren();
      const empty = create(this.doc, "div", `zcs-empty${busy ? " zcs-empty-busy" : ""}`);
      if (busy) {
        empty.append(create(this.doc, "span", "zcs-spinner"));
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
        preview.loading = "lazy";
        gallery.append(preview);
      }
      parent.append(gallery);
    }

    appendEntry(entry, { streaming = false, editMode = "fork" } = {}) {
      const transcript = this.elements.transcript;
      if (entry.role === "process") return this.appendProcessGroup(entry.entries || []);
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
      this.appendEntry({ role: "user", text, images });
      this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
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

    renderStreamingDelta(delta, itemID = "") {
      if (!delta) return;
      if (itemID && itemID !== this.streamingItemID) {
        this.streamingItemID = itemID;
        this.streamingPhase = "final";
        this.streamingText = "";
        this.streamingNode = null;
      }
      this.streamingText += delta;
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

    resetConversation({ clearBinding = false, focus = true } = {}) {
      if (this.running || this.creatingTask) return;
      this.closePopovers();
      this.loadSerial++;
      this.threadID = "";
      this.thread = null;
      this.activeTurnID = "";
      this.streamingText = "";
      this.streamingNode = null;
      this.streamingItemID = "";
      this.streamingPhase = "final";
      this.nextTurnSelectionPending = false;
      this.images = [];
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

    async createThreadForMessage(text) {
      if (this.threadID) return this.thread;
      this.creatingTask = true;
      this.elements.newThreadButton.disabled = true;
      this.elements.threadButton.disabled = true;
      this.updateComposerState();
      try {
        if (!this.context) await this.refreshContext();
        this.setStatus("busy", "");
        const title = Protocol.firstLine(text, 58) || "Zotero research";
        const thread = await this.client.startThread({
          cwd: pathDirectory(this.context?.pdfPath) || ClientTools.getHomeDirectory(),
          title,
          model: this.selectedModel,
        });
        this.threadID = thread.id;
        this.thread = thread;
        this.manager.setPreference("lastThreadId", thread.id);
        this.manager.setPaperThread(this.context, thread.id);
        this.threads = [
          { ...thread, label: Protocol.threadLabel(thread), timestamp: Date.now() },
          ...this.threads.filter((candidate) => candidate.id !== thread.id),
        ];
        this.updateThreadHeader();
        return thread;
      }
      finally {
        this.creatingTask = false;
        this.elements.newThreadButton.disabled = this.running;
        this.elements.threadButton.disabled = this.running;
        this.updateComposerState();
      }
    }

    async send() {
      const text = this.elements.input.value.trim();
      const images = this.images.map((image) => ({ ...image }));
      if ((!text && !images.length) || this.running || this.creatingTask) return;
      let clearedInput = false;
      try {
        if (!this.context) await this.refreshContext();
        if (this.editingMessage) await this.prepareEditedThread(this.editingMessage);
        else if (!this.threadID) await this.createThreadForMessage(
          text || images[0]?.name || "Image",
        );
        if (!this.threadID) return;

        const pinnedSelections = this.manager.getSelections(this.context?.attachmentID);
        const liveSelection = this.manager.getLiveSelection(this.context?.attachmentID);
        const selections = Protocol.mergeContextSelections(liveSelection, pinnedSelections);
        const includeItem = Boolean(this.manager.getPreference("includeItemContext"));
        const context = includeItem || selections.length
          ? Protocol.buildZoteroContext(this.context, selections, { includeItem })
          : null;
        this.elements.input.value = "";
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
        this.setRunning(true);

        const turn = await this.client.startTurn({
          threadID: this.threadID,
          text,
          images,
          context,
          model: this.selectedModel,
          effort: this.selectedEffort,
        });
        this.activeTurnID = turn.id;
        this.nextTurnSelectionPending = false;
        if (pinnedSelections.length) this.manager.clearSelections(this.context?.attachmentID);
      }
      catch (error) {
        this.setRunning(false);
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

    async prepareEditedThread(edit) {
      if (!edit?.threadID || !edit?.turnID) return;
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
        this.threadID = thread.id;
        this.thread = thread;
        this.manager.setPreference("lastThreadId", thread.id);
        this.manager.setPaperThread(this.context, thread.id);
        if (edit.mode === "fork") {
          this.threads = [
            { ...thread, label: Protocol.threadLabel(thread), timestamp: Date.now() },
            ...this.threads.filter((candidate) => candidate.id !== thread.id),
          ];
        }
        this.cancelEdit({ clearInput: false, focus: false });
        this.renderTranscript(Protocol.flattenTurns(thread.turns));
        this.updateThreadHeader();
      }
      finally {
        this.creatingTask = false;
        this.updateComposerState();
      }
    }

    setRunning(running, statusText = "") {
      this.running = running;
      this.elements.newThreadButton.disabled = running || this.creatingTask;
      this.elements.threadButton.disabled = running;
      this.elements.contextAddButton.disabled = running;
      this.elements.contextModeButton.disabled = running;
      this.elements.imageOption.disabled = running;
      this.elements.imageInput.disabled = running;
      this.elements.reconnectButton.disabled = running;
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
      if (this.running) return;
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
        if (event.binaryPath) setPlainText(this.elements.pathStatus, event.binaryPath);
        else setLocalizedText(
          this.elements.pathStatus,
          "zotero-codex-auto-detected",
          "Connected using auto-detect.",
        );
        return;
      }
      if (event.type === "disconnected") {
        this.setRunning(false);
        this.showError(event.error || ClientTools.clientError(
          "zotero-codex-error-disconnected",
          null,
          "Codex App Server disconnected",
        ));
        return;
      }
      if (event.type === "serverRequest") {
        if (event.params?.threadId && event.params.threadId !== this.threadID) return;
        this.pendingRequests.set(event.id, event);
        this.renderRequests();
        return;
      }
      if (event.type !== "notification") return;
      const params = event.params || {};
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
      else if (event.method === "turn/completed") {
        this.activeTurnID = "";
        this.setRunning(false);
        this.streamingText = "";
        this.streamingNode = null;
        this.streamingItemID = "";
        this.streamingPhase = "final";
        void this.selectThread(this.threadID, { preserveScroll: true })
          .then(() => this.refreshThreads())
          .catch((error) => this.showError(error));
      }
      else if (event.method === "error") {
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
      else if (event.method === "serverRequest/resolved") {
        this.pendingRequests.delete(params.requestId);
        this.renderRequests();
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
      area.hidden = this.pendingRequests.size === 0;
      for (const request of this.pendingRequests.values()) {
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
      this.loadSerial++;
      this.cleanupClient?.();
      const e = this.elements;
      e.threadButton.removeEventListener("click", this.handlers.toggleThreads);
      e.moreButton.removeEventListener("click", this.handlers.toggleSettings);
      e.contextAddButton.removeEventListener("click", this.handlers.toggleContextMenu);
      e.contextModeButton.removeEventListener("click", this.handlers.toggleContextMenu);
      e.newThreadButton.removeEventListener("click", this.handlers.newTask);
      e.refreshButton.removeEventListener("click", this.handlers.refresh);
      e.openSettingsButton.removeEventListener("click", this.handlers.openSettings);
      e.settingsBackButton.removeEventListener("click", this.handlers.closeSettings);
      e.autoPathButton.removeEventListener("click", this.handlers.useAutoPath);
      e.threadSearch.removeEventListener("input", this.handlers.searchThreads);
      e.contextOption.removeEventListener("click", this.handlers.toggleContext);
      e.imageOption.removeEventListener("click", this.handlers.chooseImages);
      e.sendButton.removeEventListener("click", this.handlers.sendOrStop);
      e.reconnectButton.removeEventListener("click", this.handlers.reconnect);
      e.showWorkProcessToggle.removeEventListener("change", this.handlers.toggleWorkProcess);
      e.input.removeEventListener("input", this.handlers.input);
      e.input.removeEventListener("keydown", this.handlers.keydown);
      e.input.removeEventListener("paste", this.handlers.paste);
      e.imageInput.removeEventListener("change", this.handlers.imagesSelected);
      e.composer.removeEventListener("dragover", this.handlers.dragover);
      e.composer.removeEventListener("dragleave", this.handlers.dragleave);
      e.composer.removeEventListener("drop", this.handlers.drop);
      this.doc.removeEventListener("click", this.handlers.documentClick);
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
      this.windowCleanups = new Map();
      this.styles = new Set();
      this.selections = new Map();
      this.liveSelections = new Map();
      this.readerSelectionHandler = (event) => this.handleReaderSelection(event);
    }

    isWorkProcessVisible() {
      return this.getPreference("showWorkProcess") === true;
    }

    setShowWorkProcess(visible) {
      this.setPreference("showWorkProcess", Boolean(visible));
      for (const view of this.views.values()) view.applyWorkProcessPreference();
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
            "zotero-codex-section-summary",
            null,
            "Shared local tasks",
          ).then(setSectionSummary);
          this.views.get(body)?.setItem(item, tabType);
        },
        onRender: (props) => {
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
          if (!view.initialized) await view.initialize();
          else {
            await view.refreshContext();
            await view.activatePaperConversation();
          }
        },
        onToggle: ({ body, event }) => {
          if (!event?.target?.open) return;
          const view = this.views.get(body);
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
      this.setLiveSelection(attachmentID, selection);
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
        this.clearLiveSelection(attachmentID);
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
          paneButton.dispatchEvent(new win.MouseEvent("click", { bubbles: true, button: 0 }));
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
      this.selections.set(id, list.slice(-10));
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
        id: `current-${id}`,
        text,
      };
      const current = this.liveSelections.get(id);
      if (
        current?.text === next.text &&
        current?.pageNumber === next.pageNumber &&
        current?.pageLabel === next.pageLabel
      ) return false;
      this.liveSelections.set(id, next);
      this.refreshSelectionViews(id);
      return true;
    }

    getLiveSelection(attachmentID) {
      const id = Number(attachmentID);
      return Number.isSafeInteger(id) ? this.liveSelections.get(id) || null : null;
    }

    clearLiveSelection(attachmentID) {
      const id = Number(attachmentID);
      if (!Number.isSafeInteger(id) || !this.liveSelections.has(id)) return;
      this.liveSelections.delete(id);
      this.refreshSelectionViews(id);
    }

    removeSelection(attachmentID, selectionID) {
      const id = Number(attachmentID);
      if (!Number.isSafeInteger(id)) return;
      this.selections.set(
        id,
        (this.selections.get(id) || []).filter((selection) => selection.id !== selectionID),
      );
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
    }

    async shutdown() {
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
