(function (global) {
  "use strict";

  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};

  function normalizeSource(value) {
    return String(value || "").replace(/\r\n?/gu, "\n");
  }

  function normalizeLatex(value) {
    const normalizeMath = (source) => source
      // Recover the common shorthand `\sum_j=1^K` as actual lower/upper limits.
      .replace(
        /\\(sum|prod|coprod)_([A-Za-z])=([A-Za-z0-9.]+)\^([A-Za-z0-9]+)/gu,
        "\\$1{$2=$3}^{$4}",
      )
      // Models commonly omit braces around a one-letter styled symbol.
      .replace(
        /\\(mathcal|mathbb|mathrm|mathbf|mathit|mathsf|mathtt)([A-Za-z])(?=[^A-Za-z]|$)/gu,
        "\\$1{$2}",
      )
      // Multi-letter uppercase subscripts are conventionally a single label.
      .replace(/_([A-Z]{2,})(?=[^A-Za-z]|$)/gu, "_{$1}");
    const source = String(value || "");
    let result = "";
    let start = 0;
    const rawGroup = /\\(?:text|operatorname)\{/gu;
    for (const match of source.matchAll(rawGroup)) {
      if (match.index < start) continue;
      result += normalizeMath(source.slice(start, match.index));
      let end = match.index + match[0].length;
      let depth = 1;
      while (end < source.length && depth > 0) {
        if (source[end] === "{" && source[end - 1] !== "\\") depth++;
        else if (source[end] === "}" && source[end - 1] !== "\\") depth--;
        end++;
      }
      result += source.slice(match.index, end);
      start = end;
    }
    return result + normalizeMath(source.slice(start));
  }

  function isBareLatexLine(value) {
    const line = String(value || "").trim();
    if (!line || line.includes("`") || !line.includes("\\") || /[\u3400-\u9fff]/u.test(line)) return false;
    const commands = [...line.matchAll(/\\([A-Za-z]+)/gu)].map((match) => match[1]);
    const recognized = commands.some((command) =>
      /^(?:frac|dfrac|tfrac|binom|sqrt|sum|prod|coprod|int|iint|iiint|oint|log|ln|exp|min|max|argmin|argmax|lim|sup|inf)$/u.test(command)
      || /^(?:mathcal|mathbb|mathrm|mathbf|mathit|mathsf|mathtt)(?:[A-Za-z])?$/u.test(command)
      || LATEX_SYMBOLS.has(command));
    if (!recognized) return false;
    return /(?:[=<>≤≥≈+*/]|\\(?:frac|dfrac|tfrac|binom|sqrt|sum|prod|coprod|int|iint|iiint|oint)\b|[_^](?:\{|[A-Za-z0-9]))/u.test(line);
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
    if (/^\s*\\begin\{(?:matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|aligned|align|gathered|gather|split)\}/u.test(line)) return true;
    if (isBareLatexLine(line)) return true;
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
        const sameLineEnd = remainder.indexOf(closing);
        if (sameLineEnd >= 0) {
          content.push(remainder.slice(0, sameLineEnd));
          const tail = remainder.slice(sameLineEnd + closing.length).trim();
          index++;
          if (tail) lines.splice(index, 0, tail);
        }
        else {
          if (remainder) content.push(remainder);
          index++;
          while (index < lines.length) {
            remainder = lines[index];
            const end = remainder.indexOf(closing);
            if (end >= 0) {
              content.push(remainder.slice(0, end));
              const tail = remainder.slice(end + closing.length).trim();
              index++;
              if (tail) lines.splice(index, 0, tail);
              break;
            }
            content.push(remainder);
            index++;
          }
        }
        blocks.push({ type: "math", text: content.join("\n").trim() });
        continue;
      }

      const environment = line.match(/^\s*\\begin\{(matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|aligned|align|gathered|gather|split)\}/u);
      if (environment) {
        const content = [line];
        const closing = `\\end{${environment[1]}}`;
        index++;
        while (!content.at(-1).includes(closing) && index < lines.length) content.push(lines[index++]);
        blocks.push({ type: "math", text: content.join("\n") });
        continue;
      }

      if (isBareLatexLine(line)) {
        blocks.push({ type: "math", text: normalizeLatex(line.trim()), inferred: true });
        index++;
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
    ge: "≥", geq: "≥", ne: "≠", neq: "≠", leqslant: "⩽", geqslant: "⩾",
    approx: "≈", sim: "∼", simeq: "≃", cong: "≅", asymp: "≍",
    equiv: "≡", propto: "∝", in: "∈", notin: "∉", subset: "⊂", supset: "⊃",
    subseteq: "⊆", supseteq: "⊇", cup: "∪", cap: "∩", emptyset: "∅",
    land: "∧", wedge: "∧", lor: "∨", vee: "∨", neg: "¬",
    otimes: "⊗", oplus: "⊕", setminus: "∖", perp: "⟂", parallel: "∥",
    mid: "∣", vdash: "⊢", models: "⊨", therefore: "∴", because: "∵",
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
    ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", dots: "…", circ: "∘",
    lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩", lvert: "|", rvert: "|",
    lVert: "‖", rVert: "‖", Vert: "‖", lfloor: "⌊", rfloor: "⌋",
    lceil: "⌈", rceil: "⌉", textbackslash: "\\",
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
    "⇒", "⇐", "⇔", "∘", "⩽", "⩾", "≅", "≍", "∧", "∨", "⊗", "⊕",
    "∖", "⟂", "∥", "∣", "⊢", "⊨",
  ]);
  const LATEX_ACCENTS = new Map(Object.entries({
    hat: "^", widehat: "^", bar: "¯", overline: "¯", vec: "→", tilde: "~",
    widetilde: "~", dot: "˙", ddot: "¨", overrightarrow: "→", overleftarrow: "←",
    underline: "_",
  }));
  const LATEX_VARIANTS = new Map(Object.entries({
    mathrm: "normal", mathbf: "bold", mathit: "italic", mathbb: "double-struck",
    mathcal: "script",
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
    const source = normalizeLatex(value);
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
      if (source[index] !== "{") {
        if (/\d/u.test(source[index] || "")) return { type: "number", text: source[index++] };
        return parseAtom();
      }
      index++;
      const group = parseSequence("}");
      if (source[index] === "}") index++;
      return group;
    };

    const parseEnvironment = () => {
      const name = parseRawGroup();
      const closing = `\\end{${name}}`;
      const end = name ? source.indexOf(closing, index) : -1;
      if (end < 0) return { type: "text", text: `\\begin{${name}}` };
      const body = source.slice(index, end);
      index = end + closing.length;
      const rows = [[]];
      let cell = "";
      let depth = 0;
      const addCell = () => {
        rows.at(-1).push(parseLatex(cell.trim()));
        cell = "";
      };
      for (let position = 0; position < body.length; position++) {
        const character = body[position];
        if (character === "{" && body[position - 1] !== "\\") depth++;
        else if (character === "}" && body[position - 1] !== "\\") depth--;
        if (depth === 0 && character === "&" && body[position - 1] !== "\\") {
          addCell();
        }
        else if (depth === 0 && character === "\\" && body[position + 1] === "\\") {
          addCell();
          rows.push([]);
          position++;
        }
        else cell += character;
      }
      addCell();
      return { type: "environment", name, rows };
    };

    const parseCommand = () => {
      index++;
      const start = index;
      while (/[A-Za-z]/u.test(source[index] || "")) index++;
      const name = source.slice(start, index) || source[index++] || "";
      if (name === "left" || name === "right" || name === "middle") {
        skipSpaces();
        if (source[index] === ".") {
          index++;
          return { type: "row", children: [] };
        }
        return parseAtom();
      }
      if (name === "begin") return parseEnvironment();
      if (["frac", "dfrac", "tfrac"].includes(name)) {
        return { type: "fraction", numerator: parseGroup(), denominator: parseGroup() };
      }
      if (name === "binom") {
        return { type: "fraction", numerator: parseGroup(), denominator: parseGroup(), binomial: true };
      }
      if (name === "sqrt") {
        skipSpaces();
        let degree = null;
        if (source[index] === "[") {
          index++;
          degree = parseSequence("]");
          if (source[index] === "]") index++;
        }
        return { type: "sqrt", body: parseGroup(), degree };
      }
      if (LATEX_ACCENTS.has(name)) {
        return { type: "accent", mark: LATEX_ACCENTS.get(name), body: parseGroup(), under: name === "underline" };
      }
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
      if (["displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle", "limits", "nolimits"].includes(name)) {
        return { type: "row", children: [] };
      }
      const spaces = { ",": ".167em", ":": ".222em", ";": ".278em", "!": "-.167em",
        quad: "1em", qquad: "2em", " ": ".333em" };
      if (Object.hasOwn(spaces, name)) {
        return { type: "space", width: spaces[name] };
      }
      if (["{", "}", "|", "[", "]", "(", ")", "%", "$", "#", "&", "_"].includes(name)) {
        return { type: "operator", text: name };
      }
      const group = source[index] === "{" ? `{${parseRawGroup()}}` : "";
      return { type: "text", text: `\\${name}${group}` };
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
        while (source.startsWith("\\limits", index) || source.startsWith("\\nolimits", index)) {
          index += source.startsWith("\\nolimits", index) ? 9 : 7;
        }
        while (source[index] === "_" || source[index] === "^") {
          const marker = source[index++];
          let script = parseGroup();
          if (marker === "^" && (script.type === "operator" && script.text === "∘"
            || script.type === "row" && script.children.length === 1
              && script.children[0].type === "operator" && script.children[0].text === "∘")) {
            script = { type: "operator", text: "°" };
          }
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
      if (node.binomial) return `(${latexAstToText(node.numerator)} choose ${latexAstToText(node.denominator)})`;
      return `(${latexAstToText(node.numerator)})/(${latexAstToText(node.denominator)})`;
    }
    if (node.type === "sqrt") {
      const root = node.degree ? `${latexAstToText(node.degree)}√` : "√";
      return `${root}(${latexAstToText(node.body)})`;
    }
    if (node.type === "accent") return `${node.mark}(${latexAstToText(node.body)})`;
    if (node.type === "environment") {
      const rows = node.rows.map((row) => row.map(latexAstToText).join(" ")).join("; ");
      const fences = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"],
        vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", ""] };
      const [left, right] = fences[node.name] || ["", ""];
      return `${left}${rows}${right}`;
    }
    if (node.type === "script") {
      const convert = (script, characters, opening, closing) => {
        const text = latexAstToText(script);
        const converted = [...text].map((character) => characters.get(character) || "").join("");
        return converted.length === text.length ? converted : `${opening}${text}${closing}`;
      };
      return [
        latexAstToText(node.base),
        node.subscript ? convert(node.subscript, SUBSCRIPT_CHARACTERS, "₍", "₎") : "",
        node.superscript?.type === "operator" && node.superscript.text === "°"
          ? "°"
          : node.superscript ? convert(node.superscript, SUPERSCRIPT_CHARACTERS, "⁽", "⁾") : "",
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
    const findUnescaped = (delimiter, start) => {
      let position = source.indexOf(delimiter, start);
      while (position >= 0) {
        let slashes = 0;
        for (let previous = position - 1; source[previous] === "\\"; previous--) slashes++;
        if (slashes % 2 === 0) return position;
        position = source.indexOf(delimiter, position + delimiter.length);
      }
      return -1;
    };

    while (index < source.length) {
      if (source.startsWith("\\(", index)) {
        const end = findUnescaped("\\)", index + 2);
        if (end > index + 2) {
          const latex = source.slice(index + 2, end);
          tokens.push({ type: "math", latex, text: latexToText(latex) });
          index = end + 2;
          continue;
        }
      }

      if (source[index] === "$" && source[index - 1] !== "$" && source[index + 1] !== "$"
        && !/\s/u.test(source[index + 1] || "")) {
        const end = findUnescaped("$", index + 1);
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

      if (source[index] === "\\" && /[\\`*{}\[\]()#+.!_>~$-]/u.test(source[index + 1] || "")) {
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
      if (node.binomial) fraction.setAttribute("linethickness", "0");
      fraction.append(renderMathNode(doc, node.numerator), renderMathNode(doc, node.denominator));
      if (node.binomial) {
        const fenced = createMathML(doc, "mrow");
        fenced.append(createMathML(doc, "mo", "("), fraction, createMathML(doc, "mo", ")"));
        return fenced;
      }
      return fraction;
    }
    if (node.type === "sqrt") {
      const root = createMathML(doc, node.degree ? "mroot" : "msqrt");
      root.append(renderMathNode(doc, node.body));
      if (node.degree) root.append(renderMathNode(doc, node.degree));
      return root;
    }
    if (node.type === "accent") {
      const accent = createMathML(doc, node.under ? "munder" : "mover");
      accent.setAttribute(node.under ? "accentunder" : "accent", "true");
      accent.append(renderMathNode(doc, node.body), createMathML(doc, "mo", node.mark));
      return accent;
    }
    if (node.type === "environment") {
      const table = createMathML(doc, "mtable");
      for (const row of node.rows) {
        const tableRow = createMathML(doc, "mtr");
        for (const cell of row) {
          const tableCell = createMathML(doc, "mtd");
          tableCell.append(renderMathNode(doc, cell));
          tableRow.append(tableCell);
        }
        table.append(tableRow);
      }
      const fences = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"],
        vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", ""] };
      const [left, right] = fences[node.name] || ["", ""];
      if (!left) return table;
      const fenced = createMathML(doc, "mrow");
      fenced.append(createMathML(doc, "mo", left), table);
      if (right) fenced.append(createMathML(doc, "mo", right));
      return fenced;
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
    normalizeLatex,
    isBareLatexLine,
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
