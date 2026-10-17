const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Markdown = require("../content/markdown.js");
const KaTeX = require("../content/vendor/katex/katex.min.js");

test("parses the Markdown structures used in Codex document explanations", () => {
  const blocks = Markdown.parseBlocks(`
#### 示例项目清单

> 这是一段用于测试引用格式的示例文字。

---

- 1、2、4 个数字
- [x] 允许重叠

| 项目 | 数值 |
| :--- | ---: |
| 示例项目 | 0.91 |
`);

  assert.deepEqual(blocks.map((block) => block.type), [
    "heading", "blockquote", "hr", "list", "table",
  ]);
  assert.equal(blocks[0].level, 4);
  assert.equal(blocks[1].children[0].type, "paragraph");
  assert.equal(blocks[3].items[1].checked, true);
  assert.deepEqual(blocks[4].alignment, ["left", "right"]);
});

test("renders inline emphasis, links, code, and math as typed tokens", () => {
  const tokens = Markdown.parseInlines(
    "**粗体**、*斜体*、~~删除~~、`code`、[document](https://example.com) 与 \\(112 \\times 112\\)",
  );
  assert.deepEqual(tokens.map((token) => token.type), [
    "strong", "text", "em", "text", "del", "text", "code", "text", "link", "text", "math",
  ]);
  assert.equal(tokens.at(-1).text, "112 × 112");
});

test("parses fenced and display math blocks without exposing delimiters", () => {
  const blocks = Markdown.parseBlocks("```js\nconst x = 1;\n```\n\n$$\na \\times b\n$$");
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].language, "js");
  assert.equal(blocks[1].type, "math");
  assert.equal(Markdown.latexToText(blocks[1].text), "a × b");
});

test("keeps escaped Markdown punctuation literal", () => {
  assert.deepEqual(Markdown.parseInlines("\\*literal\\*"), [{ type: "text", text: "*literal*" }]);
});

test("parses named operators and scripted function arguments as structured math", () => {
  const objective = Markdown.parseLatex(String.raw`\min F(x_1;x_2)`);
  assert.equal(objective.children[0].type, "namedOperator");
  assert.equal(objective.children[0].text, "min");
  assert.equal(objective.children[3].type, "script");
  assert.equal(objective.children[3].subscript.text, "1");
  assert.equal(Markdown.latexToText(String.raw`\min F(x_1;x_2)`), "min F(x₁;x₂)");
  assert.equal(
    Markdown.latexToText(String.raw`F(x_1;y)=F(x_2;y)=F(z;y)`),
    "F(x₁;y) = F(x₂;y) = F(z;y)",
  );
});

test("keeps fractions, roots, subscripts, and superscripts structural", () => {
  const formula = Markdown.parseLatex(String.raw`\frac{x_i^2}{\sqrt{n}}`);
  const fraction = formula.children[0];
  assert.equal(fraction.type, "fraction");
  assert.equal(fraction.numerator.children[0].type, "script");
  assert.equal(fraction.denominator.children[0].type, "sqrt");
  assert.equal(Markdown.latexToText(String.raw`\frac{x_i^2}{\sqrt{n}}`), "(xᵢ²)/(√(n))");
});

test("renders degree notation without exposing the circ command", () => {
  for (const latex of [String.raw`90^\circ`, String.raw`120^{\circ}`]) {
    const script = Markdown.parseLatex(latex).children[0];
    assert.equal(script.type, "script");
    assert.equal(script.superscript.type, "operator");
    assert.equal(script.superscript.text, "°");
    assert.equal(Markdown.latexToText(latex), `${script.base.text}°`);
  }
  assert.equal(Markdown.latexToText(String.raw`f \circ g`), "f ∘ g");
  assert.equal(Markdown.parseInlines(String.raw`夹角为 \(90^\circ\)`).at(-1).text, "90°");
});

test("parses common roots, accents, limits, relations, and token sized macro arguments", () => {
  assert.equal(Markdown.latexToText(String.raw`\sqrt[3]{x}`), "3√(x)");
  assert.equal(Markdown.parseLatex(String.raw`\sqrt[3]{x}`).children[0].degree.children[0].text, "3");
  assert.equal(Markdown.parseLatex(String.raw`\vec{x}`).children[0].type, "accent");
  assert.equal(Markdown.latexToText(String.raw`\frac12`), "(1)/(2)");
  assert.equal(Markdown.latexToText(String.raw`\binom{n}{k}`), "(n choose k)");
  assert.equal(Markdown.parseLatex(String.raw`\sum\limits_{i=1}^n`).children[0].base.text, "∑");
  assert.equal(Markdown.latexToText(String.raw`a\leqslant b`), "a ⩽ b");
  assert.equal(Markdown.latexToText(String.raw`\unknown{x}`), String.raw`\unknown{x}`);
  assert.equal(Markdown.latexToText(String.raw`\text{A_BC}+x_ABC`), "A_BC + x₍ABC₎");
  assert.equal(Markdown.normalizeLatex(String.raw`\operatorname{loss_A_BC}`), String.raw`\operatorname{loss_A_BC}`);
});

test("keeps complete display formulas and escaped dollar signs", () => {
  const blocks = Markdown.parseBlocks(String.raw`$$a$$ $$b$$ 后续`);
  assert.deepEqual(blocks.map((block) => block.type), ["math", "math", "paragraph"]);
  assert.deepEqual(blocks.map((block) => block.text), ["a", "b", "后续"]);
  assert.deepEqual(Markdown.parseInlines(String.raw`成本 \$5 与 $x$`).map((token) => token.type), ["text", "math"]);
  assert.equal(Markdown.parseInlines(String.raw`成本 \$5 与 $x$`)[0].text, "成本 $5 与 ");
  assert.equal(Markdown.parseInlines(String.raw`$x\$y$`)[0].latex, String.raw`x\$y`);
  assert.deepEqual(Markdown.parseInlines(String.raw`$$x$$`).map((token) => token.type), ["text"]);
});

test("renders matrix and aligned environments as structured MathML", () => {
  const formula = String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`;
  const environment = Markdown.parseLatex(formula).children[0];
  assert.equal(environment.type, "environment");
  assert.deepEqual(environment.rows.map((row) => row.length), [2, 2]);
  assert.equal(Markdown.latexToText(formula), "(a b; c d)");
  const aligned = [String.raw`\begin{aligned}`, String.raw`a&=b\\`, "c&=d", String.raw`\end{aligned}`].join("\n");
  assert.equal(Markdown.parseBlocks(aligned)[0].type, "math");

  const doc = {
    createElement: (tag) => ({ tag, children: [], append(...nodes) { this.children.push(...nodes); } }),
    createElementNS: (_namespace, tag) => ({
      tag, children: [], attributes: {},
      append(...nodes) { this.children.push(...nodes); },
      setAttribute(name, value) { this.attributes[name] = value; },
    }),
    createTextNode: (value) => ({ tag: "#text", text: value }),
  };
  const root = { children: [], append(node) { this.children.push(node); } };
  Markdown.appendMarkdown(doc, root, String.raw`$$\sqrt[3]{x}+\hat{y}+\begin{pmatrix}a&b\\c&d\end{pmatrix}$$`);
  const tags = [];
  const walk = (node) => {
    tags.push(node.tag);
    for (const child of node.children || []) walk(child);
  };
  walk(root.children[0]);
  for (const tag of ["math", "mroot", "mover", "mtable", "mtr", "mtd"]) assert.ok(tags.includes(tag), tag);
});

test("renders a bare labeled arrow formula with KaTeX", () => {
  const source = [
    "对于 [A,B,C] → D，输入为：",
    String.raw`[E_A,E_B,E_C]\xrightarrow{\mathrm{Example}}h.`,
  ].join("\n");
  const blocks = Markdown.parseBlocks(source);
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "math"]);

  const previousKaTeX = global.katex;
  global.katex = KaTeX;
  try {
    const doc = {
      createElement: (tag) => ({
        tag, className: "", children: [], append(...nodes) { this.children.push(...nodes); },
      }),
      createElementNS: (_namespace, tag) => ({
        tag, children: [], attributes: {},
        append(...nodes) { this.children.push(...nodes); },
        setAttribute(name, value) { this.attributes[name] = value; },
      }),
      createTextNode: (text) => ({ tag: "#text", text }),
    };
    const root = { children: [], append(node) { this.children.push(node); } };
    Markdown.appendMarkdown(doc, root, "$$" + blocks[1].text + "$$");

    const rendered = root.children[0].innerHTML;
    assert.match(rendered, /class="katex"/u);
    assert.match(rendered, /<mover/u);
    assert.match(rendered, /Example/u);
    assert.doesNotMatch(rendered, /katex-error/u);
  }
  finally {
    if (previousKaTeX === undefined) delete global.katex;
    else global.katex = previousKaTeX;
  }
});

test("ships KaTeX with only its referenced WOFF2 font files", () => {
  const fontDirectory = path.join(__dirname, "../content/vendor/katex/fonts");
  const stylesheet = fs.readFileSync(
    path.join(__dirname, "../content/vendor/katex/katex.min.css"),
    "utf8",
  );
  const references = [...stylesheet.matchAll(/url\((?:["']?)(fonts\/[^)'"]+)(?:["']?)\)/gu)]
    .map((match) => match[1].replace(/^fonts\//u, ""));

  assert.ok(references.length > 0);
  assert.ok(references.every((font) => font.endsWith(".woff2")));
  assert.equal(new Set(references).size, 20);
  for (const font of references) assert.ok(fs.existsSync(path.join(fontDirectory, font)), font);
});

test("renders inline and display LaTeX with real KaTeX while preserving surrounding prose", t => {
  const previousKaTeX = global.katex;
  global.katex = KaTeX;
  t.after(() => {
    if (previousKaTeX === undefined) delete global.katex;
    else global.katex = previousKaTeX;
  });
  const doc = {
    createElement: tag => ({
      tag, className: "", children: [], append(...nodes) { this.children.push(...nodes); },
    }),
    createTextNode: text => ({ tag: "#text", text }),
  };
  const cases = [
    { latex: String.raw`r_i=\frac{x_i^2}{\sqrt{m}}`, tags: ["mfrac", "msubsup", "msqrt"] },
    { latex: String.raw`z=\sum_{j=1}^{n}\beta_j`, tags: ["mi", "mo"] },
    { latex: String.raw`\begin{pmatrix}p&q\\r&s\end{pmatrix}`, tags: ["mtable", "mtr", "mtd"] },
    { latex: String.raw`\begin{aligned}u&=v+w\\v&=u-w\end{aligned}`, tags: ["mtable", "mtr", "mtd"] },
  ];
  for (const { latex, tags } of cases) {
    for (const [opening, closing, display] of [["$", "$", false], ["\\(", "\\)", false], ["$$", "$$", true], ["\\[", "\\]", true]]) {
      const root = { children: [], append(...nodes) { this.children.push(...nodes); } };
      const source = display ? `前文。\n\n${opening}\n${latex}\n${closing}\n\n后文。`
        : `前文。${opening}${latex}${closing}后文。`;
      Markdown.appendMarkdown(doc, root, source);
      const nodes = [];
      const walk = node => { nodes.push(node); for (const child of node.children || []) walk(child); };
      walk(root);
      const math = nodes.filter(node => node.className === (display ? "zcs-display-math" : "zcs-inline-math"));
      assert.equal(math.length, 1, source);
      assert.equal(math[0].tag, display ? "div" : "span");
      assert.match(math[0].innerHTML, /class="katex"/u);
      assert.equal(math[0].innerHTML.includes('class="katex-display"'), display);
      assert.doesNotMatch(math[0].innerHTML, /katex-error/u);
      for (const tag of tags) assert.match(math[0].innerHTML, new RegExp(`<${tag}(?:[ >])`, "u"));
      assert.equal(nodes.filter(node => node.tag === "#text").map(node => node.text).join(""), "前文。后文。");
    }
  }
});

test("keeps delimited inline math inside paragraphs, lists, headings and quotations", () => {
  const formulas = [String.raw`$r_i=\frac{x_i^2}{\sqrt{m}}$`, String.raw`\(r_i=\frac{x_i^2}{\sqrt{m}}\)`];
  for (const formula of formulas) {
    for (const [source, type] of [
      [formula, "paragraph"],
      [`Before ${formula} after.`, "paragraph"],
      [`1. ${formula}`, "list"],
      [`- ${formula}`, "list"],
      [`## ${formula}`, "heading"],
      [`> ${formula}`, "blockquote"],
    ]) {
      const blocks = Markdown.parseBlocks(source);
      assert.equal(blocks[0].type, type, source);
      const block = type === "blockquote" ? blocks[0].children[0] : blocks[0];
      const text = type === "list" ? block.items[0].text : block.text;
      const inline = Markdown.parseInlines(text);
      assert.equal(inline.filter(token => token.type === "math").length, 1, source);
      assert.equal(inline.find(token => token.type === "math").latex, String.raw`r_i=\frac{x_i^2}{\sqrt{m}}`);
    }
  }
  const numbered = Markdown.parseBlocks(String.raw`1. $r_i=\frac{x_i^2}{\sqrt{m}}$，$\alpha_i+\beta_j$`);
  assert.equal(numbered[0].type, "list");
  assert.equal(Markdown.parseInlines(numbered[0].items[0].text).filter(token => token.type === "math").length, 2);
});

test("renders bare model-generated LaTeX and repairs common missing braces", () => {
  const blocks = Markdown.parseBlocks(String.raw`示例表达式如下：

\mathcalQ_ABC = \mathbbE[ \log \frac{\exp x_1 + 2} {\sum_j=1^K (x_j + 1)} ]

并且有：

x_1 + x_2 ≥ K-\mathcalQ_ABC`);

  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "math", "paragraph", "math"]);
  assert.equal(blocks[1].inferred, true);
  assert.match(blocks[1].text, /^\\mathcal\{Q\}_\{ABC\}/u);
  assert.match(blocks[1].text, /\\mathbb\{E\}/u);
  assert.match(blocks[1].text, /\\sum\{j=1\}\^\{K\}/u);
  assert.match(Markdown.latexToText(blocks[1].text), /^Q₍ABC₎ = E\[/u);

  const styled = Markdown.parseLatex(String.raw`\mathcalQ_ABC`).children[0];
  assert.equal(styled.type, "script");
  assert.equal(styled.base.type, "style");
  assert.equal(styled.base.variant, "script");
  assert.equal(Markdown.latexToText(String.raw`\mathcalQ_ABC`), "Q₍ABC₎");
});

test("does not mistake ordinary backslash text for display math", () => {
  const blocks = Markdown.parseBlocks(String.raw`Use C:\Users\name and \path for this file.`);
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph"]);
  assert.equal(Markdown.parseBlocks(String.raw`结果是 \alpha + \beta`)[0].type, "paragraph");
  assert.equal(Markdown.parseBlocks(String.raw`\alpha + \beta`)[0].type, "math");
});
