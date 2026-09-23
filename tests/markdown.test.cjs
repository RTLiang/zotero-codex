const test = require("node:test");
const assert = require("node:assert/strict");
const Markdown = require("../content/markdown.js");

test("parses the Markdown structures used in Codex paper explanations", () => {
  const blocks = Markdown.parseBlocks(`
#### MultiDigits 数据集

> SimCLR 比较的是整张图像的全局表示。

---

- 1、2、4 个数字
- [x] 允许重叠

| 方法 | 结果 |
| :--- | ---: |
| SimCLR | 0.91 |
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
    "**粗体**、*斜体*、~~删除~~、`code`、[paper](https://example.com) 与 \\(112 \\times 112\\)",
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

test("parses the reported InfoMin formulas as structured math", () => {
  const objective = Markdown.parseLatex(String.raw`\min I(v_1;v_2)`);
  assert.equal(objective.children[0].type, "namedOperator");
  assert.equal(objective.children[0].text, "min");
  assert.equal(objective.children[3].type, "script");
  assert.equal(objective.children[3].subscript.text, "1");
  assert.equal(Markdown.latexToText(String.raw`\min I(v_1;v_2)`), "min I(v₁;v₂)");
  assert.equal(
    Markdown.latexToText(String.raw`I(v_1;y)=I(v_2;y)=I(x;y)`),
    "I(v₁;y) = I(v₂;y) = I(x;y)",
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
  assert.equal(Markdown.latexToText(String.raw`\text{A_BC}+x_NCE`), "A_BC + x₍NCE₎");
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

test("renders bare model-generated LaTeX and repairs common missing braces", () => {
  const blocks = Markdown.parseBlocks(String.raw`论文提出的损失是：

\mathcalL_NCE = -\mathbbE[ \log \frac{\exp h(v_1,i,v_2,i)} {\sum_j=1^K\exp h(v_1,i,v_2,j)} ]

并且有：

I(v_1;v_2) ≥ \log K-\mathcalL_NCE`);

  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "math", "paragraph", "math"]);
  assert.equal(blocks[1].inferred, true);
  assert.match(blocks[1].text, /^\\mathcal\{L\}_\{NCE\}/u);
  assert.match(blocks[1].text, /\\mathbb\{E\}/u);
  assert.match(blocks[1].text, /\\sum\{j=1\}\^\{K\}/u);
  assert.match(Markdown.latexToText(blocks[1].text), /^L₍NCE₎ = - E\[/u);

  const styled = Markdown.parseLatex(String.raw`\mathcalL_NCE`).children[0];
  assert.equal(styled.type, "script");
  assert.equal(styled.base.type, "style");
  assert.equal(styled.base.variant, "script");
  assert.equal(Markdown.latexToText(String.raw`\mathcalL_NCE`), "L₍NCE₎");
});

test("does not mistake ordinary backslash text for display math", () => {
  const blocks = Markdown.parseBlocks(String.raw`Use C:\Users\name and \path for this file.`);
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph"]);
  assert.equal(Markdown.parseBlocks(String.raw`结果是 \alpha + \beta`)[0].type, "paragraph");
  assert.equal(Markdown.parseBlocks(String.raw`\alpha + \beta`)[0].type, "math");
});
