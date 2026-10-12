const test = require("node:test");
const assert = require("node:assert/strict");
const Markdown = require("../content/markdown.js");

global.ZoteroCodexModules = {
  Protocol: require("../content/protocol.js"), CodexClient: {}, Markdown,
};
require("../content/localization.js");
require("../content/sidebar.js");
const { SidebarView, resolvePaperLink, appendMarkdown } = global.ZoteroCodexModules.Sidebar;

test("same-paper links use explicit PDF locations and do not invent a page-one target", () => {
  const context = {
    attachmentID: 42,
    pdfPath: "/tmp/paper.pdf",
    url: "https://arxiv.org/abs/2008.07873",
  };
  assert.deepEqual(resolvePaperLink("https://arxiv.org/html/2008.07873#S4", context,
    "论文第 4 节"), { kind: "pdf", reference: { sectionNumber: "4" } });
  assert.deepEqual(resolvePaperLink("https://arxiv.org/html/2008.07873", context,
    "论文方法部分"), { kind: "pdf", reference: { sectionTitle: "method" } });
  assert.deepEqual(resolvePaperLink("https://arxiv.org/html/2008.07873", context,
    "更多信息"), { kind: "text" });
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

test("harness citation targets navigate by their explicit locator regardless of label", () => {
  const doc = documentStub();
  const root = doc.createElement("div");
  const opened = [];
  appendMarkdown(doc, root,
    "[原文](#page=4) [方法出处](#section=4.3) [模型结构](#figure=1) [实验结果](#table=2) [目标函数](#equation=10) [无效页](#page=0)",
    (reference) => opened.push(reference), { attachmentID: 42, pdfPath: "/tmp/paper.pdf" });
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
  const quote = "We adopt a pre-training way to construct different loss functions.";
  appendMarkdown(doc, root, `[原文](#page=4&quote=${encodeURIComponent(quote)})`,
    reference => opened.push(reference), { attachmentID: 42, pdfPath: "/tmp/paper.pdf" });
  const links = [];
  const visit = node => { if (node.tag === "a") links.push(node); for (const child of node.children || []) visit(child); };
  visit(root);
  assert.equal(links.length, 1);
  links[0].listeners.click({ preventDefault() {} });
  assert.deepEqual(opened, [{ pageNumber: 4, quote }]);
  for (const target of ["#page=4&quote=%XX", "#page=4&quote=%20", "#page=0&quote=original", "#quote=original"]) {
    assert.deepEqual(resolvePaperLink(target, { attachmentID: 42, pdfPath: "/tmp/paper.pdf" }), { kind: "text" });
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

test("a Chinese paraphrase beside a section number jumps to that section", () => {
  const doc = documentStub();
  const root = doc.createElement("div");
  const opened = [];
  Markdown.appendMarkdown(doc, root,
    "第 3 节回答原理，第 4.3 节回答“如何把它用于 S³-Rec 的四种关联学习”。", {
      openPdfReference: (reference) => opened.push(reference),
    });
  const links = [];
  const visit = (node) => {
    if (node.tag === "a") links.push(node);
    for (const child of node.children || []) visit(child);
  };
  visit(root);
  assert.deepEqual(links.map((link) => link.textContent), [
    "第 3 节", "第 4.3 节", "“如何把它用于 S³-Rec 的四种关联学习”",
  ]);
  for (const link of links) link.listeners.click({ preventDefault() {} });
  assert.deepEqual(opened, [
    { sectionNumber: "3", label: "第 3 节" },
    { sectionNumber: "4.3", label: "第 4.3 节" },
    { sectionNumber: "4.3", label: "“如何把它用于 S³-Rec 的四种关联学习”" },
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

test("an untagged figure uses its caption and leaves the Find popup closed", async () => {
  const pdfDocument = {
    numPages: 1,
    async getPage() { return { async getStructTree() { return null; } }; },
  };
  const { navigation, findStates } = await withReader(pdfDocument,
    (view) => view.openPdfReference({ query: "Figure 1", label: "图1" }),
    { foundQuery: "Figure 1:" });
  assert.deepEqual(findStates.map((state) => state.query), [
    "图 1：", "图1：", "图 1:", "图1:", "Figure 1:",
  ]);
  assert.deepEqual(findStates.map((state) => state.popupOpen), [false, false, false, false, false]);
  assert.deepEqual(navigation, [
    { position: { pageIndex: 0, rects: [[40, 100, 100, 120]] } },
  ]);
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
        { title: "4.3 Self-supervised Learning with MIM", dest: "section.4.3", items: [] },
      ] }];
    },
    async getPage() { throw new Error("Outline should locate this section"); },
  };
  const { navigation } = await withReader(pdfDocument,
    (view) => view.openPdfReference({ sectionNumber: "4.3" }));
  assert.deepEqual(navigation, [{ dest: "section.4.3" }]);
});

test("a section with bookmark coordinates centers its heading using PDF metadata", async () => {
  const pdfDocument = {
    numPages: 10,
    async getOutline() { return [{ title: "4.3 Self-supervised Learning with MIM", dest: "section.4.3" }]; },
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
