(function (global) {
  "use strict";

  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};

  function normalizeSource(value) {
    return String(value || "").replace(/\r\n?/gu, "\n");
  }

  function splitTableRow(value) {
    let source = String(value || "").trim();
    if (source.startsWith("|")) source = source.slice(1);
    if (source.endsWith("|") && !source.endsWith("\\|")) source = source.slice(0, -1);
    const cells = [];
    let cell = "";
    let escaped = false;
    let inCode = false;
    for (const character of source) {
      if (escaped) {
        cell += character;
        escaped = false;
      }
      else if (character === "\\") {
        cell += character;
        escaped = true;
      }
      else if (character === "`") {
        cell += character;
        inCode = !inCode;
      }
      else if (character === "|" && !inCode) {
        cells.push(cell.trim());
        cell = "";
      }
      else {
        cell += character;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function tableAlignmentRow(value) {
    const cells = splitTableRow(value);
    if (cells.length < 2 || cells.some((cell) => !/^:?-{3,}:?$/u.test(cell))) return null;
    return cells.map((cell) => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      return "left";
    });
  }

  function isHorizontalRule(value) {
    return /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/u.test(value);
  }

  function isBlockStart(lines, index) {
    const line = lines[index] || "";
    if (!line.trim()) return true;
    if (/^ {0,3}(?:`{3,}|~{3,})/u.test(line)) return true;
    if (/^ {0,3}#{1,6}(?:\s+|$)/u.test(line)) return true;
    if (/^ {0,3}>/u.test(line)) return true;
    if (/^ {0,3}(?:[-+*]|\d+[.)])\s+/u.test(line)) return true;
    if (/^\s*(?:\$\$|\\\[)/u.test(line)) return true;
    if (isHorizontalRule(line)) return true;
    return Boolean(line.includes("|") && tableAlignmentRow(lines[index + 1] || ""));
  }

  function parseBlocks(value) {
    const lines = normalizeSource(value).split("\n");
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index++;
        continue;
      }

      const fence = line.match(/^ {0,3}(`{3,}|~{3,})\s*([^`]*)$/u);
      if (fence) {
        const marker = fence[1][0];
        const minimum = fence[1].length;
        const content = [];
        index++;
        while (index < lines.length && !new RegExp(`^ {0,3}${marker}{${minimum},}\\s*$`, "u").test(lines[index])) {
          content.push(lines[index]);
          index++;
        }
        if (index < lines.length) index++;
        blocks.push({ type: "code", language: fence[2].trim(), text: content.join("\n") });
        continue;
      }

      const displayMath = line.match(/^\s*(\$\$|\\\[)\s*(.*)$/u);
      if (displayMath) {
        const closing = displayMath[1] === "$$" ? "$$" : "\\]";
        const content = [];
        let remainder = displayMath[2];
        const sameLineEnd = remainder.lastIndexOf(closing);
        if (sameLineEnd >= 0) {
          content.push(remainder.slice(0, sameLineEnd));
          index++;
        }
        else {
          if (remainder) content.push(remainder);
          index++;
          while (index < lines.length) {
            remainder = lines[index];
            const end = remainder.indexOf(closing);
            if (end >= 0) {
              content.push(remainder.slice(0, end));
              index++;
              break;
            }
            content.push(remainder);
            index++;
          }
        }
        blocks.push({ type: "math", text: content.join("\n").trim() });
        continue;
      }

      const heading = line.match(/^ {0,3}(#{1,6})(?:\s+(.+?)\s*#*\s*|\s*)$/u);
      if (heading) {
        blocks.push({ type: "heading", level: heading[1].length, text: heading[2] || "" });
        index++;
        continue;
      }

      if (index + 1 < lines.length && line.trim() && /^ {0,3}(?:=+|-+)\s*$/u.test(lines[index + 1])) {
        blocks.push({
          type: "heading",
          level: lines[index + 1].trim().startsWith("=") ? 1 : 2,
          text: line.trim(),
        });
        index += 2;
        continue;
      }

      if (isHorizontalRule(line)) {
        blocks.push({ type: "hr" });
        index++;
        continue;
      }

      if (/^ {0,3}>/u.test(line)) {
        const quote = [];
        while (index < lines.length) {
          const match = lines[index].match(/^ {0,3}>\s?(.*)$/u);
          if (!match) break;
          quote.push(match[1]);
          index++;
        }
        blocks.push({ type: "blockquote", children: parseBlocks(quote.join("\n")) });
        continue;
      }

      const alignment = tableAlignmentRow(lines[index + 1] || "");
      if (line.includes("|") && alignment) {
        const header = splitTableRow(line);
        const rows = [];
        index += 2;
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
          rows.push(splitTableRow(lines[index]));
          index++;
        }
        blocks.push({ type: "table", header, alignment, rows });
        continue;
      }

      const listStart = line.match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/u);
      if (listStart) {
        const ordered = /^\d/u.test(listStart[1]);
        const start = ordered ? Number.parseInt(listStart[1], 10) : 1;
        const items = [];
        while (index < lines.length) {
          const item = lines[index].match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/u);
          if (!item || /^\d/u.test(item[1]) !== ordered) break;
          let text = item[2];
          index++;
          while (index < lines.length && /^ {2,}\S/u.test(lines[index]) && !isBlockStart(lines, index)) {
            text += `\n${lines[index].trim()}`;
            index++;
          }
          const task = text.match(/^\[([ xX])\]\s+(.+)$/u);
          items.push(task
            ? { text: task[2], checked: task[1].toLowerCase() === "x" }
            : { text, checked: null });
        }
        blocks.push({ type: "list", ordered, start, items });
        continue;
      }

      const paragraph = [line];
      index++;
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
        paragraph.push(lines[index]);
        index++;
      }
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    }

    return blocks;
  }

  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const LATEX_SYMBOLS = new Map(Object.entries({
    times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤",
    ge: "≥", geq: "≥", neq: "≠", approx: "≈", sim: "∼", simeq: "≃",
    equiv: "≡", propto: "∝", in: "∈", notin: "∉", subset: "⊂", supset: "⊃",
    subseteq: "⊆", supseteq: "⊇", cup: "∪", cap: "∩", emptyset: "∅",
    infty: "∞", partial: "∂", nabla: "∇", forall: "∀", exists: "∃",
    to: "→", mapsto: "↦", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔",
    Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔",
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
    zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
    lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο", pi: "π", varpi: "ϖ",
    rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ",
    phi: "φ", varphi: "ϕ", chi: "χ", psi: "ψ", omega: "ω",
    Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
    Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
    ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱",
  }));
  const LATEX_NAMED_OPERATORS = new Set([
    "min", "max", "argmin", "argmax", "lim", "sup", "inf", "log", "ln", "exp",
    "sin", "cos", "tan", "arcsin", "arccos", "arctan", "det", "dim", "gcd",
  ]);
  const LATEX_LARGE_OPERATORS = new Map(Object.entries({
    sum: "∑", prod: "∏", coprod: "∐", int: "∫", iint: "∬", iiint: "∭", oint: "∮",
  }));
  const BINARY_MATH_OPERATORS = new Set([
    "+", "-", "*", "/", "=", "×", "·", "÷", "±", "∓", "≤", "≥", "≠", "≈", "≃",
    "≡", "∝", "∈", "∉", "⊂", "⊃", "⊆", "⊇", "∪", "∩", "→", "↦", "←", "↔",
    "⇒", "⇐", "⇔",
  ]);
  const LATEX_VARIANTS = new Map(Object.entries({
    mathrm: "normal", mathbf: "bold", mathit: "italic", mathbb: "double-struck",
    mathsf: "sans-serif", mathtt: "monospace",
  }));
  const SUBSCRIPT_CHARACTERS = new Map(Object.entries({
    0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ",
    i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ",
    s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
  }));
  const SUPERSCRIPT_CHARACTERS = new Map(Object.entries({
    0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
    "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
  }));

  function parseLatex(value) {
    const source = String(value || "");
    let index = 0;

    const skipSpaces = () => {
      while (/\s/u.test(source[index] || "")) index++;
    };

    const parseRawGroup = () => {
      skipSpaces();
      if (source[index] !== "{") return "";
      index++;
      let depth = 1;
      let text = "";
      while (index < source.length && depth > 0) {
        const character = source[index++];
        if (character === "{") depth++;
        else if (character === "}") depth--;
        if (depth > 0) text += character;
      }
      return text;
    };

    const parseGroup = () => {
      skipSpaces();
      if (source[index] !== "{") return parseAtom();
      index++;
      const group = parseSequence("}");
      if (source[index] === "}") index++;
      return group;
    };

    const parseCommand = () => {
      index++;
      const start = index;
      while (/[A-Za-z]/u.test(source[index] || "")) index++;
      const name = source.slice(start, index) || source[index++] || "";
      if (name === "left" || name === "right") {
        skipSpaces();
        return parseAtom();
      }
      if (["frac", "dfrac", "tfrac"].includes(name)) {
        return { type: "fraction", numerator: parseGroup(), denominator: parseGroup() };
      }
      if (name === "sqrt") return { type: "sqrt", body: parseGroup() };
      if (name === "text" || name === "operatorname") {
        return { type: name === "text" ? "text" : "namedOperator", text: parseRawGroup() };
      }
      if (LATEX_VARIANTS.has(name)) {
        return { type: "style", variant: LATEX_VARIANTS.get(name), body: parseGroup() };
      }
      if (LATEX_NAMED_OPERATORS.has(name)) return { type: "namedOperator", text: name };
      if (LATEX_LARGE_OPERATORS.has(name)) {
        return { type: "operator", text: LATEX_LARGE_OPERATORS.get(name), large: true };
      }
      if (LATEX_SYMBOLS.has(name)) {
        const text = LATEX_SYMBOLS.get(name);
        return /[α-ωΑ-Ωϑϕϖϱς]/u.test(text)
          ? { type: "identifier", text }
          : { type: "operator", text };
      }
      if ([",", ";", ":", "!", "quad", "qquad", " "].includes(name)) {
        const width = name === "qquad" ? "2em" : name === "quad" ? "1em" : ".28em";
        return { type: "space", width };
      }
      return { type: "identifier", text: name };
    };

    function parseAtom() {
      skipSpaces();
      const character = source[index];
      if (!character) return { type: "row", children: [] };
      if (character === "{") return parseGroup();
      if (character === "\\") return parseCommand();
      if (/\d/u.test(character)) {
        const start = index++;
        while (/[\d.]/u.test(source[index] || "")) index++;
        return { type: "number", text: source.slice(start, index) };
      }
      index++;
      if (/[A-Za-z]/u.test(character)) return { type: "identifier", text: character };
      if (/[,;:=+\-*/<>()[\]|]/u.test(character)) return { type: "operator", text: character };
      return { type: "identifier", text: character };
    }

    function parseSequence(stop = "") {
      const children = [];
      while (index < source.length && (!stop || source[index] !== stop)) {
        skipSpaces();
        if (index >= source.length || (stop && source[index] === stop)) break;
        let base = parseAtom();
        let subscript = null;
        let superscript = null;
        while (source[index] === "_" || source[index] === "^") {
          const marker = source[index++];
          const script = parseGroup();
          if (marker === "_") subscript = script;
          else superscript = script;
        }
        if (subscript || superscript) {
          base = { type: "script", base, subscript, superscript };
        }
        children.push(base);
      }
      return { type: "row", children };
    }

    return parseSequence();
  }

  function latexAstToText(node) {
    if (!node) return "";
    if (node.type === "row") return node.children.map(latexAstToText).join("");
    if (["identifier", "number", "text"].includes(node.type)) return node.text;
    if (node.type === "operator") {
      return BINARY_MATH_OPERATORS.has(node.text) ? ` ${node.text} ` : node.text;
    }
    if (node.type === "namedOperator") return `${node.text} `;
    if (node.type === "space") return " ";
    if (node.type === "style") return latexAstToText(node.body);
    if (node.type === "fraction") {
      return `(${latexAstToText(node.numerator)})/(${latexAstToText(node.denominator)})`;
    }
    if (node.type === "sqrt") return `√(${latexAstToText(node.body)})`;
    if (node.type === "script") {
      const convert = (script, characters, marker) => {
        const text = latexAstToText(script);
        const converted = [...text].map((character) => characters.get(character) || "").join("");
        return converted.length === text.length ? converted : `${marker}(${text})`;
      };
      return [
        latexAstToText(node.base),
        node.subscript ? convert(node.subscript, SUBSCRIPT_CHARACTERS, "₍") : "",
        node.superscript ? convert(node.superscript, SUPERSCRIPT_CHARACTERS, "⁽") : "",
      ].join("");
    }
    return "";
  }

  function latexToText(value) {
    return latexAstToText(parseLatex(value)).replace(/\s+/gu, " ").trim();
  }

  function pushText(tokens, value) {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    if (last?.type === "text") last.text += value;
    else tokens.push({ type: "text", text: value });
  }

  function parseInlines(value) {
    const source = String(value || "");
    const tokens = [];
    let index = 0;

    while (index < source.length) {
      if (source.startsWith("\\(", index)) {
        const end = source.indexOf("\\)", index + 2);
        if (end > index + 2) {
          const latex = source.slice(index + 2, end);
          tokens.push({ type: "math", latex, text: latexToText(latex) });
          index = end + 2;
          continue;
        }
      }

      if (source[index] === "$" && source[index + 1] !== "$" && !/\s/u.test(source[index + 1] || "")) {
        const end = source.indexOf("$", index + 1);
        if (end > index + 1 && !/\s/u.test(source[end - 1])) {
          const latex = source.slice(index + 1, end);
          tokens.push({ type: "math", latex, text: latexToText(latex) });
          index = end + 1;
          continue;
        }
      }

      if (source[index] === "`" && source[index + 1] !== "`") {
        const end = source.indexOf("`", index + 1);
        if (end > index + 1) {
          tokens.push({ type: "code", text: source.slice(index + 1, end) });
          index = end + 1;
          continue;
        }
      }

      const pairs = [
        ["**", "strong"], ["__", "strong"], ["~~", "del"], ["*", "em"], ["_", "em"],
      ];
      let paired = false;
      for (const [delimiter, type] of pairs) {
        if (!source.startsWith(delimiter, index)) continue;
        const end = source.indexOf(delimiter, index + delimiter.length);
        if (end <= index + delimiter.length) continue;
        tokens.push({
          type,
          children: parseInlines(source.slice(index + delimiter.length, end)),
        });
        index = end + delimiter.length;
        paired = true;
        break;
      }
      if (paired) continue;

      if (source[index] === "[") {
        const link = source.slice(index).match(/^\[([^\]]+)\]\((?:<([^>\n]+)>|([^\s)]+))(?:\s+["']([^"']+)["'])?\)/u);
        if (link) {
          tokens.push({
            type: "link",
            target: link[2] || link[3],
            title: link[4] || "",
            children: parseInlines(link[1]),
          });
          index += link[0].length;
          continue;
        }
      }

      if (source[index] === "<") {
        const autoLink = source.slice(index).match(/^<(https?:\/\/[^>\s]+)>/iu);
        if (autoLink) {
          tokens.push({ type: "link", target: autoLink[1], children: [{ type: "text", text: autoLink[1] }] });
          index += autoLink[0].length;
          continue;
        }
      }

      if (/^https?:\/\//iu.test(source.slice(index))) {
        const url = source.slice(index).match(/^https?:\/\/[^\s<]+[^\s<.,;:!?\])}]/iu)?.[0];
        if (url) {
          tokens.push({ type: "link", target: url, children: [{ type: "text", text: url }] });
          index += url.length;
          continue;
        }
      }

      if (source[index] === "\n") {
        const hard = source.slice(Math.max(0, index - 2), index) === "  " || source[index - 1] === "\\";
        if (hard) {
          const last = tokens[tokens.length - 1];
          if (last?.type === "text") last.text = last.text.replace(/[ \\]+$/u, "");
          tokens.push({ type: "break" });
        }
        else {
          pushText(tokens, " ");
        }
        index++;
        continue;
      }

      if (source[index] === "\\" && /[\\`*{}\[\]()#+.!_>~-]/u.test(source[index + 1] || "")) {
        pushText(tokens, source[index + 1]);
        index += 2;
        continue;
      }

      let end = index + 1;
      while (end < source.length && !"\\`*_~[<!$\n".includes(source[end])) end++;
      pushText(tokens, source.slice(index, end));
      index = end;
    }

    return tokens;
  }

  function create(doc, tag, className = "", text = null) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function createMathML(doc, tag, text = null) {
    const node = doc.createElementNS(MATHML_NAMESPACE, tag);
    if (text != null) node.textContent = text;
    return node;
  }

  function renderMathNode(doc, node) {
    if (!node || node.type === "row") {
      const row = createMathML(doc, "mrow");
      for (const child of node?.children || []) row.append(renderMathNode(doc, child));
      return row;
    }
    if (node.type === "identifier") return createMathML(doc, "mi", node.text);
    if (node.type === "number") return createMathML(doc, "mn", node.text);
    if (node.type === "text") return createMathML(doc, "mtext", node.text);
    if (node.type === "namedOperator") {
      const operator = createMathML(doc, "mo", node.text);
      operator.setAttribute("form", "prefix");
      return operator;
    }
    if (node.type === "operator") {
      const operator = createMathML(doc, "mo", node.text);
      if (node.large) {
        operator.setAttribute("largeop", "true");
        operator.setAttribute("movablelimits", "true");
      }
      return operator;
    }
    if (node.type === "space") {
      const space = createMathML(doc, "mspace");
      space.setAttribute("width", node.width || ".28em");
      return space;
    }
    if (node.type === "style") {
      const style = createMathML(doc, "mstyle");
      style.setAttribute("mathvariant", node.variant);
      style.append(renderMathNode(doc, node.body));
      return style;
    }
    if (node.type === "fraction") {
      const fraction = createMathML(doc, "mfrac");
      fraction.append(renderMathNode(doc, node.numerator), renderMathNode(doc, node.denominator));
      return fraction;
    }
    if (node.type === "sqrt") {
      const root = createMathML(doc, "msqrt");
      root.append(renderMathNode(doc, node.body));
      return root;
    }
    if (node.type === "script") {
      const tag = node.subscript && node.superscript
        ? "msubsup"
        : node.subscript ? "msub" : "msup";
      const script = createMathML(doc, tag);
      script.append(renderMathNode(doc, node.base));
      if (node.subscript) script.append(renderMathNode(doc, node.subscript));
      if (node.superscript) script.append(renderMathNode(doc, node.superscript));
      return script;
    }
    return createMathML(doc, "mtext", "");
  }

  function createRenderedMath(doc, latex, display = false) {
    const wrapper = create(doc, display ? "div" : "span", display ? "zcs-display-math" : "zcs-inline-math");
    const math = createMathML(doc, "math");
    math.setAttribute("display", display ? "block" : "inline");
    math.setAttribute("aria-label", latexToText(latex));
    math.append(renderMathNode(doc, parseLatex(latex)));
    wrapper.append(math);
    return wrapper;
  }

  function appendInlineTokens(doc, parent, tokens, options) {
    for (const token of tokens) {
      if (token.type === "text") parent.append(doc.createTextNode(token.text));
      else if (token.type === "break") parent.append(doc.createElement("br"));
      else if (token.type === "code") parent.append(create(doc, "code", "zcs-inline-code", token.text));
      else if (token.type === "math") parent.append(createRenderedMath(doc, token.latex || token.text));
      else if (["strong", "em", "del"].includes(token.type)) {
        const node = create(doc, token.type);
        appendInlineTokens(doc, node, token.children, options);
        parent.append(node);
      }
      else if (token.type === "link") {
        const link = create(doc, "a", "zcs-link");
        const target = String(token.target || "");
        link.href = /^https?:\/\//iu.test(target) ? target : "#";
        link.title = token.title || target;
        if (target.startsWith("/") || /^file:\/\//iu.test(target)) link.classList.add("zcs-local-link");
        link.addEventListener("click", (event) => {
          event.preventDefault();
          options.openTarget?.(target);
        });
        appendInlineTokens(doc, link, token.children, options);
        parent.append(link);
      }
    }
  }

  function appendInlines(doc, parent, value, options) {
    appendInlineTokens(doc, parent, parseInlines(value), options);
  }

  function appendBlocks(doc, parent, blocks, options) {
    for (const block of blocks) {
      if (block.type === "paragraph") {
        const paragraph = create(doc, "p", "zcs-markdown-paragraph");
        appendInlines(doc, paragraph, block.text, options);
        parent.append(paragraph);
      }
      else if (block.type === "heading") {
        const heading = create(doc, `h${block.level}`, "zcs-markdown-heading");
        heading.dataset.level = String(block.level);
        appendInlines(doc, heading, block.text, options);
        parent.append(heading);
      }
      else if (block.type === "hr") {
        parent.append(create(doc, "hr", "zcs-markdown-rule"));
      }
      else if (block.type === "blockquote") {
        const quote = create(doc, "blockquote", "zcs-markdown-quote");
        appendBlocks(doc, quote, block.children, options);
        parent.append(quote);
      }
      else if (block.type === "code") {
        const wrapper = create(doc, "div", "zcs-code-block");
        if (block.language) wrapper.append(create(doc, "div", "zcs-code-language", block.language));
        const pre = create(doc, "pre");
        pre.append(create(doc, "code", "", block.text));
        wrapper.append(pre);
        parent.append(wrapper);
      }
      else if (block.type === "math") {
        parent.append(createRenderedMath(doc, block.text, true));
      }
      else if (block.type === "list") {
        const list = create(doc, block.ordered ? "ol" : "ul", "zcs-markdown-list");
        if (block.ordered && block.start !== 1) list.start = block.start;
        for (const entry of block.items) {
          const item = create(doc, "li", entry.checked == null ? "" : "zcs-task-item");
          if (entry.checked != null) {
            const checkbox = create(doc, "input", "zcs-task-checkbox");
            checkbox.type = "checkbox";
            checkbox.checked = entry.checked;
            checkbox.disabled = true;
            item.append(checkbox);
          }
          appendInlines(doc, item, entry.text, options);
          list.append(item);
        }
        parent.append(list);
      }
      else if (block.type === "table") {
        const wrapper = create(doc, "div", "zcs-table-wrap");
        const table = create(doc, "table", "zcs-markdown-table");
        const head = create(doc, "thead");
        const headRow = create(doc, "tr");
        block.header.forEach((cell, index) => {
          const node = create(doc, "th");
          node.style.textAlign = block.alignment[index] || "left";
          appendInlines(doc, node, cell, options);
          headRow.append(node);
        });
        head.append(headRow);
        const body = create(doc, "tbody");
        for (const row of block.rows) {
          const tableRow = create(doc, "tr");
          block.header.forEach((_cell, index) => {
            const node = create(doc, "td");
            node.style.textAlign = block.alignment[index] || "left";
            appendInlines(doc, node, row[index] || "", options);
            tableRow.append(node);
          });
          body.append(tableRow);
        }
        table.append(head, body);
        wrapper.append(table);
        parent.append(wrapper);
      }
    }
  }

  function appendMarkdown(doc, parent, value, options = {}) {
    appendBlocks(doc, parent, parseBlocks(value), options);
  }

  const exported = {
    normalizeSource,
    splitTableRow,
    tableAlignmentRow,
    parseBlocks,
    parseInlines,
    parseLatex,
    latexToText,
    appendMarkdown,
  };

  modules.Markdown = exported;
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
})(typeof globalThis !== "undefined" ? globalThis : this);
