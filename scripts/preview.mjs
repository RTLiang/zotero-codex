import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const compiled = spawnSync(process.execPath, [resolve(root, "scripts/compile.mjs")], { cwd: root, stdio: "inherit" });
if (compiled.status !== 0) process.exit(compiled.status || 1);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const target = resolve(root, `.${path === "/" ? "/dev/preview.html" : path}`);
    const allowed = ["content", "dev"].some((directory) => target.startsWith(`${root}${sep}${directory}${sep}`));
    if (!allowed) { response.writeHead(404).end(); return; }
    const body = await readFile(target);
    response.writeHead(200, { "Content-Type": `${types[extname(target)] || "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store" });
    response.end(body);
  }
  catch { response.writeHead(404).end(); }
});
server.listen(Number(process.env.PREVIEW_PORT || 4318), "127.0.0.1", () => {
  console.log(`Sidebar preview: http://127.0.0.1:${server.address().port}`);
});
