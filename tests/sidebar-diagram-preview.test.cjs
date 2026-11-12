const test = require("node:test");
const assert = require("node:assert/strict");

global.ZoteroCodexModules = { Protocol: require("../content/protocol.js"), CodexClient: {}, Markdown: {} };
require("../content/localization.js");
require("../content/sidebar.js");
const { SidebarView } = global.ZoteroCodexModules.Sidebar;

function fixture(diagram = true) {
  const windowListeners = new Map();
  const doc = {
    defaultView: {
      addEventListener(type, listener) { windowListeners.set(type, listener); },
      removeEventListener(type) { windowListeners.delete(type); },
    },
    createElement(tag) { return this.createElementNS(null, tag); },
    createElementNS(_ns, tag) {
      const listeners = new Map(), captures = new Set();
      const node = {
        tag, children: [], style: {}, attributes: {}, className: "", isConnected: true,
        naturalWidth: 400, naturalHeight: 200, clientWidth: 800, clientHeight: 500,
        append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } },
        insertBefore(child, before) { child.parentNode = this; this.children.splice(this.children.indexOf(before), 0, child); },
        setAttribute(key, value) { this.attributes[key] = value; },
        removeAttribute(key) { delete this.attributes[key]; },
        addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
        fire(type, values = {}) {
          const event = { target: this, button: 0, pointerId: 1, clientX: 0, clientY: 0,
            deltaX: 0, deltaY: 0, deltaMode: 0,
            preventDefault() { this.defaultPrevented = true; }, ...values };
          for (const listener of listeners.get(type) || []) listener(event);
          return event;
        },
        setPointerCapture(id) { captures.add(id); },
        hasPointerCapture(id) { return captures.has(id); },
        releasePointerCapture(id) { captures.delete(id); },
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 500 }; },
        showModal() { this.open = true; },
        close() { this.open = false; this.fire("close"); },
        remove() { this.parentNode.children = this.parentNode.children.filter(child => child !== this); },
        focus() { doc.activeElement = this; },
      };
      node.classList = {
        add(name) { node.className += ` ${name}`; },
        remove(name) { node.className = node.className.split(" ").filter(value => value !== name).join(" "); },
      };
      return node;
    },
  };
  doc.documentElement = doc.createElement("root");
  const view = Object.assign(Object.create(SidebarView.prototype), { doc });
  const opener = doc.createElement("button");
  view.openImagePreview(opener, "Sample diagram", {
    source: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E", diagram,
  });
  const dialog = doc.documentElement.children[0];
  const find = (node, name) => node.className.split(" ").includes(name) ? node
    : node.children.map(child => find(child, name)).find(Boolean);
  const stage = find(dialog, "zcs-image-dialog-stage");
  const canvas = find(dialog, "zcs-diagram-dialog-canvas");
  const image = find(dialog, "zcs-image-dialog-image");
  image.fire("load");
  const transform = () => {
    const numbers = canvas.style.transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gu).map(Number);
    return { x: numbers[0], y: numbers[1], scale: numbers[2] };
  };
  return { doc, view, dialog, stage, canvas, image, transform, windowListeners, opener,
    control: name => find(dialog, name) };
}

test("pinch zoom keeps the diagram point under the cursor fixed", () => {
  const f = fixture();
  const before = f.transform();
  const point = { x: 180, y: 120 };
  const local = { x: (point.x - before.x) / before.scale, y: (point.y - before.y) / before.scale };
  const event = f.stage.fire("wheel", { ctrlKey: true, deltaY: -100, clientX: point.x, clientY: point.y });
  const after = f.transform();
  assert.ok(event.defaultPrevented);
  assert.ok(after.scale > before.scale);
  assert.ok(Math.abs(after.x + local.x * after.scale - point.x) < 1e-8);
  assert.ok(Math.abs(after.y + local.y * after.scale - point.y) < 1e-8);
  f.stage.fire("wheel", { ctrlKey: true, deltaY: 100, clientX: point.x, clientY: point.y });
  assert.ok(Math.abs(f.transform().scale - before.scale) < 1e-8);
});

test("reopening a diagram restores its zoom and pan", () => {
  const f = fixture();
  f.stage.fire("wheel", { ctrlKey: true, deltaY: -100, clientX: 180, clientY: 120 });
  f.stage.fire("wheel", { deltaX: 40, deltaY: 25 });
  const expected = f.transform();
  f.control("zcs-image-dialog-close").fire("click");
  f.view.openImagePreview(f.opener, "Sample diagram", {
    source: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E", diagram: true,
  });
  const dialog = f.doc.documentElement.children[0];
  const stage = dialog.children[1], canvas = stage.children[0], image = canvas.children[0];
  image.fire("load");
  const values = canvas.style.transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gu).map(Number);
  assert.ok(Math.abs(values[0] - expected.x) < 1e-8);
  assert.ok(Math.abs(values[1] - expected.y) < 1e-8);
  assert.equal(values[2], expected.scale);
});

test("two-finger movement pans on both axes and normalizes wheel units", () => {
  const f = fixture(), before = f.transform();
  const event = f.stage.fire("wheel", { deltaX: 40, deltaY: 25 });
  assert.ok(event.defaultPrevented);
  assert.deepEqual(f.transform(), { x: before.x - 40, y: before.y - 25, scale: before.scale });
  f.stage.fire("wheel", { deltaY: 2, deltaMode: 1, shiftKey: true });
  assert.equal(f.transform().x, before.x - 72);
});

test("the hand tool drags the diagram without closing the preview and Fit recenters it", () => {
  const f = fixture(), before = f.transform();
  f.stage.fire("pointerdown", { clientX: 100, clientY: 100 });
  assert.ok(f.stage.hasPointerCapture(1));
  f.stage.fire("pointermove", { clientX: 250, clientY: 40 });
  assert.deepEqual(f.transform(), { x: before.x + 150, y: before.y - 60, scale: before.scale });
  f.stage.fire("pointerup");
  assert.equal(f.stage.hasPointerCapture(1), false);
  f.dialog.fire("click", { target: f.canvas });
  f.dialog.fire("click", { target: f.stage });
  assert.equal(f.dialog.open, true);
  f.control("zcs-diagram-zoom-in").fire("click");
  assert.ok(f.transform().scale > before.scale);
  f.control("zcs-diagram-fit").fire("click");
  assert.deepEqual(f.transform(), before);
  f.stage.fire("wheel", { deltaX: 200 });
  f.stage.fire("dblclick");
  assert.deepEqual(f.transform(), before);
  f.control("zcs-image-dialog-close").fire("click");
  assert.equal(f.dialog.open, false);
  assert.equal(f.doc.activeElement, f.opener);
  assert.equal(f.windowListeners.has("resize"), false);
});

test("cancelling a hand drag ends capture and prevents further movement", () => {
  const f = fixture();
  f.stage.fire("pointerdown");
  f.stage.fire("pointercancel");
  const before = f.transform();
  f.stage.fire("pointermove", { clientX: 200, clientY: 100 });
  assert.deepEqual(f.transform(), before);
  assert.equal(f.stage.hasPointerCapture(1), false);
});

test("ordinary image previews retain background dismissal", () => {
  const f = fixture(false);
  f.dialog.fire("click", { target: f.stage });
  assert.equal(f.dialog.open, false);
});
