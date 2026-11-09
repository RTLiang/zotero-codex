interface DiagramFrameModule {
  configure(source: string): void;
  append(doc: Document, parent: HTMLElement, text: string): void;
  shutdown(): void;
}

interface Window { MutationObserver: typeof MutationObserver }

(function (global) {
  "use strict";
  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};
  const windows = new Map<Window, { frames: Map<HTMLIFrameElement, () => void>; dispose(): void }>();
  const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  let library = "";

  function localized(doc: Document, tag: string, id: string, fallback: string): HTMLElement {
    const node = doc.createElement(tag);
    node.textContent = fallback;
    modules.Localization?.setAttributes(node, id);
    return node;
  }

  function watch(win: Window, frame: HTMLIFrameElement, cleanup: () => void) {
    let state = windows.get(win);
    if (!state) {
      const frames = new Map<HTMLIFrameElement, () => void>();
      const observer = new win.MutationObserver(() => {
        for (const [frame, close] of frames) if (!frame.isConnected) {
          close();
          frames.delete(frame);
        }
      });
      const dispose = () => {
        observer.disconnect();
        for (const close of frames.values()) close();
        frames.clear();
        win.removeEventListener("unload", dispose);
        windows.delete(win);
      };
      observer.observe(win.document.documentElement, { childList: true, subtree: true });
      win.addEventListener("unload", dispose, { once: true });
      state = { frames, dispose };
      windows.set(win, state);
    }
    state.frames.set(frame, cleanup);
  }

  function append(doc: Document, parent: HTMLElement, text: string) {
    const wrapper = doc.createElement("figure");
    wrapper.className = "zcs-diagram zcs-code-block";
    const status = localized(doc, "div", "zotero-codex-diagram-loading", "Rendering diagram…");
    status.className = "zcs-diagram-status";
    status.setAttribute("role", "status");
    const source = doc.createElement("details");
    source.className = "zcs-diagram-source";
    source.append(localized(doc, "summary", "zotero-codex-diagram-source", "Mermaid source"));
    const pre = doc.createElement("pre");
    const code = doc.createElement("code");
    code.textContent = text;
    pre.append(code);
    source.append(pre);
    const win = doc.defaultView;
    if (!win || !library || text.length > 32000) {
      status.textContent = "Could not render this diagram. The source is shown below.";
      modules.Localization?.setAttributes(status, "zotero-codex-diagram-error");
      source.open = true;
      wrapper.dataset.state = "error";
      wrapper.append(status, source);
      parent.append(wrapper);
      return;
    }
    const frame = doc.createElement("iframe");
    frame.className = "zcs-mermaid-frame";
    frame.title = "Mermaid diagram";
    modules.Localization?.setAttributes(frame, "zotero-codex-diagram-frame");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("type", "content");
    frame.setAttribute("referrerpolicy", "no-referrer");
    const fail = () => {
      frame.hidden = true;
      source.open = true;
      status.textContent = "Could not render this diagram. The source is shown below.";
      modules.Localization?.setAttributes(status, "zotero-codex-diagram-error");
      status.hidden = false;
      wrapper.dataset.state = "error";
    };
    const ports = new win.MessageChannel();
    const timeout = win.setTimeout(fail, 10000);
    ports.port1.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!data || typeof data !== "object" || !("type" in data) || data.type !== "zcs-mermaid"
        || !("state" in data)) return;
      if (data.state === "error") { win.clearTimeout(timeout); fail(); }
      else if (data.state === "ready" && "height" in data && typeof data.height === "number" && Number.isFinite(data.height)) {
        win.clearTimeout(timeout);
        frame.hidden = false;
        frame.style.height = `${Math.max(80, Math.min(1200, Math.ceil(data.height)))}px`;
        status.hidden = true;
        wrapper.dataset.state = "ready";
      }
    };
    let connected = false;
    frame.addEventListener("load", () => {
      if (connected || frame.contentDocument?.URL !== "about:srcdoc") return;
      connected = true;
      frame.contentWindow?.postMessage({ type: "zcs-mermaid-connect" }, "*", [ports.port2]);
    }, true);
    watch(win, frame, () => {
      win.clearTimeout(timeout);
      ports.port1.close();
      ports.port2.close();
    });
    const dark = win.getComputedStyle(parent.isConnected ? parent : doc.documentElement).colorScheme === "dark"
      || win.matchMedia("(prefers-color-scheme: dark)").matches;
    const input = JSON.stringify(text).replace(/</gu, "\\u003c");
    const render = `let port;
    addEventListener('message', event => {
      if (port || event.data?.type !== 'zcs-mermaid-connect' || !event.ports[0]) return;
      port = event.ports[0];
      const report = (state) => port.postMessage({type:'zcs-mermaid',state,height:document.body.getBoundingClientRect().height});
      try {
        const theme = BeautifulMermaid.THEMES[${JSON.stringify(dark ? "github-dark" : "github-light")}];
        document.documentElement.style.backgroundColor = theme.bg;
        document.documentElement.style.color = theme.fg;
        const svgText = BeautifulMermaid.renderMermaidSVG(${input}, {
          ...theme,
          font:'system-ui, sans-serif', padding:24
        });
        document.getElementById('diagram-root').innerHTML = svgText.replace(/@import\\s+url\\([^)]*\\);?/gi, '');
        const svg = document.querySelector('svg');
        if (!svg) throw new Error('Missing diagram');
        svg.style.maxWidth = 'none';
        svg.style.width = svg.viewBox.baseVal.width + 'px';
        svg.style.height = svg.viewBox.baseVal.height + 'px';
        document.addEventListener('click', event => { if(event.target.closest?.('a')) event.preventDefault(); });
        document.addEventListener('submit', event => event.preventDefault());
        new ResizeObserver(() => report('ready')).observe(document.body);
        report('ready');
      } catch (_) { document.body.replaceChildren(); report('error'); }
    });`;
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>html{color-scheme:${dark ? "dark" : "light"};font:14px system-ui;background:Canvas;color:CanvasText}body{margin:0;padding:8px;box-sizing:border-box;width:max-content;min-width:100%}#diagram-root{display:flex;justify-content:center}svg{display:block}*{box-sizing:border-box}</style></head><body><div id="diagram-root"></div><script>${library}</script><script>${render}</script></body></html>`;
    wrapper.dataset.state = "loading";
    wrapper.append(status, frame, source);
    parent.append(wrapper);
  }

  modules.DiagramFrame = {
    configure(source) { library = source.replace(/<\/script/giu, "<\\/script"); },
    append,
    shutdown() {
      for (const state of windows.values()) state.dispose();
      library = "";
    },
  };
})(globalThis);
