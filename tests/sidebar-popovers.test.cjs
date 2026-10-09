const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"), CodexClient: {}, Markdown: {},
};
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
        replaceChildren(...children) { this.children = []; this.append(...children); },
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
    doc, body: doc.createElement(), manager: { getPreference() {} },
    setStatus() {}, applyWorkProcessPreference() {}, renderContextAttachment() {},
    updateComposerState() {}, lockInitialShellHeight() {},
  });
  view.mount();
  return view;
}

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
  assert.equal(view.doc.activeElement.dataset.value, "auto_review");
  key("Enter");
  assert.equal(preferences.get("approvalsReviewer"), "auto_review");
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

test("clicking rendered model and effort options updates the controls and saved selection", () => {
  const view = mountedView();
  const preferences = new Map();
  view.manager.setPreference = (key, value) => preferences.set(key, value);
  view.models = [
    { model: "first", displayName: "First", supportedReasoningEfforts: ["low", "high"], defaultReasoningEffort: "high" },
    { model: "second", displayName: "Second", supportedReasoningEfforts: ["low", "high"], defaultReasoningEffort: "high" },
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
