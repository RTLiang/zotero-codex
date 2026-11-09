import { build } from "esbuild";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const destination = resolve(root, "content/vendor/beautiful-mermaid");
mkdirSync(destination, { recursive: true });
await build({
  stdin: { contents: 'export { renderMermaidSVG, THEMES } from "beautiful-mermaid";', resolveDir: root },
  bundle: true, format: "iife", globalName: "BeautifulMermaid", platform: "browser",
  target: "es2022", minify: true, legalComments: "eof",
  outfile: resolve(destination, "beautiful-mermaid.min.js"),
});
for (const [source, name] of [
  ["beautiful-mermaid/LICENSE", "LICENSE"],
  ["elkjs/LICENSE.md", "LICENSE-elkjs.md"],
  ["entities/LICENSE", "LICENSE-entities"],
]) copyFileSync(resolve(root, "node_modules", source), resolve(destination, name));
writeFileSync(resolve(destination, "NOTICE.txt"),
  "Beautiful Mermaid 1.1.3 — https://github.com/lukilabs/beautiful-mermaid\n"
  + "Bundled with elkjs and entities. Dependency versions are pinned in package-lock.json.\n"
  + "Rebuild: npm ci && npm run vendor:diagrams\n"
  + "ELK source: https://github.com/kieler/elkjs (EPL-2.0)\n");
