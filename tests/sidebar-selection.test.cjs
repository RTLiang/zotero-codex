const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"),
  CodexClient: {},
  Markdown: {},
};
require("../content/sidebar.js");

const { SidebarManager } = global.ZoteroCodexModules.Sidebar;

function createManager() {
  const preferences = new Map();
  return new SidebarManager({
    client: {},
    getPreference: (name) => preferences.get(name),
    setPreference: (name, value) => preferences.set(name, value),
  });
}

test("does not let a closed stale popup clear a newer live selection", () => {
  const manager = createManager();
  const first = manager.setLiveSelection(7, { text: "First", pageNumber: 1 });
  const second = manager.setLiveSelection(7, { text: "Second", pageNumber: 2 });

  manager.clearLiveSelection(7, first.id);
  assert.equal(manager.getLiveSelection(7).id, second.id);

  manager.clearLiveSelection(7, second.id);
  assert.equal(manager.getLiveSelection(7), null);
});

test("consumes only selections included in the completed send", () => {
  const manager = createManager();
  manager.addSelection(9, { text: "Sent pinned text", pageNumber: 3 });
  const sentPinned = manager.getSelections(9)[0];
  const sentLive = manager.setLiveSelection(9, { text: "Sent live text", pageNumber: 4 });

  manager.addSelection(9, { text: "New pinned text", pageNumber: 5 });
  const newLive = manager.setLiveSelection(9, { text: "New live text", pageNumber: 6 });
  manager.consumeSelections(9, {
    liveSelectionID: sentLive.id,
    selectionIDs: [sentPinned.id],
  });

  assert.deepEqual(manager.getSelections(9).map((selection) => selection.text), ["New pinned text"]);
  assert.equal(manager.getLiveSelection(9).id, newLive.id);
});

test("removes the live and pinned selections after they are sent", () => {
  const manager = createManager();
  manager.addSelection(11, { text: "Pinned once", pageNumber: 7 });
  const pinned = manager.getSelections(11)[0];
  const live = manager.setLiveSelection(11, { text: "Live once", pageNumber: 8 });

  manager.consumeSelections(11, {
    liveSelectionID: live.id,
    selectionIDs: [pinned.id],
  });

  assert.deepEqual(manager.getSelections(11), []);
  assert.equal(manager.getLiveSelection(11), null);
});
