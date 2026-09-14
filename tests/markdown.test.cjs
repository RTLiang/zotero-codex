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
