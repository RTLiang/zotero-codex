const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"), Markdown: {},
  CodexClient: { getHomeDirectory: () => "/home", clientError: (_id, _args, fallback) => new Error(fallback) },
};
require("../content/sidebar.js");
const { SidebarView, SidebarManager } = global.ZoteroCodexModules.Sidebar;

function element() {
  return {
    value: "", hidden: false, children: [], attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    addEventListener() {}, append(...nodes) { this.children.push(...nodes); },
    replaceChildren() { this.children = []; }, focus() { this.focused = true; }, scrollIntoView() {},
  };
}

function viewFor() {
  const view = Object.create(SidebarView.prototype);
  Object.assign(view, {
    manager: new SidebarManager({ getPreference: () => "" }),
    context: { pdfPath: "/papers/paper.pdf" }, skills: [], skillsCwd: "/papers",
    skillsLoaded: true, skillsLoading: false, skillsLoadSerial: 0, commandIndex: 0,
    doc: { createElement: () => element(), createElementNS: () => element(), l10n: { setAttributes() {} } },
    elements: { input: element(), commandMenu: { ...element(), id: "commands", hidden: true } },
    resizeComposer() {}, updateComposerState() {}, showError(error) { throw error; },
  });
  return view;
}

test("slash menu filters skills and supports keyboard selection and dismissal", () => {
  const view = viewFor();
  view.skills = [{ name: "pdf", description: "Read papers" }, { name: "research", description: "Find papers" }];
  view.elements.input.value = "/skills papers";
  view.updateCommandMenu();
  assert.deepEqual(view.commandMatches.map((entry) => entry.name), ["pdf", "research"]);
  let prevented = 0;
  const key = (value) => view.handleCommandKey({ key: value, preventDefault: () => prevented++, stopPropagation() {} });
  assert.equal(key("ArrowDown"), true);
  assert.equal(view.commandIndex, 1);
  assert.equal(key("Tab"), true);
  assert.equal(view.elements.input.value, "$research ");
  assert.equal(view.elements.commandMenu.hidden, true);
  view.elements.input.value = "/";
  view.updateCommandMenu();
  assert.equal(view.commandMatches.some((entry) => entry.name === "approvals"), true);
  assert.equal(key("Escape"), true);
  assert.equal(view.elements.input.attributes["aria-expanded"], "false");
  assert.equal(prevented, 3);
});

test("local approval command opens the permission panel during a reply without sending a turn", async () => {
  const view = viewFor();
  view.running = true;
  view.contextEpoch = 1;
  view.images = [];
  view.elements.input.value = "/approvals";
  view.elements.permissionInputs = { approvalPolicy: element() };
  view.elements.permissionsCard = { hidden: true };
  let opened = 0;
  view.togglePopover = (name) => { assert.equal(name, "permissions"); opened++; };
  await view.send();
  assert.equal(opened, 1);
  assert.equal(view.elements.permissionInputs.approvalPolicy.focused, true);
  assert.equal(view.elements.input.value, "");
  assert.equal(view.running, true);
});

test("file paths and unmatched commands can reach normal send handling", () => {
  const view = viewFor();
  view.elements.input.value = "/papers/paper.pdf";
  view.updateCommandMenu();
  assert.equal(view.elements.commandMenu.hidden, true);
  view.elements.input.value = "/missing-command";
  view.updateCommandMenu();
  assert.deepEqual(view.commandMatches, []);
  const event = { key: "Enter", preventDefault() { throw new Error("must allow send"); } };
  assert.equal(view.handleCommandKey(event), false);
  assert.equal(view.handleCommandKey({ ...event, key: "Tab" }), false);
});

test("slash skill resolution uses the selected chat directory and rejects unknown commands", async () => {
  const view = viewFor();
  view.thread = { cwd: "/other-paper" };
  view.skills = [{ name: "stale" }];
  const calls = [];
  view.client = { listSkills: async (params) => { calls.push(params); return [{ name: "pdf" }]; } };
  assert.equal(await view.resolveSlashInput("/pdf Explain this paper"), "$pdf Explain this paper");
  assert.deepEqual(calls, [{ cwd: "/other-paper", forceReload: false }]);
  await assert.rejects(view.resolveSlashInput("/stale Explain"), /Unknown command/);
  assert.equal(await view.resolveSlashInput("/papers/paper.pdf"), "/papers/paper.pdf");
});

test("late skill discovery cannot populate the next paper's menu", async () => {
  const view = viewFor();
  let finish;
  view.client = { listSkills: () => new Promise((resolve) => { finish = resolve; }) };
  const first = view.refreshSkills({ forceReload: true });
  const concurrent = view.refreshSkills();
  view.context = { pdfPath: "/next/paper.pdf" };
  finish([{ name: "old-paper-skill" }]);
  assert.deepEqual(await first, []);
  assert.deepEqual(await concurrent, []);
  assert.deepEqual(view.skills, []);
  assert.equal(view.skillsLoaded, false);
});

test("permission controls persist and update other views without changing active turns", () => {
  const view = viewFor();
  const preferences = new Map();
  let otherUpdates = 0;
  view.running = true;
  view.elements.permissionInputs = Object.fromEntries(
    ["approvalPolicy", "approvalsReviewer", "sandbox", "networkAccess"].map((key) => [key, element()]),
  );
  const controls = view.elements.permissionInputs;
  controls.approvalPolicy.value = "never";
  controls.approvalsReviewer.value = "auto_review";
  controls.sandbox.value = "danger-full-access";
  controls.networkAccess.checked = true;
  view.manager = {
    getPreference: (key) => preferences.get(key),
    setPreference: (key, value) => preferences.set(key, value),
    views: new Map([[1, view], [2, { applyPermissions: () => otherUpdates++ }]]),
  };
  view.savePermissions();
  assert.equal(preferences.get("approvalPolicy"), "never");
  assert.equal(preferences.get("approvalsReviewer"), "auto_review");
  assert.equal(preferences.get("sandbox"), "danger-full-access");
  assert.equal(controls.networkAccess.disabled, true);
  assert.equal(otherUpdates, 1);
  assert.equal(view.running, true);
});
