const test = require("node:test");
const assert = require("node:assert/strict");
const Markdown = require("../content/markdown.js");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"), CodexClient: { publicError: error => error.message }, Markdown,
};
require("../content/localization.js");
require("../content/sidebar.js");
const { SidebarView, resolvePaperLink, appendMarkdown } = global.ZoteroCodexModules.Sidebar;

function errorStatusView() {
  return Object.assign(Object.create(SidebarView.prototype), {
    statusRevision: 0,
    transientStatusTimer: null,
    elements: { status: { dataset: {}, hidden: true }, statusText: {}, pathStatus: {} },
    manager: { log() {} },
  });
}

test("PDF lookup errors disappear after one second and clear their settings text", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const view = errorStatusView();
  view.showError(new Error("Missing figure"), { transient: true });
  t.mock.timers.tick(999);
  assert.equal(view.elements.status.hidden, false);
  t.mock.timers.tick(1);
  assert.equal(view.elements.status.hidden, true);
  assert.equal(view.elements.statusText.textContent, "");
  assert.equal(view.elements.pathStatus.textContent, "");
});

test("an expired PDF error cannot clear a newer connection error", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const view = errorStatusView();
  view.showError(new Error("Missing figure"), { transient: true });
  t.mock.timers.tick(500);
  view.showError(new Error("Connection failed"));
  t.mock.timers.tick(1000);
  assert.equal(view.elements.status.hidden, false);
  assert.equal(view.elements.statusText.textContent, "Connection failed");
  assert.equal(view.elements.pathStatus.textContent, "Connection failed");
});

test("delayed localization cannot restore an expired PDF error", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const view = errorStatusView();
  let translate;
  view.doc = { l10n: { formatValue: () => new Promise(resolve => { translate = resolve; }) } };
  view.showError(Object.assign(new Error("Missing figure"), { l10nID: "missing" }), { transient: true });
  t.mock.timers.tick(1000);
  translate("Translated missing figure");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.elements.status.hidden, true);
  assert.equal(view.elements.pathStatus.textContent, "");
});

test("same-item links use explicit PDF locations and otherwise keep their web target", () => {
  const context = {
    attachmentID: 42,
    pdfPath: "/tmp/document.pdf",
    url: "https://arxiv.org/abs/0000.00000",
  };
  assert.deepEqual(resolvePaperLink("https://arxiv.org/html/0000.00000#S4", context,
    "第 4 节"), { kind: "pdf", reference: { sectionNumber: "4" } });
  assert.deepEqual(resolvePaperLink("https://arxiv.org/html/0000.00000", context,
    "方法部分"), { kind: "pdf", reference: { sectionTitle: "method" } });
  assert.equal(resolvePaperLink("https://arxiv.org/html/0000.00000", context,
    "更多信息"), null);
  assert.deepEqual(resolvePaperLink("https://arxiv.org/pdf/0000.00000#page=5", context,
    "文档原文，3.2.2 节"), { kind: "pdf", reference: { pageNumber: 5, sectionNumber: "3.2.2" } });
});

function documentStub() {
  return {
    createElement(tag) {
      return {
        tag, children: [], listeners: {}, dataset: {}, style: {},
        append(...children) { this.children.push(...children); },
        addEventListener(type, handler) { this.listeners[type] = handler; },
      };
    },
    createTextNode(text) { return { tag: "#text", text }; },
  };
}

test("external sources remain clickable links in a PDF chat", async () => {
  const doc = documentStub(), root = doc.createElement("div");
  const urls = [
    "https://github.com/example/project/blob/main/example.py#L42",
    "https://example.com/documentation",
  ];
  const opened = [], pdfOpened = [];
  const previousZotero = global.Zotero;
  global.Zotero = { launchURL: url => opened.push(url) };
  try {
    appendMarkdown(doc, root,
      `[示例代码](${urls[0]}) [文档](${urls[1]}) [文档](#page=1)`,
      reference => pdfOpened.push(reference), {
        attachmentID: 42, pdfPath: "/tmp/document.pdf", url: "https://example.com/paper",
      });
    const links = root.children[0].children.filter(node => node.tag === "a");
    assert.equal(links.length, 3);
    assert.deepEqual(links.slice(0, 2).map(link => link.href), urls);
    assert.ok(links.every(link => link.className.includes("zcs-link")));
    for (const link of links) await link.listeners.click({ preventDefault() {} });
    assert.deepEqual(opened, urls);
    assert.deepEqual(pdfOpened, [{ pageNumber: 1 }]);
  }
  finally {
    if (previousZotero === undefined) delete global.Zotero;
    else global.Zotero = previousZotero;
  }
});

test("a link to another locally saved paper prefers its PDF copy in Zotero", async () => {
  const doc = documentStub(), root = doc.createElement("div");
  const target = "https://arxiv.org/pdf/0000.12345.pdf";
  const local = {
    id: 13,
    isRegularItem: () => true,
    getField: field => field === "url" ? "https://arxiv.org/abs/0000.12345" : "",
    getAttachments: () => [12],
  };
  const opened = [], launched = [];
  const previousZotero = global.Zotero;
  global.Zotero = {
    Search: class {
      addCondition(field, operator, value) { this.condition = [field, operator, value]; }
      async search() { return this.condition[0] === "url" ? [11, 13] : []; }
    },
    Libraries: { getAll: () => [{ libraryID: 1 }] },
    Items: { get: id => id === 12 ? { id: 12, isPDFAttachment: () => true }
      : id === 13 ? local : { id: 11, isRegularItem: () => true,
        getField: local.getField, getAttachments: () => [] } },
    Reader: { open: async id => opened.push(id) },
    launchURL: url => launched.push(url),
  };
  try {
    appendMarkdown(doc, root, `[另一本合成论文](${target})`, null,
      { attachmentID: 99, pdfPath: "/tmp/current.pdf", url: "https://example.com/current" });
    const link = root.children[0].children.find(node => node.tag === "a");
    await link.listeners.click({ preventDefault() {} });
    assert.deepEqual(opened, [12]);
    assert.deepEqual(launched, []);
  }
  finally {
    if (previousZotero === undefined) delete global.Zotero;
    else global.Zotero = previousZotero;
  }
});

test("another local PDF keeps its page and section when its Markdown link is clicked", async () => {
  const previousZotero = global.Zotero;
  const local = {
    id: 13, isRegularItem: () => true,
    getField: field => field === "url" ? "https://arxiv.org/abs/0000.12345" : "",
    getAttachments: () => [12],
  };
  const opened = [], navigated = [], launched = [];
  const pdfDocument = {
    numPages: 6, getPage() {},
    async getOutline() { return [{ title: "3.2.2 Synthetic timing rules", dest: [4, { name: "XYZ" }, 40, 180, null] }]; },
  };
  const reader = {
    _initPromise: Promise.resolve(),
    _internalReader: { _primaryView: { initializedPromise: Promise.resolve(),
      _iframeWindow: { PDFViewerApplication: { pdfDocument } } } },
    navigate: async location => navigated.push(location),
  };
  global.Zotero = {
    Search: class { addCondition() {} async search() { return [13]; } },
    Libraries: { getAll: () => [{ libraryID: 1 }] },
    Items: { get: id => id === 13 ? local : { id: 12, isPDFAttachment: () => true } },
    Reader: { open: async (id, location) => { opened.push({ id, location }); return reader; } },
    launchURL: url => launched.push(url),
  };
  try {
    const view = Object.assign(Object.create(SidebarView.prototype), {
      context: { attachmentID: 99 }, showError(error) { throw error; },
    });
    const cases = [
      { attachmentID: 12, pdfPath: "/fixtures/target.pdf", url: local.getField("url") },
      { attachmentID: 99, pdfPath: "/fixtures/current.pdf", url: "https://example.com/current" },
      null,
    ];
    for (const context of cases) {
      opened.length = 0;
      navigated.length = 0;
      view.context = context;
      const doc = documentStub(), root = doc.createElement("div");
      appendMarkdown(doc, root,
        "[文档原文，3.2.2 节](https://arxiv.org/pdf/0000.12345#page=5)",
        (reference, attachmentID) => view.openPdfReference(reference, attachmentID), context);
      const link = root.children[0].children.find(node => node.tag === "a");
      await link.listeners.click({ preventDefault() {} });
      assert.deepEqual(opened, [{ id: 12, location: { pageIndex: 4 } }]);
      assert.deepEqual(navigated, [{ position: { pageIndex: 4, rects: [[40, 178, 41, 192]] } }]);
      assert.equal(view.context, context);
    }
    assert.deepEqual(launched, []);
  }
  finally {
    if (previousZotero === undefined) delete global.Zotero;
    else global.Zotero = previousZotero;
  }
});

test("a local paper without a PDF is selected and an unmatched link opens online", async () => {
  const doc = documentStub(), root = doc.createElement("div");
  const localURL = "https://doi.org/10.9999/synthetic-paper";
  const remoteURL = "https://example.com/unmatched-paper";
  const selected = [], launched = [];
  const previousZotero = global.Zotero;
  global.Zotero = {
    Search: class {
      addCondition(field, operator, value) { this.condition = [field, operator, value]; }
      async search() { return this.condition[0] === "DOI" ? [21] : []; }
    },
    Libraries: { getAll: () => [{ libraryID: 1 }] },
    Items: { get: () => ({ id: 21, isRegularItem: () => true,
      getField: field => field === "DOI" ? "10.9999/synthetic-paper" : "",
      getAttachments: () => [] }) },
    getActiveZoteroPane: () => ({ selectItem: async id => { selected.push(id); return true; } }),
    launchURL: url => launched.push(url),
  };
  try {
    appendMarkdown(doc, root, `[本地合成论文](${localURL}) [未收藏论文](${remoteURL})`);
    const links = root.children[0].children.filter(node => node.tag === "a");
    for (const link of links) await link.listeners.click({ preventDefault() {} });
    assert.deepEqual(selected, [21]);
    assert.deepEqual(launched, [remoteURL]);
  }
  finally {
    if (previousZotero === undefined) delete global.Zotero;
    else global.Zotero = previousZotero;
  }
});

test("a journal download link opens a saved article with the same article number", async () => {
  const doc = documentStub(), root = doc.createElement("div");
  const opened = [], launched = [];
  const previousZotero = global.Zotero;
  global.Zotero = {
    Search: class {
      addCondition(field, operator, value) { this.condition = [field, operator, value]; }
      async search() { return this.condition[0] === "url" && this.condition[2] === "12345" ? [31] : []; }
    },
    Libraries: { getAll: () => [{ libraryID: 1 }] },
    Items: { get: id => id === 31 ? { id, isRegularItem: () => true,
      getField: field => field === "url" ? "https://journal.example/index.php/Synthetic/article/view/12345" : "",
      getAttachments: () => [32] } : { id, isPDFAttachment: () => true } },
    Reader: { open: async id => opened.push(id) },
    launchURL: url => launched.push(url),
  };
  try {
    appendMarkdown(doc, root,
      "[合成期刊论文](https://journal.example/index.php/Synthetic/article/download/12345/67890)");
    await root.children[0].children.find(node => node.tag === "a")
      .listeners.click({ preventDefault() {} });
    assert.deepEqual(opened, [32]);
    assert.deepEqual(launched, []);
  }
  finally {
    if (previousZotero === undefined) delete global.Zotero;
    else global.Zotero = previousZotero;
  }
});

test("harness citation targets navigate by their explicit locator regardless of label", () => {
  const doc = documentStub();
  const root = doc.createElement("div");
  const opened = [];
  appendMarkdown(doc, root,
    "[原文](#page=4) [章节](#section=4.3) [图示](#figure=1) [表格](#table=2) [公式](#equation=10) [无效页](#page=0)",
    (reference) => opened.push(reference), { attachmentID: 42, pdfPath: "/tmp/document.pdf" });
  const links = [];
  const visit = (node) => {
    if (node.tag === "a") links.push(node);
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  assert.equal(links.length, 5);
  for (const link of links) link.listeners.click({ preventDefault() {} });
  assert.deepEqual(opened, [
    { pageNumber: 4 }, { sectionNumber: "4.3" }, { query: "Figure 1" },
    { query: "Table 2" }, { query: "(10)" },
  ]);
  assert.deepEqual(resolvePaperLink("#section=4.3", null), { kind: "text" });
});

test("an original-passage citation carries its physical page and decoded text", () => {
  const doc = documentStub(), root = doc.createElement("div"), opened = [];
  const quote = "This synthetic sentence tests navigation to a quoted passage.";
  appendMarkdown(doc, root, `[原文](#page=4&quote=${encodeURIComponent(quote)})`,
    reference => opened.push(reference), { attachmentID: 42, pdfPath: "/tmp/document.pdf" });
  const links = [];
  const visit = node => { if (node.tag === "a") links.push(node); for (const child of node.children || []) visit(child); };
  visit(root);
  assert.equal(links.length, 1);
  links[0].listeners.click({ preventDefault() {} });
  assert.deepEqual(opened, [{ pageNumber: 4, quote }]);
  for (const target of ["#page=4&quote=%XX", "#page=4&quote=%20", "#page=0&quote=original", "#quote=original"]) {
    assert.deepEqual(resolvePaperLink(target, { attachmentID: 42, pdfPath: "/tmp/document.pdf" }), { kind: "text" });
  }
});

test("Chinese and English references in a reply open the matching PDF target", () => {
  const doc = documentStub();
  const root = doc.createElement("div");
  const opened = [];
  Markdown.appendMarkdown(doc, root, "如图1所示，另见 Table 2 和式(10)。", {
    openPdfReference: (reference) => opened.push(reference),
  });
  const links = [];
  const visit = (node) => {
    if (node.tag === "a") links.push(node);
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  assert.deepEqual(links.map((link) => link.textContent), ["图1", "Table 2", "式(10)"]);
  for (const link of links) link.listeners.click({ preventDefault() {} });
  assert.deepEqual(opened, [
    { query: "Figure 1", label: "图1" },
    { query: "Table 2", label: "Table 2" },
    { query: "(10)", label: "式(10)" },
  ]);
});

test("figure links leave surrounding parentheses outside the clickable label", () => {
  const segments = Markdown.pdfReferenceSegments("示例面板（Fig. 3a），另见 (Fig. 3b) 和式(10)。");
  assert.deepEqual(segments.filter(segment => segment.reference), [
    { text: "Fig. 3a", reference: { query: "Figure 3a" } },
    { text: "Fig. 3b", reference: { query: "Figure 3b" } },
    { text: "式(10)", reference: { query: "(10)" } },
  ]);
  assert.equal(segments.map(segment => segment.text).join(""), "示例面板（Fig. 3a），另见 (Fig. 3b) 和式(10)。");
});

test("a Chinese paraphrase beside a section number jumps to that section", () => {
  const doc = documentStub();
  const root = doc.createElement("div");
  const opened = [];
  Markdown.appendMarkdown(doc, root,
    "第 3 节回答原理，第 4.3 节回答“如何按照示例文档里的步骤完成一次测试操作”。", {
      openPdfReference: (reference) => opened.push(reference),
    });
  const links = [];
  const visit = (node) => {
    if (node.tag === "a") links.push(node);
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  assert.deepEqual(links.map((link) => link.textContent), [
    "第 3 节", "第 4.3 节", "“如何按照示例文档里的步骤完成一次测试操作”",
  ]);
  for (const link of links) link.listeners.click({ preventDefault() {} });
  assert.deepEqual(opened, [
    { sectionNumber: "3", label: "第 3 节" },
    { sectionNumber: "4.3", label: "第 4.3 节" },
    { sectionNumber: "4.3", label: "“如何按照示例文档里的步骤完成一次测试操作”" },
  ]);
  assert.deepEqual(Markdown.pdfReferenceSegments("“这是一段并非 PDF 原文的中文概括，不能假装可以逐字定位”")
    .filter((segment) => segment.reference), []);
});

async function withReader(pdfDocument, action, options = {}) {
  const navigation = [];
  const opened = [];
  const findStates = [];
  const primaryView = {
    initializedPromise: Promise.resolve(),
    _iframeWindow: { PDFViewerApplication: { pdfDocument } },
    _findController: {
      selected: { pageIdx: 0, matchIdx: 0 },
      _pageMatches: Array.from({ length: 10 }, () => []),
      getMatchPositionsAsync: async (pageIndex) => {
        options.requestedPage?.(pageIndex);
        if (options.positionError) throw options.positionError;
        return options.positions || [{ pageIndex: 0, rects: [[40, 100, 100, 120]] }];
      },
    },
    navigateToPosition() { throw new Error("Bypassed Zotero.Reader.navigate"); },
  };
  const internal = {
    _primaryView: primaryView,
    _state: { primaryViewFindState: {} },
    _handleFindStateChange(_primary, state) {
      findStates.push(state);
      options.findState?.(state);
      this._state.primaryViewFindState = {
        ...state, result: { total: options.foundQuery === state.query ? 1 : 0 },
      };
    },
    navigate() { throw new Error("Bypassed Zotero.Reader.navigate"); },
  };
  const reader = {
    _initPromise: Promise.resolve(), _internalReader: internal, _iframeWindow: {},
    navigate(location) { navigation.push(location); },
  };
  const previousZotero = global.Zotero;
  global.Zotero = { Reader: { open: async (id, location) => { opened.push({ id, location }); return reader; } } };
  try {
    const view = Object.assign(Object.create(SidebarView.prototype), {
      context: { attachmentID: 42 },
      showError(error) { throw error; },
    });
    await action(view);
    return { navigation, findStates, opened };
  }
  finally {
    if (previousZotero === undefined) delete global.Zotero;
    else global.Zotero = previousZotero;
  }
}

test("a physical PDF page citation bypasses printed page labels", async () => {
  const { opened } = await withReader({}, (view) => view.openPdfReference({ pageNumber: 4 }));
  assert.deepEqual(opened, [{ id: 42, location: { pageIndex: 3 } }]);
});

test("a valid page jump leaves a PDF error visible until its one-second expiry", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await withReader({}, async view => {
    Object.assign(view, errorStatusView(), { showError: SidebarView.prototype.showError });
    await view.openPdfReference({ query: "Figure 999" });
    assert.equal(view.elements.status.hidden, false);
    assert.match(view.elements.statusText.textContent, /Figure 999/);
    assert.notEqual(view.transientStatusTimer, null);
    await view.openPdfReference({ pageNumber: 4 });
    assert.equal(view.elements.status.hidden, false);
    t.mock.timers.tick(999);
    assert.equal(view.elements.status.hidden, false);
    t.mock.timers.tick(1);
    assert.equal(view.elements.status.hidden, true);
    assert.equal(view.transientStatusTimer, null);
    assert.equal(view.elements.pathStatus.textContent, "");
  });
});

test("clicking an original passage highlights its exact multiline rectangles on the cited page", async () => {
  const quote = "A verified original passage spanning two lines.";
  const position = { pageIndex: 3, rects: [[40, 100, 200, 112], [40, 86, 150, 98]] };
  const { navigation, findStates } = await withReader({ numPages: 10 },
    view => view.openPdfReference({ pageNumber: 4, quote }), {
      foundQuery: quote, positions: [position], requestedPage: page => assert.equal(page, 3),
    });
  assert.deepEqual(navigation, [{ position }]);
  assert.ok(findStates.every(state => state.popupOpen === false));
  assert.equal(findStates.at(-1).active, false);
});

test("an absent or ambiguous original quote never highlights another occurrence", async () => {
  for (const positions of [[], [{ pageIndex: 3 }, { pageIndex: 3 }]]) {
    await assert.rejects(withReader({ numPages: 10 },
      view => view.openPdfReference({ pageNumber: 4, quote: "Original text" }), {
        foundQuery: "Original text", positions, requestedPage: page => assert.equal(page, 3),
      }), positions.length ? /ambiguous/u : /Could not locate quoted text/u);
  }
});

test("a tagged figure jumps to its own bounding box, not a prose mention or Fig. 10", async () => {
  const pdfDocument = {
    numPages: 2,
    async getPage(pageNumber) {
      return { async getStructTree() {
        return { role: "Root", children: [
          { role: "Figure", alt: pageNumber === 1 ? "Fig. 10" : "Fig. 1",
            bbox: pageNumber === 1 ? [10, 20, 30, 40] : [43, 438, 500, 690], children: [] },
        ] };
      } };
    },
  };
  const { navigation, findStates } = await withReader(pdfDocument,
    (view) => view.openPdfReference({ query: "Figure 1", label: "图1" }));
  assert.deepEqual(navigation, [
    { position: { pageIndex: 1, rects: [[43, 438, 500, 690]] } },
  ]);
  assert.deepEqual(findStates, []);
});

test("an untagged figure uses its caption and clears Find", async () => {
  const pdfDocument = {
    numPages: 1,
    async getPage() { return { async getStructTree() { return null; } }; },
  };
  const { navigation, findStates } = await withReader(pdfDocument,
    (view) => view.openPdfReference({ query: "Figure 1", label: "图1" }),
    { foundQuery: "Figure 1:" });
  assert.deepEqual(findStates.filter((state) => state.active).map((state) => state.query), [
    "图 1：", "图1：", "图 1:", "图1:", "Figure 1:",
  ]);
  assert.ok(findStates.every((state) => state.popupOpen === false));
  assert.equal(findStates.at(-1).active, false);
  assert.equal(findStates.at(-1).query, "");
  assert.deepEqual(navigation, [
    { position: { pageIndex: 0, rects: [[40, 100, 100, 120]] } },
  ]);
});

test("native figure links use the caption rather than a punctuated prose mention", async () => {
  const pdfDocument = {
    numPages: 8,
    async getPage() { return { async getStructTree() { return null; } }; },
    async getPageData({ pageIndex }) {
      return { chars: nativeTextLine(pageIndex === 0 ? "Fig. 10 Another figure"
        : pageIndex === 1 ? "Fig. 1 Example diagram"
          : "The components shown in Fig. 1. The next sentence follows.") };
    },
  };
  for (const label of ["Figure 1", "图 1"]) {
    const { navigation, findStates } = await withReader(pdfDocument,
      view => view.openPdfReference({ query: "Figure 1", label }), {
        foundQuery: "Fig. 1.", positions: [{ pageIndex: 7, rects: [[40, 100, 100, 120]] }],
      });
    assert.deepEqual(navigation, [{ position: { pageIndex: 1, rects: [[108, 184, 240, 196]] } }]);
    assert.deepEqual(findStates, []);
  }
});

test("subfigure references fall back to the parent caption without matching another figure", async () => {
  const pdfDocument = {
    numPages: 3,
    async getPage() { return { async getStructTree() { return null; } }; },
    async getPageData({ pageIndex }) {
      return { chars: nativeTextLine([
        "Fig. 30 Other data", "The example is shown in Fig. 3a.", "Fig. 3 Data augmentation",
      ][pageIndex]) };
    },
  };
  for (const query of ["Figure 3a", "Figure 3b"]) {
    const { navigation, findStates } = await withReader(pdfDocument,
      view => view.openPdfReference({ query }));
    assert.equal(navigation[0].position.pageIndex, 2);
    assert.deepEqual(findStates, []);
  }
});

test("an exact subfigure caption takes precedence over the parent structure tag", async () => {
  const pdfDocument = {
    numPages: 2,
    async getPage(pageNumber) { return { async getStructTree() {
      return pageNumber === 1 ? { role: "Figure", alt: "Fig. 3", bbox: [40, 100, 100, 120] } : null;
    } }; },
    async getPageData({ pageIndex }) {
      return { chars: nativeTextLine(pageIndex === 0 ? "Fig. 3 Overview" : "Fig. 3a Detailed view") };
    },
  };
  const { navigation } = await withReader(pdfDocument,
    view => view.openPdfReference({ query: "Figure 3a" }));
  assert.equal(navigation[0].position.pageIndex, 1);
});

test("a subfigure without an exact caption can use the parent structure bounds", async () => {
  const pdfDocument = {
    numPages: 1,
    async getPage() { return { async getStructTree() {
      return { role: "Figure", alt: "Fig. 3", bbox: [40, 100, 100, 120] };
    } }; },
    async getPageData() { return { chars: nativeTextLine("Fig. 3 Data augmentation") }; },
  };
  const { navigation } = await withReader(pdfDocument,
    view => view.openPdfReference({ query: "Figure 3a" }));
  assert.deepEqual(navigation, [{ position: { pageIndex: 0, rects: [[40, 100, 100, 120]] } }]);
});

test("a native document without the requested caption never falls back to prose search", async () => {
  const pdfDocument = {
    numPages: 1,
    async getPage() { return { async getStructTree() { return null; } }; },
    async getPageData() { return { chars: nativeTextLine("The result is in Fig. 1.") }; },
  };
  await assert.rejects(withReader(pdfDocument,
    view => view.openPdfReference({ query: "Figure 1" }), { foundQuery: "Fig. 1." }),
  /Could not locate Figure 1/u);
});

test("repeated figure, table and equation jumps leave no active search highlight", async () => {
  const pdfDocument = {
    numPages: 1,
    async getPage() { return { async getStructTree() { return null; } }; },
  };
  for (const query of ["Figure 1", "Table 2", "(10)"]) {
    const foundQuery = query.startsWith("(") ? query : `${query}:`;
    const { findStates, navigation } = await withReader(pdfDocument, async view => {
      await view.openPdfReference({ query });
      await view.openPdfReference({ query });
    }, { foundQuery });
    assert.equal(navigation.length, 2);
    assert.equal(findStates.filter(state => state.active === false).length, 2);
    assert.equal(findStates.at(-1).query, "");
    assert.ok(findStates.every(state => state.popupOpen === false));
  }
});

test("missing captions and failed position lookups clear their search state", async () => {
  const pdfDocument = {
    numPages: 1,
    async getPage() { return { async getStructTree() { return null; } }; },
  };
  for (const options of [
    {},
    { foundQuery: "Figure 1:", positionError: new Error("Position lookup failed") },
    { foundQuery: "Figure 1:", positions: [] },
  ]) {
    const states = [];
    await assert.rejects(withReader(pdfDocument,
      view => view.openPdfReference({ query: "Figure 1" }), {
        ...options, findState: state => states.push(state),
      }), /Could not locate|Position lookup failed/);
    assert.equal(states.at(-1).active, false);
    assert.equal(states.at(-1).query, "");
    assert.equal(states.at(-1).popupOpen, false);
  }
});

test("a missing figure reports that it cannot be located without opening Find", async () => {
  const pdfDocument = {
    numPages: 1,
    async getPage() { return { async getStructTree() { return null; } }; },
  };
  await assert.rejects(withReader(pdfDocument,
    (view) => view.openPdfReference({ query: "Figure 9", label: "图9" })),
  /Could not locate 图9 in the PDF/);
});

test("a section outline destination uses the public reader navigation boundary", async () => {
  const pdfDocument = {
    numPages: 10,
    async getOutline() {
      return [{ title: "4 APPROACH", dest: "section.4", items: [
        { title: "4.3 Example instructions", dest: "section.4.3", items: [] },
      ] }];
    },
    async getPage() { throw new Error("Outline should locate this section"); },
  };
  const { navigation } = await withReader(pdfDocument,
    (view) => view.openPdfReference({ sectionNumber: "4.3" }));
  assert.deepEqual(navigation, [{ dest: "section.4.3" }]);
});

function nativeTextLine(text, { x = 108, y = 184, size = 12, font = "Fixture-Medi" } = {}) {
  return Array.from(text, (c, index) => ({
    c, u: c, rect: [x + index * 6, y, x + (index + 1) * 6, y + size],
    fontSize: size, fontName: font, baseline: y + 2,
    lineBreakAfter: index === text.length - 1,
  }));
}

test("sections without bookmarks use Zotero page data and skip chart labels", async () => {
  const pdfDocument = {
    numPages: 6,
    async getOutline() { return null; },
    async getPage() { return {}; },
    async getPageData({ pageIndex }) {
      return { chars: pageIndex === 3
        ? nativeTextLine("4 layers", { size: 9, font: "Fixture-Regular" })
        : pageIndex === 5 ? nativeTextLine("4 Example subsection") : [] };
    },
  };
  const { navigation } = await withReader(pdfDocument,
    view => view.openPdfReference({ sectionNumber: "4" }));
  assert.deepEqual(navigation, [{ position: { pageIndex: 5, rects: [[108, 184, 228, 196]] } }]);
});

test("a section with bookmark coordinates centers its heading using PDF metadata", async () => {
  const pdfDocument = {
    numPages: 10,
    async getOutline() { return [{ title: "4.3 Example instructions", dest: "section.4.3" }]; },
    async getDestination(name) {
      assert.equal(name, "section.4.3");
      return [{ num: 235, gen: 0 }, { name: "XYZ" }, 317.955, 215.846, null];
    },
    async getPageIndex(ref) { assert.equal(ref.num, 235); return 3; },
    async getPage() { throw new Error("Bookmark metadata is sufficient"); },
  };
  const { navigation } = await withReader(pdfDocument,
    (view) => view.openPdfReference({ sectionNumber: "4.3" }));
  assert.deepEqual(navigation, [{ position: { pageIndex: 3, rects: [[317.955, 213.846, 318.955, 227.846]] } }]);
});

test("a section heading may end its number with a period without matching a child or sibling", async () => {
  const pdfDocument = {
    numPages: 4,
    async getOutline() { return null; },
    async getPage() { return {}; },
    async getPageData({ pageIndex }) {
      return { chars: nativeTextLine([
        "4.6.10. Other section", "4.6.1.2. Child section",
        "4.6.1. Example instructions", "4.6.2. Next section",
      ][pageIndex]) };
    },
  };
  const { navigation } = await withReader(pdfDocument,
    view => view.openPdfReference({ sectionNumber: "4.6.1" }));
  assert.equal(navigation[0].position.pageIndex, 2);
});

test("a section bookmark may end its number with a period", async () => {
  const pdfDocument = {
    numPages: 4,
    async getOutline() { return [
      { title: "4.6.10. Other section", dest: "wrong-sibling" },
      { title: "4.6.1.2. Child section", dest: "wrong-child" },
      { title: "4.6.1. Example instructions", dest: "section.4.6.1" },
    ]; },
    async getPage() { throw new Error("Bookmark metadata is sufficient"); },
  };
  const { navigation } = await withReader(pdfDocument,
    view => view.openPdfReference({ sectionNumber: "4.6.1" }));
  assert.deepEqual(navigation, [{ dest: "section.4.6.1" }]);
});
