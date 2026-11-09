const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function fixture() {
  const handlers = new Map();
  const channels = [];
  const frames = [];
  const win = {
    getComputedStyle: () => ({ colorScheme: "light" }),
    matchMedia: () => ({ matches: false }),
    addEventListener: (type, handler) => handlers.set(type, handler),
    removeEventListener: type => handlers.delete(type),
    setTimeout: () => 1, clearTimeout() {},
    MessageChannel: class {
      constructor() {
        this.port1 = { onmessage: null, messages: [], postMessage(message) { this.messages.push(message); }, close() { this.closed = true; } };
        this.port2 = { close() { this.closed = true; } };
        channels.push(this);
      }
    },
    MutationObserver: class {
      constructor(callback) { handlers.set('mutation', callback); }
      observe() {} disconnect() { handlers.delete('mutation'); }
    },
  };
  const doc = { defaultView: win, documentElement: {}, querySelectorAll: () => frames,
    createElement(tag) {
      const node = { tag, children: [], dataset: {}, style: {}, attributes: {}, isConnected: true, events: new Map(),
        append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(type, listener) { this.events.set(type, listener); },
        click() { this.events.get('click')?.(); },
        querySelector(selector) { return this.children.find(child => selector === "details" ? child.tag === "details" : child.className === selector.slice(1)); },
      };
      if (tag === "iframe") { node.contentWindow = {}; frames.push(node); }
      return node;
    },
  };
  win.document = doc;
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve("../content/diagram-frame.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(require.resolve("../content/markdown.js"), "utf8"), context);
  const { DiagramFrame, Markdown } = context.ZoteroCodexModules;
  DiagramFrame.configure("/* bundled library fixture */");
  return { doc, frames, handlers, channels, DiagramFrame, Markdown, root: doc.createElement("main") };
}

test("renders complete Mermaid fences while ordinary and partial code stays readable", () => {
  const f = fixture();
  f.Markdown.appendMarkdown(f.doc, f.root, '```mermaid\nflowchart TD\nA[Start] --> B[Finish]\n```');
  assert.equal(f.frames.length, 1);
  assert.equal(f.root.children[0].className, "zcs-diagram zcs-code-block");
  assert.equal(f.root.children[0].children[2].children[1].children[0].textContent, 'flowchart TD\nA[Start] --> B[Finish]');
  for (const source of ['```js\nconst x = 1;\n```', '```mermaid\nflowchart TD\nA[Start]']) {
    f.Markdown.appendMarkdown(f.doc, f.root, source);
  }
  assert.equal(f.frames.length, 1);
  assert.equal(f.root.children.at(-1).className, "zcs-code-block");
});

test("sidebar diagram expansion uses a private SVG image preview and a keyboard-accessible button", () => {
  const f = fixture();
  const opened = [];
  f.Markdown.appendMarkdown(f.doc, f.root, '```mermaid\nflowchart TD\nA[Start] --> B[Finish]\n```', {
    openDiagramPreview: (source, opener) => opened.push({ source, opener }),
  });
  const wrapper = f.root.children[0];
  const button = wrapper.children[3];
  assert.equal(button.tag, 'button');
  assert.equal(button.hidden, true);
  f.channels[0].port1.onmessage({ data: { type: 'zcs-mermaid', state: 'ready', height: 300 } });
  assert.equal(button.hidden, false);
  button.click();
  assert.equal(f.channels[0].port1.messages[0].type, 'zcs-mermaid-preview');
  f.channels[0].port1.onmessage({ data: { type: 'zcs-mermaid', state: 'preview', svg: '<script>bad()</script>' } });
  assert.equal(opened.length, 0);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Sample</text></svg>';
  f.channels[0].port1.onmessage({ data: { type: 'zcs-mermaid', state: 'preview', svg } });
  assert.equal(opened.length, 1);
  assert.ok(opened[0].source.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.equal(decodeURIComponent(opened[0].source.split(',')[1]), svg);
  assert.equal(opened[0].opener, button);
});

test("diagram text stays sandboxed and frame status uses a private message channel", () => {
  const f = fixture();
  f.DiagramFrame.append(f.doc, f.root, 'flowchart TD\nA["</script><script>parent.hacked=true</script>"]');
  const frame = f.frames[0];
  assert.equal(frame.attributes.sandbox, "allow-scripts");
  assert.match(frame.srcdoc, /connect-src 'none'/u);
  assert.doesNotMatch(frame.srcdoc, /<script>parent.hacked/u);
  const wrapper = f.root.children[0];
  assert.equal(f.handlers.has('message'), false);
  f.channels[0].port1.onmessage({ data: { type: "unrelated", state: "ready", height: 300 } });
  assert.equal(wrapper.dataset.state, "loading");
  f.channels[0].port1.onmessage({ data: { type: "zcs-mermaid", state: "ready", height: 300 } });
  assert.equal(wrapper.dataset.state, "ready");
  assert.equal(frame.style.height, "300px");
  assert.equal(wrapper.children[0].hidden, true);
  f.DiagramFrame.shutdown();
  assert.equal(f.channels[0].port1.closed, true);
  assert.equal(f.handlers.has('mutation'), false);
});

test("failed and oversized diagrams preserve the original source", () => {
  const f = fixture();
  const text = 'flowchart TD\nA[Unclosed';
  f.DiagramFrame.append(f.doc, f.root, text);
  f.channels[0].port1.onmessage({ data: { type: "zcs-mermaid", state: "error" } });
  const wrapper = f.root.children[0];
  assert.equal(wrapper.dataset.state, "error");
  assert.equal(f.frames[0].hidden, true);
  assert.equal(wrapper.children[2].open, true);
  assert.equal(wrapper.children[2].children[1].children[0].textContent, text);
  f.DiagramFrame.append(f.doc, f.root, 'a'.repeat(32001));
  assert.equal(f.frames.length, 1);
  assert.equal(f.root.children[1].dataset.state, "error");
});

test("the bundled library renders Chinese flowcharts and sequences with both built-in themes", () => {
  const context = vm.createContext({ console, setTimeout, clearTimeout, atob });
  vm.runInContext('self = globalThis; window = globalThis;', context);
  vm.runInContext(fs.readFileSync(require.resolve('../content/vendor/beautiful-mermaid/beautiful-mermaid.min.js'), 'utf8'), context);
  const renderer = context.BeautifulMermaid;
  for (const theme of ['github-light', 'github-dark']) {
    const svg = renderer.renderMermaidSVG('flowchart TD\nA[输入] --> B[处理]\nB -. 补充信息 .-> C[输出]', renderer.THEMES[theme]);
    assert.match(svg, /<svg/u);
    for (const label of ['输入', '处理', '补充信息', '输出']) assert.ok(svg.includes(label));
    assert.match(renderer.renderMermaidSVG('sequenceDiagram\nAlice->>Bob: Sample message', renderer.THEMES[theme]), /Sample message/u);
  }
  assert.throws(() => renderer.renderMermaidSVG('not a diagram'), /Invalid mermaid header/u);
  const hostile = renderer.renderMermaidSVG('flowchart TD\nA["<script>alert(1)</script>"] --> B[Result]');
  assert.doesNotMatch(hostile, /<script>/u);
  assert.match(hostile, /&lt;script&gt;/u);
});
