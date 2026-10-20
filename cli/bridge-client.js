// Use native globalThis.WebSocket (Node 21+) or fallback to dynamic ws
let WS = globalThis.WebSocket;
if (!WS) {
  try {
    const wsModule = await import('ws');
    WS = wsModule.WebSocket || wsModule.default;
  } catch (e) {}
}

export class BridgeClient {
  constructor(port = 42819, host = '127.0.0.1') {
    this.url = `ws://${host}:${port}`;
    this.ws = null;
    this.messageIdCounter = 1;
    this.pendingRequests = new Map();
  }

  async connect(timeoutMs = 5000) {
    if (this.ws && (this.ws.readyState === 1 || this.ws.readyState === WS?.OPEN)) return;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.ws) {
          try { this.ws.close(); } catch (e) {}
        }
        reject(new Error(`Could not connect to XtraDevPilot bridge at ${this.url}. Ensure the bridge is running (npx xtradevpilot-mcp or devpilot mcp) and Chrome extension is active.`));
      }, timeoutMs);

      try {
        const ws = new WS(this.url);
        this.ws = ws;

        const onOpen = () => {
          clearTimeout(timer);
          resolve();
        };

        const onMessage = (event) => {
          try {
            const raw = typeof event.data === 'string' ? event.data : event.toString();
            const msg = JSON.parse(raw);
            if (msg.id && this.pendingRequests.has(msg.id)) {
              const { resolve: reqResolve, reject: reqReject, timer: reqTimer } = this.pendingRequests.get(msg.id);
              clearTimeout(reqTimer);
              this.pendingRequests.delete(msg.id);

              if (msg.error) {
                reqReject(new Error(msg.error));
              } else {
                reqResolve(msg.result);
              }
            }
          } catch (e) {}
        };

        const onError = (err) => {
          clearTimeout(timer);
          reject(new Error(`Bridge connection error: ${err.message || 'connection failed'}`));
        };

        if (typeof ws.on === 'function') {
          ws.on('open', onOpen);
          ws.on('message', (data) => onMessage({ data }));
          ws.on('error', onError);
        } else {
          ws.onopen = onOpen;
          ws.onmessage = onMessage;
          ws.onerror = onError;
        }
      } catch (err) {
        clearTimeout(timer);
        return reject(err);
      }
    });
  }

  async call(action, payload = {}, timeoutMs = 15000) {
    await this.connect();

    const id = this.messageIdCounter++;
    const effTimeout = payload.timeoutMs ? payload.timeoutMs + 5000 : timeoutMs;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout (${effTimeout}ms) waiting for response to action: ${action}`));
      }, effTimeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ ...payload, action, id }));
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
  }
}
