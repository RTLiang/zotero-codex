const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"), CodexClient: {}, Markdown: {},
};
require("../content/localization.js");
require("../content/preferences.js");
require("../content/sidebar.js");
const { SidebarView } = global.ZoteroCodexModules.Sidebar;

function mountedView() {
  const listeners = new Map();
  const doc = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatch(type, target, path = [target, doc]) {
      const event = { type, target, composedPath: () => path };
      for (const listener of listeners.get(type) || []) listener(event);
    },
    createElement(tag = "div") {
      return {
        ownerDocument: doc, localName: tag, children: [], dataset: {}, attributes: {}, hidden: false, value: "", listeners: new Map(),
        style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
        setAttribute(key, value) { this.attributes[key] = value; },
        getAttribute(key) { return this.attributes[key]; },
        removeAttribute(key) { delete this.attributes[key]; },
        addEventListener(type, listener) { this.listeners.set(type, listener); },
        removeEventListener(type) { this.listeners.delete(type); },
        click() { this.listeners.get("click")?.({ target: this, currentTarget: this, stopPropagation() {} }); },
        append(...children) {
          for (const child of children) { child.parentNode = this; this.children.push(child); }
        },
        appendChild(child) { this.append(child); return child; },
        replaceChildren(...children) { this.children = []; this.append(...children); },
        remove() { this.parentNode.children = this.parentNode.children.filter(child => child !== this); },
        contains(target) {
          for (let node = target; node; node = node.parentNode) if (node === this) return true;
          return false;
        },
        querySelector(selector) {
          const children = this.children.flatMap(child => [child, ...(child.children || [])]);
          return children.find(child => selector === "button" ? child.localName === "button"
            : child.attributes?.["aria-selected"] === "true");
        },
        getBoundingClientRect: () => ({ top: 650, bottom: 707 }), focus() { doc.activeElement = this; },
      };
    },
    createElementNS() { return this.createElement(); },
  };
  const view = Object.assign(Object.create(SidebarView.prototype), {
    doc, body: doc.createElement(), manager: {
      getPreference() {},
      modelSettings: () => ({ read: () => "", catalog: () => [], save() {}, refresh: async () => [] }),
    },
    setStatus() {}, applyWorkProcessPreference() {}, renderContextAttachment() {},
    updateComposerState() {}, lockInitialShellHeight() {},
  });
  view.mount();
  return view;
}

test("opening the chat picker loads history on demand", () => {
  const view = mountedView();
  let loads = 0;
  view.renderThreadPicker = () => {};
  view.refreshThreads = async () => { loads++; };
  view.togglePopover("threads");
  assert.equal(loads, 1);
  view.togglePopover("threads");
  assert.equal(loads, 1);
});

test("permission controls do not dismiss their panel on Zotero's retargeted click", () => {
  const view = mountedView();
  view.togglePopover("permissions");
  const select = view.elements.permissionInputs.approvalPolicy;
  view.doc.dispatch("pointerdown", select);
  view.doc.dispatch("mousedown", select);
  const chromeWindow = {};
  view.doc.dispatch("mouseup", { localName: "menuitem" });
  view.doc.dispatch("click", chromeWindow, [chromeWindow, view.doc]);
  assert.equal(view.elements.permissionsCard.hidden, false);
});

test("permission choices support keyboard navigation and Escape closes only the option list", () => {
  const view = mountedView();
  const preferences = new Map();
  Object.assign(view.manager, {
    getPreference: key => preferences.get(key),
    setPreference: (key, value) => preferences.set(key, value),
    views: new Map([[1, view]]),
  });
  view.togglePopover("permissions");
  const choice = view.elements.choices.approvalsReviewer;
  const key = value => choice.field.listeners.get("keydown")({
    key: value, currentTarget: choice.field, target: view.doc.activeElement,
    preventDefault() {}, stopPropagation() {},
  });
  choice.button.focus();
  key("ArrowDown");
  assert.equal(view.doc.activeElement.dataset.value, "user");
  key("Enter");
  assert.equal(preferences.get("approvalsReviewer"), "user");
  choice.button.click();
  key("Escape");
  assert.equal(choice.options.hidden, true);
  assert.equal(view.elements.permissionsCard.hidden, false);
  assert.equal(view.doc.activeElement, choice.button);
});

test("permission choices update other sidebars during a reply without changing the active turn", () => {
  const view = mountedView();
  const other = mountedView();
  const preferences = new Map();
  const manager = {
    getPreference: key => preferences.get(key),
    setPreference: (key, value) => preferences.set(key, value),
    views: new Map([[1, view], [2, other]]),
  };
  view.manager = other.manager = manager;
  view.running = true;
  view.turnID = "active-turn";
  view.togglePopover("permissions");
  view.elements.permissionInputs.sandbox.click();
  view.elements.choices.sandbox.options.children.find(option => option.dataset.value === "workspace-write").click();
  assert.equal(other.elements.permissionInputs.sandbox.value, "workspace-write");
  assert.equal(other.elements.permissionsButton.dataset.access, "workspace-write");
  assert.equal(view.running, true);
  assert.equal(view.turnID, "active-turn");
});

test("pressing outside dismisses the panel while pressing its controls keeps it open", () => {
  const view = mountedView();
  view.togglePopover("permissions");
  view.doc.dispatch("pointerdown", view.elements.permissionInputs.sandbox);
  assert.equal(view.elements.permissionsCard.hidden, false);
  view.doc.dispatch("pointerdown", view.body);
  assert.equal(view.elements.permissionsCard.hidden, true);
});

test("a retargeted pointer inside the composed path does not dismiss the model panel", () => {
  const view = mountedView();
  view.renderModelControls = () => {};
  view.togglePopover("model");
  const host = {};
  view.doc.dispatch("pointerdown", host, [view.elements.modelChoice, view.elements.modelPopover, host]);
  assert.equal(view.elements.modelPopover.hidden, false);
});

test("destroying a sidebar removes its outside-pointer listener", () => {
  const view = mountedView();
  view.pendingRequests = new Map();
  view.hidePendingResponse = () => {};
  view.togglePopover("permissions");
  view.destroy();
  view.doc.dispatch("pointerdown", view.body);
  assert.equal(view.elements.permissionsCard.hidden, false);
});

test("clicking model, reasoning and speed options saves supported choices", () => {
  const view = mountedView();
  const preferences = new Map();
  view.manager.setPreference = (key, value) => preferences.set(key, value);
  view.models = [
    { model: "first", displayName: "First", supportedReasoningEfforts: ["low", "high"], defaultReasoningEffort: "high", serviceTiers: [] },
    { model: "second", displayName: "Second", supportedReasoningEfforts: ["low", "high"], defaultReasoningEffort: "high", serviceTiers: [{ id: "priority", name: "Fast", description: "Faster responses" }] },
  ];
  view.applyModelSelection("first", "high");
  view.togglePopover("model");
  const modelOption = view.elements.modelOptions.children[1];
  view.doc.dispatch("pointerdown", modelOption);
  modelOption.click();
  assert.equal(view.elements.modelChoiceText.textContent, "Second");
  assert.equal(view.elements.modelTriggerName.textContent, "Second");
  assert.equal(preferences.get("model"), "second");
  const effortOption = view.elements.effortOptions.children[0];
  view.doc.dispatch("pointerdown", effortOption);
  effortOption.click();
  assert.equal(view.elements.effortChoiceText.textContent, "Low");
  assert.equal(view.elements.modelTriggerEffort.textContent, "Low");
  assert.equal(preferences.get("reasoningEffort"), "low");
  const fastOption = view.elements.speedOptions.children[1];
  assert.equal(fastOption.dataset.value, "priority");
  fastOption.click();
  assert.equal(preferences.get("serviceTier"), "priority");
  assert.equal(view.selectedServiceTier, "priority");
  assert.equal(view.elements.modelTriggerSpeed.hidden, false);
  view.elements.modelOptions.children[0].click();
  assert.equal(view.selectedServiceTier, "default");
  assert.equal(view.elements.speedOptions.children.length, 1);
  assert.equal(view.elements.modelTriggerSpeed.hidden, true);
  assert.equal(view.elements.modelPopover.hidden, false);
});

test("permission fields use the model choice control and persist mouse selections without dismissing the panel", () => {
  const view = mountedView();
  const preferences = new Map();
  Object.assign(view.manager, {
    getPreference: key => preferences.get(key),
    setPreference: (key, value) => preferences.set(key, value),
    views: new Map([[1, view]]),
  });
  view.togglePopover("permissions");
  for (const [key, value] of [["approvalPolicy", "never"], ["approvalsReviewer", "auto_review"], ["sandbox", "workspace-write"]]) {
    const button = view.elements.permissionInputs[key];
    assert.equal(button.localName, "button");
    view.doc.dispatch("pointerdown", button);
    button.click();
    const choice = view.elements.choices[key];
    assert.equal(choice.options.hidden, false);
    assert.equal(button.getAttribute("aria-expanded"), "true");
    const option = choice.options.children.find(child => child.dataset.value === value);
    view.doc.dispatch("pointerdown", option);
    option.click();
    assert.equal(preferences.get(key), value);
    assert.equal(button.value, value);
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(choice.options.hidden, true);
    assert.equal(view.elements.permissionsCard.hidden, false);
  }
  view.togglePopover("permissions");
  view.togglePopover("permissions");
  assert.equal(view.elements.permissionInputs.sandbox.value, "workspace-write");
});

test("only one permission list opens at a time and full access keeps network access enabled", () => {
  const view = mountedView();
  const preferences = new Map();
  Object.assign(view.manager, {
    getPreference: key => preferences.get(key),
    setPreference: (key, value) => preferences.set(key, value),
    views: new Map([[1, view]]),
  });
  view.togglePopover("permissions");
  view.elements.permissionInputs.approvalPolicy.click();
  view.elements.permissionInputs.sandbox.click();
  assert.equal(view.elements.choices.approvalPolicy.options.hidden, true);
  const full = view.elements.choices.sandbox.options.children.find(option => option.dataset.value === "danger-full-access");
  full.click();
  assert.equal(view.elements.permissionInputs.networkAccess.checked, true);
  assert.equal(view.elements.permissionInputs.networkAccess.disabled, true);
  assert.equal(preferences.get("networkAccess"), true);
});


test("waiting feedback advances, preserves elapsed time across phases, and stops on dismissal", t => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 1000 });
  const view = mountedView();
  view.showPendingResponse();
  t.after(() => view.hidePendingResponse());
  const label = () => view.pendingResponseNode.children.find(child => child.className === "zcs-pending-response-label");
  const elapsed = () => view.pendingResponseNode.children.find(child => child.className === "zcs-pending-response-elapsed");
  const hint = () => view.pendingResponseNode.children.find(child => child.className === "zcs-pending-response-hint");
  assert.equal(label().textContent, "Working…");
  assert.equal(elapsed().textContent, "0s");
  assert.equal(hint().hidden, true);
  assert.equal(view.pendingResponseNode.parentNode, view.elements.waitingArea);
  assert.equal(view.elements.waitingArea.hidden, false);
  t.mock.timers.tick(21000);
  assert.equal(elapsed().textContent, "21s");
  assert.equal(hint().hidden, false);
  view.showPendingResponse("interactive");
  assert.equal(label().textContent, "Generating interactive view…");
  assert.equal(elapsed().textContent, "21s");
  const pending = view.pendingResponseNode;
  view.hidePendingResponse();
  t.mock.timers.tick(5000);
  assert.equal(pending.children.find(child => child.className === "zcs-pending-response-elapsed").textContent, "21s");
  assert.equal(view.elements.transcript.children.includes(pending), false);
  assert.equal(view.elements.waitingArea.hidden, true);
  view.showPendingResponse();
  assert.equal(elapsed().textContent, "0s");
});

test("settings select only catalog models and keep the choice inside the plugin", async () => {
  const preferences = new Map();
  const models = [
    { model: "sample-default", displayName: "Sample default", isDefault: true, supportedReasoningEfforts: [] },
    { model: "sample-alternative", displayName: "Sample alternative", supportedReasoningEfforts: [] },
  ];
  const manager = new global.ZoteroCodexModules.Sidebar.SidebarManager({
    client: { listModels: async () => models },
    getPreference: key => preferences.get(key),
    setPreference: (key, value) => preferences.set(key, value),
  });
  const view = mountedView();
  view.manager = manager;
  manager.views.set(1, view);
  await manager.refreshModelCatalog();
  const root = view.doc.createElement();
  global.ZoteroCodexModules.Preferences.mountModels(root, manager.modelSettings());
  const select = root.children.find(node => node.className === "zcs-default-model-select");
  assert.deepEqual(select.children.map(option => option.value), ["", "sample-default", "sample-alternative"]);
  select.value = "sample-alternative";
  select.listeners.get("change")();
  assert.deepEqual([...preferences], [["model", "sample-alternative"]]);
  assert.equal(view.selectedModel, "sample-alternative");
  view.threadID = "sample-existing-chat";
  select.value = "";
  select.listeners.get("change")();
  assert.equal(preferences.get("model"), "");
  assert.equal(view.selectedModel, "sample-alternative", "changing the default leaves existing chats alone");
  view.threadID = "";
  select.listeners.get("change")();
  assert.equal(view.selectedModel, "sample-default");
  manager.modelSettings().save("sample-not-listed");
  assert.equal(preferences.get("model"), "");
});

test("model refresh falls back when a saved model disappears and preserves the catalog on failure", async () => {
  const models = [
    { model: "sample-other", supportedReasoningEfforts: [] },
    { model: "sample-default", isDefault: true, supportedReasoningEfforts: [] },
  ];
  const preferences = new Map([["model", "sample-removed"]]);
  let requests = 0, resolve;
  const client = { listModels: () => { requests++; return new Promise(done => { resolve = done; }); } };
  const manager = new global.ZoteroCodexModules.Sidebar.SidebarManager({
    client, getPreference: key => preferences.get(key), setPreference: (key, value) => preferences.set(key, value),
  });
  const view = mountedView();
  view.manager = manager;
  view.selectedModel = "sample-removed";
  manager.views.set(1, view);
  const root = view.doc.createElement();
  global.ZoteroCodexModules.Preferences.mountModels(root, manager.modelSettings());
  const select = root.children.find(node => node.className === "zcs-default-model-select");
  const button = root.children.find(node => node.className === "zcs-settings-actions").children[0];
  const status = root.children.find(node => node.className === "zcs-model-settings-status");
  const pending = button.listeners.get("click")();
  const second = manager.refreshModelCatalog();
  assert.equal(button.disabled, true);
  assert.equal(select.disabled, true);
  assert.equal(requests, 1);
  resolve(models);
  await Promise.all([pending, second]);
  assert.equal(view.selectedModel, "sample-default");
  assert.equal(preferences.get("model"), "");
  assert.equal(select.value, "");
  assert.equal(button.disabled, false);
  assert.match(status.textContent, /refreshed \(2\)/);
  preferences.set("model", "sample-other");
  client.listModels = async () => { throw new Error("Sample catalog unavailable"); };
  const options = select.children;
  await button.listeners.get("click")();
  assert.equal(select.children, options);
  assert.equal(manager.modelCatalog, models);
  assert.equal(preferences.get("model"), "sample-other");
  assert.match(status.textContent, /Sample catalog unavailable/);
  assert.equal(button.disabled, false);
});
