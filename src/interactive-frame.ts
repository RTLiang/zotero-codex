interface NetworkSubject {
  QueryInterface(id: unknown): {
    loadInfo: { frameBrowsingContext?: NetworkBrowsingContext; browsingContext?: NetworkBrowsingContext };
    cancel(status: number): void;
  };
}

interface NetworkBrowsingContext { id: number; parent: NetworkBrowsingContext | null }

interface HTMLIFrameElement {
  readonly browsingContext?: { id: number };
}

interface Window { MessageChannel: typeof MessageChannel }

interface InteractiveFrameModule {
  mount(container: HTMLElement, options: {
    document: InteractiveUIDocument;
    threadID: string;
    itemID: string;
    store: InteractiveUIStore;
    onError(error: unknown): void;
  }): { dispose(): void; context(): Promise<{ id: string; title: string; state: InteractiveUIJSONValue }> };
}

(function (global) {
  "use strict";
  const modules = global.ZoteroCodexModules = global.ZoteroCodexModules || {};
  const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

  function mount(container: HTMLElement, options: Parameters<InteractiveFrameModule["mount"]>[1]) {
    const doc = container.ownerDocument;
    const win = doc.defaultView;
    if (!win) throw new Error("Interactive view has no window");
    const frame = doc.createElement("iframe");
    frame.className = "zcs-interactive-frame";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("type", "content");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.title = options.document.title;
    const nonce = global.crypto.randomUUID();
    const ports = new win.MessageChannel();
    let disposed = false;
    let current: InteractiveUIState = { revision: 0, value: null };
    let ready = false;
    let connected = false;
    frame.dataset.bridge = "waiting";
    let writing = false;
    let writeTask: Promise<void> | null = null;
    let appliedVersion = 0;
    let requestID = 0;
    const snapshots = new Map<number, (error?: Error) => void>();
    let pending: { value: unknown; version: number } | null = null;
    const post = () => {
      if (!disposed && ready) ports.port1.postMessage({ channel: nonce, type: "state", state: current.value, version: appliedVersion });
    };
    const observer = {
      observe(subject: NetworkSubject) {
        if (disposed) return;
        try {
          const channel = subject.QueryInterface(global.Ci.nsIHttpChannel);
          const id = frame.browsingContext?.id;
          let context = channel.loadInfo.frameBrowsingContext || channel.loadInfo.browsingContext;
          while (id && context) {
            if (context.id === id) {
              channel.cancel(0x804b0002);
              break;
            }
            context = context.parent || undefined;
          }
        } catch (_) { /* Unrelated channels are not owned by this frame. */ }
      },
    };
    global.Services.obs.addObserver(observer, "http-on-modify-request");
    const unsubscribe = options.store.subscribe((threadID, itemID, state) => {
      if (threadID !== options.threadID || itemID !== options.itemID || state.revision < current.revision) return;
      current = state;
      if (!writing) post();
    });
    async function writePending() {
      if (writing || disposed) return;
      writing = true;
      try {
        while (pending) {
          const next = pending;
          pending = null;
          current = await options.store.write(options.threadID, options.itemID, current.revision, next.value);
          appliedVersion = next.version;
        }
        post();
      } catch (error) {
        pending = null;
        if (!disposed) options.onError(error);
      } finally { writing = false; }
    }
    const receive = (event: MessageEvent<unknown>) => {
      if (disposed) return;
      const data = event.data;
      if (!data || typeof data !== "object" || !("channel" in data) || data.channel !== nonce || !("type" in data)) return;
      if (data.type === "ready") {
        frame.dataset.bridge = "ready";
        void options.store.read(options.threadID, options.itemID).then(state => {
          if (disposed) return;
          if (state.revision >= current.revision) current = state;
          ready = true;
          post();
        }).catch(options.onError);
      } else if (ready && (data.type === "state" || data.type === "snapshot") && "value" in data
        && "version" in data && typeof data.version === "number" && Number.isSafeInteger(data.version)) {
        pending = { value: data.value, version: data.version };
        if (!writing) writeTask = writePending();
        if (data.type === "snapshot" && "request" in data && typeof data.request === "number") {
          const resolve = snapshots.get(data.request);
          snapshots.delete(data.request);
          void writeTask?.then(() => resolve?.());
        }
      } else if (data.type === "resize" && "height" in data && typeof data.height === "number" && Number.isFinite(data.height)) {
        frame.style.height = `${Math.max(180, Math.min(6000, Math.ceil(data.height)))}px`;
      }
    };
    ports.port1.onmessage = receive;
    frame.addEventListener("load", () => {
      frame.dataset.bridge = "loaded";
      if (!disposed && !connected && frame.contentDocument?.URL === "about:srcdoc") {
        connected = true;
        frame.dataset.bridge = "connecting";
        frame.contentWindow?.postMessage({ channel: nonce, type: "connect" }, "*", [ports.port2]);
      }
    }, true);
    // This script precedes all generated code. State crosses only the message bridge.
    const bridge = `(() => {
      const channel = ${JSON.stringify(nonce)};
      document.documentElement.dataset.bridge = 'listening';
      let state = null, initialized = false, resolve, port, version = 0;
      const ready = new Promise(r => resolve = r);
      const send = (type, extra = {}) => port?.postMessage({channel,type,...extra});
      Object.defineProperty(window, 'zoteroUI', {value: Object.freeze({
        ready, getState: () => state,
        setState: value => { if (!initialized) throw new Error('Await zoteroUI.ready first'); state = value; send('state', {value, version: ++version}); }
      })});
      addEventListener('message', e => {
        if (port || e.data?.channel !== channel || e.data.type !== 'connect' || !e.ports[0]) return;
        port = e.ports[0];
        document.documentElement.dataset.bridge = 'connected';
        port.onmessage = message => {
          if (message.data?.channel !== channel) return;
          if (message.data.type === 'snapshot') { send('snapshot', {request: message.data.request, value: state, version}); return; }
          if (message.data.type !== 'state' || message.data.version < version) return;
          document.documentElement.dataset.bridge = 'ready';
          state = message.data.state;
          if (!initialized) { initialized = true; resolve(); }
          else dispatchEvent(new CustomEvent('zotero-ui-state', {detail: state}));
        };
        send('ready');
        new ResizeObserver(() => {
          const body = document.body, style = getComputedStyle(body);
          const height = body.getBoundingClientRect().height
            + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
          send('resize', {height});
        }).observe(document.body);
        document.addEventListener('click', e => { if(e.target.closest?.('a')) e.preventDefault(); });
        document.addEventListener('submit', e => e.preventDefault());
      });
    })();`;
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>html{color-scheme:light dark;font:14px system-ui}body{margin:12px;overflow-wrap:anywhere}*{box-sizing:border-box}input,select,button{font:inherit;max-width:100%}canvas,svg,img{max-width:100%}</style><script>${bridge}</script></head><body>${options.document.html}</body></html>`;
    container.append(frame);
    return {
      async context() {
        try {
        if (ready) {
          const request = ++requestID;
          await new Promise<void>((resolve, reject) => {
            const timer = win.setTimeout(() => { snapshots.delete(request); reject(new Error("Interactive state did not respond.")); }, 3000);
            snapshots.set(request, error => { win.clearTimeout(timer); error ? reject(error) : resolve(); });
            ports.port1.postMessage({ channel: nonce, type: "snapshot", request });
          });
        }
        await writeTask;
        current = await options.store.read(options.threadID, options.itemID);
        return { id: options.itemID, title: options.document.title, state: current.value };
        } catch (error) {
          if (!disposed) options.onError(error);
          return { id: options.itemID, title: options.document.title, state: null, unavailable: true };
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const settle of snapshots.values()) settle(new Error("Interactive view closed."));
        snapshots.clear();
        unsubscribe();
        ports.port1.close();
        ports.port2.close();
        frame.remove();
        global.Services.obs.removeObserver(observer, "http-on-modify-request");
      },
    };
  }
  modules.InteractiveFrame = { mount };
})(globalThis);
