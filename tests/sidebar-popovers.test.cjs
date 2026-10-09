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
    createElement() {
      return {
        ownerDocument: doc, children: [], dataset: {}, hidden: false, value: "", listeners: new Map(),
        style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {}, removeAttribute() {},
        addEventListener(type, listener) { this.listeners.set(type, listener); },
        removeEventListener(type) { this.listeners.delete(type); },
        click() { this.listeners.get("click")?.({ target: this, stopPropagation() {} }); },
        append(...children) {
          for (const child of children) { child.parentNode = this; this.children.push(child); }
        },
        replaceChildren(...children) { this.children = []; this.append(...children); },
        contains(target) {
          for (let node = target; node; node = node.parentNode) if (node === this) return true;
          return false;
        },
        getBoundingClientRect: () => ({ top: 650, bottom: 707 }), focus() {},
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

test("opening a native permission menu does not dismiss its panel on Zotero's retargeted click", () => {
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
