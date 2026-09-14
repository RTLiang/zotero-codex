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
