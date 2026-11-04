let socket = null;
let heartbeatInterval = null;
let networkLogsByTab = {};
let consoleLogsByTab = {};
let harDataByTab = {};
let harPendingRequests = {};

// The "sticky" tab xtradevpilot is actively working on. Commands that arrive
// without an explicit tabId target this tab instead of whatever tab the user
// happens to have in front, so switching tabs or windows by hand never hijacks
// or interrupts automation (and navigate() never loads a URL into the user's tab).
let stickyTabId = null;

function getTabById(id) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.get(id, (tab) => resolve(!chrome.runtime.lastError && tab ? tab : null));
    } catch (e) { resolve(null); }
  });
}

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0] ? tabs[0] : null));
  });
}

// Resolve the tab a command should act on: an explicit tabId always wins (and
// becomes the new sticky target); otherwise the current sticky tab is used if it
// still exists; otherwise we fall back to the active tab and remember it. Pure
// read-only callers pass { updateSticky:false } so meta queries (tab info, logs)
// never change which tab automation is working on.
async function resolveTargetTab(payload = {}, { updateSticky = true } = {}) {
  if (payload && payload.tabId != null) {
    const t = await getTabById(payload.tabId);
    if (!t) throw new Error(`Tab with ID ${payload.tabId} not found.`);
    if (updateSticky) stickyTabId = t.id;
    return t;
  }
  if (stickyTabId != null) {
    const t = await getTabById(stickyTabId);
    if (t) return t;
    stickyTabId = null; // sticky tab was closed; fall through to active
  }
  const active = await queryActiveTab();
  if (!active) throw new Error('No active tab found.');
  if (updateSticky) stickyTabId = active.id;
  return active;
}

function setStickyTab(id) { if (id != null) stickyTabId = id; }

// Forget the sticky tab if the user closes it, so we cleanly fall back next time.
chrome.tabs.onRemoved.addListener((tabId) => { if (tabId === stickyTabId) stickyTabId = null; });

// Unique session ID generated per browser instance lifetime
const BROWSER_SESSION_ID = 'devpilot_session_' + Math.random().toString(36).slice(2, 10);

const BRIDGE_URLS = ['ws://127.0.0.1:42819', 'ws://localhost:42819', 'ws://127.0.0.1:42820', 'ws://localhost:42820'];
let bridgeUrlIndex = 0;

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (socket) {
    try { socket.close(); } catch (e) {}
    socket = null;
  }

  const url = BRIDGE_URLS[bridgeUrlIndex % BRIDGE_URLS.length];
  console.log(`[DevPilot] Connecting to WebSocket bridge at ${url}...`);
  try {
    socket = new WebSocket(url);
  } catch (err) {
    console.error("[DevPilot] WebSocket init error:", err);
    bridgeUrlIndex++;
    setTimeout(connectWebSocket, 2000);
    return;
  }

  socket.onopen = () => {
    console.log(`[DevPilot] Connected to IDE Bridge at ${url}`);
    socket.send(JSON.stringify({
      role: 'extension',
      sessionId: BROWSER_SESSION_ID,
      meta: {
        userAgent: navigator.userAgent,
        platform: navigator.platform || (navigator.userAgentData ? navigator.userAgentData.platform : 'unknown'),
        extensionId: chrome.runtime ? chrome.runtime.id : undefined
      }
    }));
    
    // Setup 15s Heartbeat Ping
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      if (!message.id || !message.action) return;

      const { id, action, ...payload } = message;
      automationStopped = false; // a new command from the IDE resumes automation

      try {
        let result = await handleAction(action, payload);
        socket.send(JSON.stringify({ id, result }));
      } catch (err) {
        socket.send(JSON.stringify({ id, error: err.message }));
      }

    } catch (e) {
      console.error("[DevPilot] Error parsing WS message:", e);
    }
  };

  socket.onclose = () => {
    console.log("[DevPilot] WebSocket disconnected. Reconnecting in 3s...");
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    setTimeout(connectWebSocket, 3000);
  };
  
  socket.onerror = (error) => {
    console.error("[DevPilot] WebSocket error:", error);
  };
}

function ensureConnected() {
  if (!socket || (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING)) {
    connectWebSocket();
  }
}

// Initial connection
connectWebSocket();

// Reconnect triggers on user tab activity
chrome.tabs.onActivated.addListener(ensureConnected);
chrome.tabs.onUpdated.addListener(ensureConnected);
chrome.runtime.onStartup.addListener(ensureConnected);
chrome.runtime.onInstalled.addListener(ensureConnected);

async function getActiveTabLogs(logsObj, payload) {
  try {
    const tab = await resolveTargetTab(payload || {}, { updateSticky: false });
    return logsObj[tab.id] || [];
  } catch (e) {
    return [];
  }
}

async function handleAction(action, payload = {}) {
  switch (action) {
    case 'OPEN_TAB':
    case 'NAVIGATE':
      return new Promise((resolve, reject) => {
        const url = payload.url || 'https://google.com';
        // open_tab may open in the background (active:false) so it never steals
        // focus from what the user is doing; it still becomes the sticky target.
        if (action === 'OPEN_TAB' || payload.newTab) {
          chrome.tabs.create({ url, active: payload.background ? false : true }, (tab) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            setStickyTab(tab.id);
            resolve({ tabId: tab.id, url: tab.url, status: tab.status });
          });
        } else if (payload.tabId) {
          chrome.tabs.update(payload.tabId, { url }, (tab) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            setStickyTab(tab.id);
            resolve({ tabId: tab.id, url: tab.url, status: tab.status });
          });
        } else {
          // No tabId: navigate the tab automation is working on (sticky), NOT
          // whatever tab the user currently has focused.
          resolveTargetTab(payload).then((target) => {
            chrome.tabs.update(target.id, { url }, (tab) => {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              setStickyTab(tab.id);
              resolve({ tabId: tab.id, url: tab.url, status: tab.status });
            });
          }).catch(reject);
        }
      });
    case 'GET_TAB_INFO':
      return new Promise((resolve, reject) => {
        const parseTab = (tab) => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl,
          width: tab.width,
          height: tab.height,
          status: tab.status
        });

        if (payload.tabId) {
          chrome.tabs.get(payload.tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) return reject(new Error(`Tab ID ${payload.tabId} not found.`));
            resolve(parseTab(tab));
          });
        } else {
          resolveTargetTab(payload, { updateSticky: false }).then((tab) => resolve(parseTab(tab))).catch(reject);
        }
      });
    case 'LIST_TABS':
      return new Promise((resolve, reject) => {
        chrome.tabs.query({}, (tabs) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(tabs.map(t => ({
            id: t.id,
            title: t.title,
            url: t.url,
            active: t.active,
            working: t.id === stickyTabId,
            status: t.status
          })));
        });
      });
    case 'GET_NETWORK_LOGS':
      return await getActiveTabLogs(networkLogsByTab, payload);
    case 'GET_CONSOLE_LOGS':
      return await getActiveTabLogs(consoleLogsByTab, payload);
    case 'GET_DOM':
    case 'GET_CLEAN_DOM':
    case 'GET_AX_TREE':
    case 'BATCH_EXECUTE':
    case 'HIGHLIGHT_ELEMENT':
    case 'WAIT_FOR_CLICK':
    case 'UPLOAD_FILE':
    case 'BATCH_FILL_FORM':
    case 'WAIT_FOR_ELEMENT':
    case 'SMART_SELECT_COMBOBOX':
    case 'EXTRACT_JOB_DETAILS':
    case 'SCROLL_PAGE':
    case 'EXTRACT_STRUCTURED_DATA':
    case 'ASSERT_ELEMENT_STATE':
    case 'RECORD_FLOW':
    case 'MANAGE_STORAGE':
    case 'MOCK_NETWORK_RESPONSE':
    case 'CLEAR_NETWORK_MOCKS':
    case 'GET_STORAGE':
    case 'INJECT_CSS':
    case 'TOGGLE_LAYOUT_DEBUG':
    case 'GET_WEB_VITALS':
    case 'RUN_SECURITY_AUDIT':
    case 'RUN_ACCESSIBILITY_AUDIT':
      return await askContentScript(action, payload);
    case 'CLICK_ELEMENT':
    case 'TYPE_TEXT':
    case 'PRESS_KEY':
    case 'PRESS_KEYS':
    case 'MOUSE_ACTION':
    case 'TOUCH_ACTION':
      return await runInput(action, payload);
    case 'DROP_FILES':
      return await dropFiles(payload);
    case 'EXECUTE_SCRIPT':
      return await executeScriptWithFallback(payload);
    case 'DOWNLOAD_PAGE_HTML':
      return await askContentScript('DOWNLOAD_PAGE_HTML', payload);
    case 'TRACE_ACTION': {
      const targetTab = await resolveTargetTab(payload);
      const tabId = targetTab.id;
      const initialHarCount = (harDataByTab[tabId] || []).length;
      const initialNetLogCount = (networkLogsByTab[tabId] || []).length;

      let actionResult = null;
      // The sub-action travels as `subAction` (a payload key named `action` is clobbered
      // by the command name in transit). Older senders lose it entirely, so infer.
      const actionType = String(payload.subAction || payload.traceAction || (payload.text ? 'type' : 'click')).toLowerCase();
      if (actionType === 'click') {
        actionResult = await runInput('CLICK_ELEMENT', { selector: payload.selector, timeoutMs: 3000, tabId });
      } else if (actionType === 'type') {
        actionResult = await runInput('TYPE_TEXT', { selector: payload.selector, text: payload.text || '', timeoutMs: 3000, tabId });
      }

      const waitMs = Math.min(Math.max(payload.waitDurationMs || 1500, 200), 10000);
      await new Promise(r => setTimeout(r, waitMs));

      const newHarEntries = (harDataByTab[tabId] || []).slice(initialHarCount);
      const newNetLogs = (networkLogsByTab[tabId] || []).slice(initialNetLogCount);

      const correlatedRequests = newHarEntries.map(e => ({
        url: e.request.url,
        method: e.request.method,
        status: e.response.status,
        statusText: e.response.statusText,
        mimeType: e.response.content.mimeType,
        sizeBytes: e.response.content.size,
        timeMs: e.time,
        startedDateTime: e.startedDateTime
      }));

      return {
        selector: payload.selector,
        action: actionType,
        actionResult,
        waitDurationMs: waitMs,
        triggeredRequestsCount: correlatedRequests.length,
        triggeredRequests: correlatedRequests,
        recentNetworkLogs: newNetLogs
      };
    }
    case 'EXPORT_HAR': {
      const targetTab = await resolveTargetTab(payload);
      const tabId = targetTab.id;
      const entries = harDataByTab[tabId] || [];
      const harLog = buildHarLog(tabId, targetTab.title, targetTab.url, entries);

      if (payload.clearAfterExport) {
        harDataByTab[tabId] = [];
      }

      return harLog;
    }
    case 'DOWNLOAD_SOURCES': {
      const targetTab = await resolveTargetTab(payload);
      const tabId = targetTab.id;

      const collected = await askContentScript('COLLECT_SOURCE_URLS', { ...payload, tabId });
      if (!collected) {
        throw new Error("Failed to collect source resources from page.");
      }

      const allowedTypes = Array.isArray(payload.types) && payload.types.length > 0
        ? payload.types.map(t => t.toLowerCase())
        : ['scripts', 'styles', 'sourcemaps', 'images', 'fonts'];

      const filesToDownload = [];
      const manifest = [];
      const usedPaths = new Set();

      function getUniquePath(baseRelativePath) {
        let target = baseRelativePath;
        let counter = 1;
        const lastDot = baseRelativePath.lastIndexOf('.');
        const withoutExt = lastDot !== -1 ? baseRelativePath.substring(0, lastDot) : baseRelativePath;
        const ext = lastDot !== -1 ? baseRelativePath.substring(lastDot) : '';
        while (usedPaths.has(target)) {
          target = `${withoutExt}_${counter}${ext}`;
          counter++;
        }
        usedPaths.add(target);
        return target;
      }

      // 1. Inline scripts
      if (allowedTypes.includes('scripts') && collected.inlineScripts) {
        for (const item of collected.inlineScripts) {
          const relPath = getUniquePath(`scripts/${item.name}`);
          filesToDownload.push({
            relativePath: relPath,
            content: item.content,
            isBinary: false,
            mimeType: 'application/javascript',
            size: item.content.length,
            originalUrl: `${collected.baseUrl}#${item.name}`
          });
          manifest.push({ type: 'script (inline)', path: relPath, size: item.content.length, url: `${collected.baseUrl}#${item.name}` });
        }
      }

      // 2. Inline styles
      if (allowedTypes.includes('styles') && collected.inlineStyles) {
        for (const item of collected.inlineStyles) {
          const relPath = getUniquePath(`styles/${item.name}`);
          filesToDownload.push({
            relativePath: relPath,
            content: item.content,
            isBinary: false,
            mimeType: 'text/css',
            size: item.content.length,
            originalUrl: `${collected.baseUrl}#${item.name}`
          });
          manifest.push({ type: 'style (inline)', path: relPath, size: item.content.length, url: `${collected.baseUrl}#${item.name}` });
        }
      }

      // 3. Inline SVGs
      if (allowedTypes.includes('images') && collected.inlineSvgs) {
        for (const item of collected.inlineSvgs) {
          const relPath = getUniquePath(`images/${item.name}`);
          filesToDownload.push({
            relativePath: relPath,
            content: item.content,
            isBinary: false,
            mimeType: 'image/svg+xml',
            size: item.content.length,
            originalUrl: `${collected.baseUrl}#${item.name}`
          });
          manifest.push({ type: 'svg (inline)', path: relPath, size: item.content.length, url: `${collected.baseUrl}#${item.name}` });
        }
      }

      // 4. External resources
      const externalTasks = [];
      if (allowedTypes.includes('scripts') && collected.scripts) {
        collected.scripts.forEach(u => externalTasks.push({ url: u, category: 'scripts', defaultExt: '.js', isBinary: false }));
      }
      if (allowedTypes.includes('styles') && collected.styles) {
        collected.styles.forEach(u => externalTasks.push({ url: u, category: 'styles', defaultExt: '.css', isBinary: false }));
      }
      if (allowedTypes.includes('images') && collected.images) {
        collected.images.forEach(u => externalTasks.push({ url: u, category: 'images', defaultExt: '.png', isBinary: true }));
      }
      if (allowedTypes.includes('fonts') && collected.fonts) {
        collected.fonts.forEach(u => externalTasks.push({ url: u, category: 'fonts', defaultExt: '.woff2', isBinary: true }));
      }

      // Limit to 150 items
      const tasksToRun = externalTasks.slice(0, 150);

      async function fetchResource(task) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(task.url, { credentials: 'include', signal: controller.signal });
          clearTimeout(timeoutId);

          if (!res.ok) return null;
          const contentType = res.headers.get('content-type') || '';
          const isActuallyBinary = task.isBinary || (!contentType.includes('text') && !contentType.includes('javascript') && !contentType.includes('json') && !contentType.includes('svg'));

          let rawFileName = '';
          try {
            const u = new URL(task.url);
            const segments = u.pathname.split('/').filter(Boolean);
            rawFileName = segments.length > 0 ? segments[segments.length - 1] : `asset_${Math.random().toString(36).substring(7)}`;
          } catch (e) {
            rawFileName = `asset_${Math.random().toString(36).substring(7)}`;
          }
          rawFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          if (!rawFileName.includes('.')) rawFileName += task.defaultExt;

          const relPath = getUniquePath(`${task.category}/${rawFileName}`);

          if (isActuallyBinary) {
            const buffer = await res.arrayBuffer();
            if (buffer.byteLength > 10 * 1024 * 1024) return null; // skip > 10MB
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const len = bytes.byteLength;
            for (let i = 0; i < len; i += 8192) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
            }
            const base64 = btoa(binary);
            return {
              item: {
                relativePath: relPath,
                base64,
                isBinary: true,
                mimeType: contentType || 'application/octet-stream',
                size: buffer.byteLength,
                originalUrl: task.url,
                category: task.category
              }
            };
          } else {
            const text = await res.text();
            let sourceMapUrl = null;
            if (payload.includeSourceMaps !== false && allowedTypes.includes('sourcemaps')) {
              const smMatch = text.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/) || text.match(/\/\*[#@]\s*sourceMappingURL=([^\s]+)\s*\*\//);
              if (smMatch && smMatch[1] && !smMatch[1].startsWith('data:')) {
                try {
                  sourceMapUrl = new URL(smMatch[1], task.url).href;
                } catch (e) {}
              }
            }
            return {
              item: {
                relativePath: relPath,
                content: text,
                isBinary: false,
                mimeType: contentType || 'text/plain',
                size: text.length,
                originalUrl: task.url,
                category: task.category
              },
              sourceMapUrl
            };
          }
        } catch (err) {
          return null;
        }
      }

      const sourcemapTasks = [];
      const batchSize = 6;
      for (let i = 0; i < tasksToRun.length; i += batchSize) {
        const batch = tasksToRun.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(fetchResource));
        for (const r of results) {
          if (!r || !r.item) continue;
          filesToDownload.push(r.item);
          manifest.push({ type: r.item.category, path: r.item.relativePath, size: r.item.size, url: r.item.originalUrl });
          if (r.sourceMapUrl) {
            sourcemapTasks.push({ url: r.sourceMapUrl, category: 'sourcemaps', defaultExt: '.map', isBinary: false });
          }
        }
      }

      // Process discovered sourcemaps
      if (sourcemapTasks.length > 0) {
        const smBatch = sourcemapTasks.slice(0, 30);
        for (let i = 0; i < smBatch.length; i += batchSize) {
          const batch = smBatch.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(fetchResource));
          for (const r of results) {
            if (!r || !r.item) continue;
            filesToDownload.push(r.item);
            manifest.push({ type: 'sourcemap', path: r.item.relativePath, size: r.item.size, url: r.item.originalUrl });
          }
        }
      }

      return {
        totalFiles: filesToDownload.length,
        files: filesToDownload,
        manifest
      };
    }
    case 'MANAGE_COOKIES':
      return new Promise((resolve, reject) => {
        if (!chrome.cookies) return reject(new Error("Cookies permission not available."));
        const op = payload.operation;
        if (op === 'get_all') {
          const filter = {};
          if (payload.domain) filter.domain = payload.domain;
          if (payload.url) filter.url = payload.url;
          chrome.cookies.getAll(filter, (cookies) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly })));
          });
        } else if (op === 'get') {
          chrome.cookies.get({ url: payload.url, name: payload.name }, (cookie) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(cookie ? { name: cookie.name, value: cookie.value, domain: cookie.domain } : null);
          });
        } else if (op === 'set') {
          const details = {
            url: payload.url,
            name: payload.name,
            value: payload.value,
            domain: payload.domain,
            path: payload.path || '/',
            secure: payload.secure !== undefined ? payload.secure : false,
            httpOnly: payload.httpOnly !== undefined ? payload.httpOnly : false
          };
          chrome.cookies.set(details, (cookie) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(`Cookie '${payload.name}' set successfully.`);
          });
        } else if (op === 'remove') {
          chrome.cookies.remove({ url: payload.url, name: payload.name }, (details) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(`Cookie '${payload.name}' removed.`);
          });
        } else {
          reject(new Error(`Unknown cookie operation: ${op}`));
        }
      });
    case 'CAPTURE_SCREENSHOT': {
      const target = await resolveTargetTab(payload);
      const tabId = target.id;
      // Primary: CDP Page.captureScreenshot. Grabs the target tab WITHOUT
      // activating it or focusing its window (so it never interrupts the user),
      // and works even when the tab is backgrounded (no more blank captures).
      try {
        return await captureViaDebugger(tabId, payload);
      } catch (cdpErr) {
        // Fallback: capture the visible tab as-is. We deliberately do NOT switch
        // tabs or focus the window here — if the target isn't visible this will
        // fail and we drop to the content-script canvas snapshot below.
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            chrome.tabs.captureVisibleTab(target.windowId, { format: 'png' }, (d) => {
              if (chrome.runtime.lastError || !d) return reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'captureVisibleTab failed'));
              resolve(d);
            });
          });
          return dataUrl;
        } catch (visErr) {
          return await askContentScript('GET_CANVAS_SNAPSHOT', { ...payload, tabId });
        }
      }
    }
    case 'RELOAD_EXTENSION':
      setTimeout(() => {
        chrome.runtime.reload();
      }, 150);
      return "Extension reloading initiated.";
    case 'SET_VIEWPORT_SIZE':
      return new Promise((resolve, reject) => {
        chrome.windows.getCurrent((win) => {
          if (!win) return reject(new Error("No active window"));
          chrome.windows.update(win.id, {
            width: payload.width,
            height: payload.height
          }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(`Window resized to ${payload.width}x${payload.height}`);
          });
        });
      });
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Runs page JS. Fast path = MAIN-world injection (content/injected.js). If the page's
// Content-Security-Policy blocks eval there, transparently fall back to the Chrome
// DevTools Protocol, which evaluates in the page context and is not subject to CSP.
async function executeScriptWithFallback(payload) {
  try {
    return await askContentScript('EXECUTE_SCRIPT', payload);
  } catch (err) {
    const msg = String((err && err.message) || err);
    if (/content security policy|unsafe-eval|evalerror|csp\b/i.test(msg)) {
      return await evaluateViaDebugger(payload);
    }
    throw err;
  }
}

// =====================================================================
// Trusted input via the Chrome DevTools Protocol
// ---------------------------------------------------------------------
// Events made with element.dispatchEvent() are isTrusted:false, carry fake
// pointer ids (so setPointerCapture() throws) and skip browser hit-testing,
// which is why canvas apps (design editors, chess boards, maps) ignore them.
// CDP Input.* injects input at the browser input layer instead: real pointer
// ids, real hit-testing, isTrusted:true. Synthetic dispatch stays as the
// fallback whenever the debugger can't attach.
// =====================================================================
const DBG_IDLE_MS = 20000;        // keep the session warm between actions
const CURSOR_LEAD_MS = 110;       // let the overlay cursor glide before a click lands
const dbgSession = { tabId: null, attaching: null, idleTimer: null, dragData: null };
let automationStopped = false;    // set by the in-page Stop badge
let inputChain = Promise.resolve();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dbgRaw(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (r) =>
      chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(r));
  });
}

function dbgTouch() {
  clearTimeout(dbgSession.idleTimer);
  dbgSession.idleTimer = setTimeout(() => { dbgDetach(); }, DBG_IDLE_MS);
}

async function dbgDetach() {
  const tabId = dbgSession.tabId;
  clearTimeout(dbgSession.idleTimer);
  dbgSession.tabId = null;
  dbgSession.dragData = null;
  if (tabId == null) return;
  await new Promise((res) => chrome.debugger.detach({ tabId }, () => { void chrome.runtime.lastError; res(); }));
}

// Attach once per working tab and reuse the session for every input, screenshot
// and CSP-fallback eval: one steady "debugging" banner instead of a flicker per
// action, and no attach round-trip on the hot path.
async function dbgEnsure(tabId) {
  if (dbgSession.tabId === tabId) {
    if (dbgSession.attaching) await dbgSession.attaching;
    dbgTouch();
    return;
  }
  if (dbgSession.tabId != null) await dbgDetach();
  dbgSession.tabId = tabId;
  const attachOnce = () => new Promise((res, rej) => chrome.debugger.attach({ tabId }, '1.3', () => {
    const err = chrome.runtime.lastError;
    if (!err) return res();
    // A previous service-worker instance may still own the session: adopt it.
    if (/already attached/i.test(err.message)) {
      return dbgRaw(tabId, 'Runtime.evaluate', { expression: '1' }).then(res, () => rej(new Error(err.message)));
    }
    rej(new Error(err.message));
  }));
  dbgSession.attaching = attachOnce().catch(async (e) => {
    await sleep(150);                // the first attach right after a load can race; retry once
    return attachOnce().catch(() => { throw e; });
  });
  try {
    await dbgSession.attaching;
  } catch (e) {
    dbgSession.tabId = null;
    e.attachFailed = true;           // nothing was sent yet: safe to fall back to synthetic input
    throw e;
  } finally {
    dbgSession.attaching = null;
  }
  dbgTouch();
}

async function dbgSend(tabId, method, params) {
  await dbgEnsure(tabId);
  try {
    return await dbgRaw(tabId, method, params);
  } catch (e) {
    // Session went stale (navigation, DevTools took over): reattach once.
    if (/not attached|detached|no target/i.test(e.message)) {
      dbgSession.tabId = null;
      await dbgEnsure(tabId);
      return await dbgRaw(tabId, method, params);
    }
    throw e;
  }
}

chrome.debugger.onDetach.addListener((src) => {
  if (src.tabId === dbgSession.tabId) {
    clearTimeout(dbgSession.idleTimer);
    dbgSession.tabId = null;
    dbgSession.dragData = null;
  }
});

chrome.debugger.onEvent.addListener((src, method, params) => {
  // Fired when a trusted mouse drag starts a native HTML5 drag (draggable=true).
  if (method === 'Input.dragIntercepted' && src.tabId === dbgSession.tabId) {
    dbgSession.dragData = params && params.data;
  }
});

// Serialize input sequences so two commands can't interleave a press/release.
function serializeInput(fn) {
  const run = inputChain.then(fn, fn);
  inputChain = run.catch(() => {});
  return run;
}

// Fire-and-forget: move the in-page overlay cursor (purely visual).
function moveCursor(tabId, x, y, state) {
  try {
    chrome.tabs.sendMessage(tabId, { action: 'CURSOR', x: Math.round(x), y: Math.round(y), state }, () => { void chrome.runtime.lastError; });
  } catch (e) {}
}

function modifierMask(p = {}) {
  return (p.altKey ? 1 : 0) | (p.ctrlKey ? 2 : 0) | (p.metaKey ? 4 : 0) | (p.shiftKey ? 8 : 0);
}

const MOUSE_BUTTONS = { left: { name: 'left', mask: 1 }, right: { name: 'right', mask: 2 }, middle: { name: 'middle', mask: 4 } };

// `action` on the wire is the command name, so the mouse sub-action travels as
// `subAction` (or `mouseAction`). Older bridges drop it entirely; infer intent
// from the other fields and default to a harmless move, never a click.
function resolveMouseAction(p = {}) {
  const explicit = p.subAction || p.mouseAction;
  if (explicit) return String(explicit).toLowerCase();
  if (p.endX != null || p.endY != null || p.dropSelector) return 'drag';
  if (p.deltaX || p.deltaY) return 'scroll';
  return 'move';
}

const SPECIAL_KEYS = {
  Enter: { code: 'Enter', vk: 13, text: '\r' }, Tab: { code: 'Tab', vk: 9 }, Escape: { code: 'Escape', vk: 27 },
  Backspace: { code: 'Backspace', vk: 8 }, Delete: { code: 'Delete', vk: 46 }, Space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
  ArrowUp: { code: 'ArrowUp', vk: 38 }, ArrowDown: { code: 'ArrowDown', vk: 40 }, ArrowLeft: { code: 'ArrowLeft', vk: 37 }, ArrowRight: { code: 'ArrowRight', vk: 39 },
  Home: { code: 'Home', vk: 36 }, End: { code: 'End', vk: 35 }, PageUp: { code: 'PageUp', vk: 33 }, PageDown: { code: 'PageDown', vk: 34 },
  Shift: { code: 'ShiftLeft', vk: 16 }, Control: { code: 'ControlLeft', vk: 17 }, Alt: { code: 'AltLeft', vk: 18 }, Meta: { code: 'MetaLeft', vk: 91 },
  Insert: { code: 'Insert', vk: 45 }
};

const IS_MAC = /mac/i.test((self.navigator && ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform)) || '');

function keyDescriptor(key, shift) {
  if (key === ' ') key = 'Space';
  if (SPECIAL_KEYS[key]) { const k = SPECIAL_KEYS[key]; return { key: k.key || key, code: k.code, vk: k.vk, text: k.text }; }
  const f = /^F([1-9]|1[0-2])$/.exec(key);
  if (f) return { key, code: key, vk: 111 + Number(f[1]) };
  if (key.length === 1) {
    const ch = key;
    if (/[a-z]/i.test(ch)) { const out = shift ? ch.toUpperCase() : ch; return { key: out, code: 'Key' + ch.toUpperCase(), vk: ch.toUpperCase().charCodeAt(0), text: out }; }
    if (/[0-9]/.test(ch)) return { key: ch, code: 'Digit' + ch, vk: ch.charCodeAt(0), text: ch };
    return { key: ch, code: '', vk: 0, text: ch };
  }
  return { key, code: key, vk: 0 };
}

// ---------------------------------------------------------------- keyboard
const MODIFIER_KEYS = [
  { flag: 'ctrlKey', key: 'Control', code: 'ControlLeft', vk: 17, bit: 2, label: 'Ctrl' },
  { flag: 'altKey', key: 'Alt', code: 'AltLeft', vk: 18, bit: 1, label: 'Alt' },
  { flag: 'shiftKey', key: 'Shift', code: 'ShiftLeft', vk: 16, bit: 8, label: 'Shift' },
  { flag: 'metaKey', key: 'Meta', code: 'MetaLeft', vk: 91, bit: 4, label: IS_MAC ? 'Cmd' : 'Win' }
];
const MOD_ALIASES = { ctrl: 'ctrlKey', control: 'ctrlKey', ctl: 'ctrlKey', alt: 'altKey', option: 'altKey', opt: 'altKey', shift: 'shiftKey', meta: 'metaKey', cmd: 'metaKey', command: 'metaKey', win: 'metaKey', super: 'metaKey' };
const KEY_ALIASES = { esc: 'Escape', return: 'Enter', del: 'Delete', spacebar: 'Space', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', pgup: 'PageUp', pgdn: 'PageDown', ins: 'Insert', plus: '+' };
for (const name of Object.keys(SPECIAL_KEYS)) KEY_ALIASES[name.toLowerCase()] = name;
// macOS doesn't map editing shortcuts in the renderer, so Cmd+A etc. carry the command.
const EDIT_COMMANDS = { a: 'selectAll', c: 'copy', x: 'cut', v: 'paste', z: 'undo', y: 'redo' };

function noFallbackError(msg) { return Object.assign(new Error(msg), { noFallback: true }); }
function hiddenError(e) { return Object.assign(new Error('tab did not accept input (hidden or busy): ' + e.message), { fallbackOk: true }); }

// "Ctrl+Shift+P", "Cmd+A", "Alt+F4", "Ctrl++", "Enter", "a" -> { key, ctrlKey, ... }
function parseChord(spec, base = {}) {
  const s = String(spec == null ? '' : spec);
  const out = { ctrlKey: !!base.ctrlKey, altKey: !!base.altKey, shiftKey: !!base.shiftKey, metaKey: !!base.metaKey, key: s };
  let parts;
  if (s.length > 1 && s.includes('+')) {
    parts = s.endsWith('++') ? s.slice(0, -2).split('+').concat('+') : s.split('+');
  } else {
    parts = [s];
  }
  const keyPart = parts.pop();
  for (const raw of parts) {
    const flag = MOD_ALIASES[raw.trim().toLowerCase()];
    if (!flag) throw noFallbackError(`Unknown modifier "${raw}" in "${s}" (use Ctrl, Alt, Shift, Meta/Cmd).`);
    out[flag] = true;
  }
  const k = keyPart.length === 1 ? keyPart : keyPart.trim();
  if (k.length === 1) {
    out.key = /[a-z]/i.test(k) ? (out.shiftKey ? k.toUpperCase() : k.toLowerCase()) : k;
  } else {
    out.key = KEY_ALIASES[k.toLowerCase()] || (/^f\d{1,2}$/i.test(k) ? k.toUpperCase() : k);
  }
  return out;
}

function chordLabel(c) {
  const mods = MODIFIER_KEYS.filter((m) => c[m.flag] && m.key !== c.key).map((m) => m.label);
  let k = c.key === ' ' ? 'Space' : c.key;
  if (k.length === 1) k = k.toUpperCase();
  return mods.concat(k).join(' + ');
}

// Fire-and-forget: show the keystroke HUD in the page.
function hud(tabId, label) {
  try {
    chrome.tabs.sendMessage(tabId, { action: 'KEYS_HUD', label: String(label).slice(0, 80) }, () => { void chrome.runtime.lastError; });
  } catch (e) {}
}

function modKeyEvent(m, type, mask) {
  return { type, key: m.key, code: m.code, windowsVirtualKeyCode: m.vk, nativeVirtualKeyCode: m.vk, modifiers: mask };
}

// Press a key (optionally with modifiers) the way a keyboard does: modifiers down,
// key down/up, modifiers up. The first event doubles as the hidden-tab probe.
async function cdpChord(tabId, chord) {
  const d = keyDescriptor(String(chord.key || 'Enter'), !!chord.shiftKey);
  const held = MODIFIER_KEYS.filter((m) => chord[m.flag] && m.key !== d.key);
  const send = (params, label) => timedSend(tabId, 'Input.dispatchKeyEvent', params, null, label);
  let first = true;
  const sendFirst = async (params, label) => {
    try { await send(params, label); } catch (e) { if (first) throw hiddenError(e); throw e; } finally { first = false; }
  };
  let mask = 0;
  const pressed = [];
  try {
    for (const m of held) {
      mask |= m.bit;
      await sendFirst(modKeyEvent(m, 'rawKeyDown', mask), 'key:mod-down');
      pressed.push(m);
    }
    const isChord = !!(chord.ctrlKey || chord.altKey || chord.metaKey);
    const base = { key: d.key, code: d.code, windowsVirtualKeyCode: d.vk, nativeVirtualKeyCode: d.vk, modifiers: mask };
    const down = d.text && !isChord ? { ...base, type: 'keyDown', text: d.text, unmodifiedText: d.text } : { ...base, type: 'rawKeyDown' };
    if (IS_MAC && chord.metaKey && !chord.altKey && !chord.ctrlKey && d.key.length === 1) {
      const cmd = EDIT_COMMANDS[d.key.toLowerCase()];
      if (cmd) down.commands = [cmd === 'undo' && chord.shiftKey ? 'redo' : cmd];
    }
    await sendFirst(down, 'key:down');
    await send({ ...base, type: 'keyUp' }, 'key:up');
  } finally {
    for (const m of pressed.reverse()) {
      mask &= ~m.bit;
      try { await send(modKeyEvent(m, 'keyUp', mask), 'key:mod-up'); } catch (e) {}
    }
  }
}

async function cdpKey(tabId, key, p = {}) {
  return cdpChord(tabId, parseChord(key, p));
}

// Hold modifier keys for the duration of a mouse gesture (shift-click, ctrl-drag...).
async function withHeldModifiers(tabId, p, fn) {
  const held = MODIFIER_KEYS.filter((m) => p[m.flag]);
  if (!held.length) return fn();
  const send = (params, label) => timedSend(tabId, 'Input.dispatchKeyEvent', params, null, label);
  let mask = 0;
  const pressed = [];
  try {
    for (const m of held) {
      mask |= m.bit;
      try { await send(modKeyEvent(m, 'rawKeyDown', mask), 'key:mod-down'); } catch (e) { if (!pressed.length) throw hiddenError(e); throw e; }
      pressed.push(m);
    }
    return await fn();
  } finally {
    for (const m of pressed.reverse()) {
      mask &= ~m.bit;
      try { await send(modKeyEvent(m, 'keyUp', mask), 'key:mod-up'); } catch (e) {}
    }
  }
}

const SHIFTED_CHARS = '~!@#$%^&*()_+{}|:"<>?';

// Human-like typing: one real key event per character with a jittered delay, so
// code editors, autocomplete boxes and keystroke listeners see actual typing.
async function cdpTypeKeystrokes(tabId, text, p = {}) {
  const base = p.delayMs != null ? Math.max(0, Number(p.delayMs)) : 35;
  let typed = 0;
  for (const ch of Array.from(String(text == null ? '' : text))) {
    if (automationStopped) break;
    if (ch === '\r') continue;
    if (ch === '\n') await cdpChord(tabId, { key: 'Enter' });
    else if (ch === '\t') await cdpChord(tabId, { key: 'Tab' });
    else if (/^[\x20-\x7e]$/.test(ch)) await cdpChord(tabId, { key: ch === ' ' ? 'Space' : ch, shiftKey: /[A-Z]/.test(ch) || SHIFTED_CHARS.includes(ch) });
    else await timedSend(tabId, 'Input.insertText', { text: ch }, null, 'insertText');   // emoji, accents, CJK
    typed++;
    if (base) await sleep(Math.max(0, base + (Math.random() * 2 - 1) * base * 0.4));
  }
  return typed;
}

// Bound a CDP call so a stalled input can never hang the bridge; record slow calls.
async function timedSend(tabId, method, params, trace, label, ms = 2500) {
  const t0 = Date.now();
  let timer;
  try {
    return await Promise.race([
      dbgSend(tabId, method, params),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms); })
    ]);
  } finally {
    clearTimeout(timer);
    const dt = Date.now() - t0;
    if (trace && dt > 150) trace.push({ call: label, ms: dt });
  }
}

// ---------------------------------------------------------------- mouse
// Drag with real input. If o.measureEnd is given (drop target off-screen), hold
// the drag at the viewport edge and wheel-scroll until the target shows up.
async function cdpDrag(tabId, o) {
  const trace = [];
  const mouse = (params) => timedSend(tabId, 'Input.dispatchMouseEvent', params, trace, 'mouse:' + params.type);
  const dragEvt = (params) => timedSend(tabId, 'Input.dispatchDragEvent', params, trace, 'drag:' + params.type);
  const btn = MOUSE_BUTTONS[o.button] || MOUSE_BUTTONS.left;
  const modifiers = modifierMask(o);
  const steps = Math.max(5, parseInt(o.steps, 10) || 20);
  const stepDelay = o.stepDelayMs != null ? o.stepDelayMs : 16;    // ~one frame per step for rAF-driven apps
  const { x, y } = o;
  let endX = o.endX;
  let endY = o.endY;

  // Probe first: a hidden tab never acks input. Bail out before any button press.
  try { await mouse({ type: 'mouseMoved', x, y, modifiers }); } catch (e) { throw hiddenError(e); }

  dbgSession.dragData = null;
  let intercepting = false;
  try { await dbgSend(tabId, 'Input.setInterceptDrags', { enabled: true }); intercepting = true; } catch (e) {}

  let html5 = null;
  let aborted = false;
  let scrolls = 0;
  let curX = x;
  let curY = y;
  const moveTo = async (cx, cy) => {
    if (html5) {
      await dragEvt({ type: 'dragOver', x: cx, y: cy, data: html5, modifiers });
    } else {
      await mouse({ type: 'mouseMoved', x: cx, y: cy, button: btn.name, buttons: btn.mask, modifiers });
      // The element was draggable=true: Chrome handed us its native drag payload.
      if (dbgSession.dragData) {
        html5 = dbgSession.dragData;
        await dragEvt({ type: 'dragEnter', x: cx, y: cy, data: html5, modifiers });
      }
    }
    curX = cx;
    curY = cy;
  };
  const glide = async (tx, ty, n) => {
    const sx = curX;
    const sy = curY;
    for (let i = 1; i <= n; i++) {
      if (automationStopped) { aborted = true; return; }
      const cx = sx + (tx - sx) * i / n;
      const cy = sy + (ty - sy) * i / n;
      await moveTo(cx, cy);
      if (i % 2 === 0 || i === n) moveCursor(tabId, cx, cy, 'drag');
      if (stepDelay) await sleep(stepDelay);
    }
  };

  try {
    moveCursor(tabId, x, y, 'drag');
    await mouse({ type: 'mousePressed', x, y, button: btn.name, buttons: btn.mask, clickCount: 1, modifiers });
    await sleep(40);
    if (o.measureEnd && o.vp) {
      const vw = o.vp.w;
      const vh = o.vp.h;
      await glide(x + 6, y + 6, 3);              // arm the drag past libraries' movement threshold
      let target = null;
      for (let i = 0; i < 40 && !aborted; i++) {
        const m = await o.measureEnd();
        if (m && m.inView) { target = m; break; }
        const my = m ? m.y : vh + 1;           // not rendered yet (virtualized list): keep going down
        const mx = m ? m.x : curX;
        const dirY = my >= vh ? 1 : (my < 0 ? -1 : 0);
        const dirX = mx >= vw ? 1 : (mx < 0 ? -1 : 0);
        const ex = dirX > 0 ? vw - 8 : dirX < 0 ? 8 : Math.min(Math.max(curX, 8), vw - 8);
        const ey = dirY > 0 ? vh - 8 : dirY < 0 ? 8 : Math.min(Math.max(curY, 8), vh - 8);
        await glide(ex, ey, 3);
        await mouse({ type: 'mouseWheel', x: ex, y: ey, deltaX: dirX * Math.round(vw * 0.85), deltaY: dirY * Math.round(vh * 0.85), buttons: btn.mask, modifiers });
        scrolls++;
        await sleep(110);
      }
      if (!target && !aborted) throw noFallbackError('Drop target never scrolled into view while dragging.');
      // Wheel scrolling is animated: wait until the target stops moving before aiming.
      for (let k = 0; target && k < 8 && !aborted; k++) {
        await sleep(70);
        const m2 = await o.measureEnd();
        if (!m2 || !m2.inView) break;
        const still = Math.abs(m2.x - target.x) < 2 && Math.abs(m2.y - target.y) < 2;
        target = m2;
        if (still) break;
      }
      if (target) { endX = target.x; endY = target.y; }
    }
    if (!aborted) await glide(endX, endY, steps);
    // Last check before letting go: if the page still shifted, correct the aim.
    if (!aborted && o.measureEnd) {
      const fin = await o.measureEnd();
      if (fin && fin.inView && (Math.abs(fin.x - curX) > 3 || Math.abs(fin.y - curY) > 3)) {
        endX = fin.x; endY = fin.y;
        await glide(endX, endY, 4);
      }
    }
    if (html5) {
      await dragEvt({ type: aborted ? 'dragCancel' : 'drop', x: aborted ? x : endX, y: aborted ? y : endY, data: html5, modifiers });
    }
  } finally {
    // Always release the button, even on error or Stop, so the page isn't left mid-drag.
    try { await mouse({ type: 'mouseReleased', x: curX, y: curY, button: btn.name, buttons: 0, clickCount: 1, modifiers }); } catch (e) {}
    moveCursor(tabId, curX, curY, 'release');
    if (intercepting) { try { await timedSend(tabId, 'Input.setInterceptDrags', { enabled: false }, trace, 'interceptOff'); } catch (e) {} }
    dbgSession.dragData = null;
  }
  const out = { status: aborted ? 'drag_aborted_by_user' : 'dragged', dragMode: html5 ? 'html5-dnd' : 'pointer', steps, end: { x: Math.round(endX), y: Math.round(endY) } };
  if (scrolls) out.autoScrolls = scrolls;
  if (!intercepting) out.html5Interception = false;
  if (trace.length) out.slowCalls = trace;
  return out;
}

async function cdpClick(tabId, x, y, p = {}, clicks = 1) {
  const mouse = (params) => timedSend(tabId, 'Input.dispatchMouseEvent', params, null, 'mouse:' + params.type);
  const btn = MOUSE_BUTTONS[p.button] || MOUSE_BUTTONS.left;
  const modifiers = modifierMask(p);
  moveCursor(tabId, x, y, 'move');
  try { await mouse({ type: 'mouseMoved', x, y, modifiers }); } catch (e) { throw hiddenError(e); }
  await sleep(CURSOR_LEAD_MS);
  moveCursor(tabId, x, y, clicks > 1 ? 'dblclick' : 'click');
  for (let c = 1; c <= clicks; c++) {
    await mouse({ type: 'mousePressed', x, y, button: btn.name, buttons: btn.mask, clickCount: c, modifiers });
    await mouse({ type: 'mouseReleased', x, y, button: btn.name, buttons: 0, clickCount: c, modifiers });
  }
}

// Press and hold (context menus on canvas apps, press-and-hold buttons).
async function cdpLongPress(tabId, x, y, p = {}) {
  const mouse = (params) => timedSend(tabId, 'Input.dispatchMouseEvent', params, null, 'mouse:' + params.type);
  const btn = MOUSE_BUTTONS[p.button] || MOUSE_BUTTONS.left;
  const modifiers = modifierMask(p);
  const holdMs = Math.min(Math.max(parseInt(p.holdMs, 10) || 800, 50), 10000);
  moveCursor(tabId, x, y, 'move');
  try { await mouse({ type: 'mouseMoved', x, y, modifiers }); } catch (e) { throw hiddenError(e); }
  await sleep(CURSOR_LEAD_MS);
  moveCursor(tabId, x, y, 'drag');
  await mouse({ type: 'mousePressed', x, y, button: btn.name, buttons: btn.mask, clickCount: 1, modifiers });
  try {
    await sleep(holdMs);
  } finally {
    try { await mouse({ type: 'mouseReleased', x, y, button: btn.name, buttons: 0, clickCount: 1, modifiers }); } catch (e) {}
    moveCursor(tabId, x, y, 'release');
  }
  return holdMs;
}

// Catmull-Rom spline through the points (or straight segments), sampled evenly.
function samplePath(pts, seg, smooth) {
  const out = [pts[0].slice()];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 1; s <= seg; s++) {
      const t = s / seg;
      if (!smooth) { out.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]); continue; }
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

function normalizePoints(raw) {
  if (!Array.isArray(raw) || raw.length < 2) throw noFallbackError('path needs a "points" array with at least 2 points, e.g. [[100,100],[200,150]].');
  return raw.map((pt, i) => {
    const xy = Array.isArray(pt) ? pt : (pt && typeof pt === 'object' ? [pt.x, pt.y] : null);
    if (!xy || !Number.isFinite(Number(xy[0])) || !Number.isFinite(Number(xy[1]))) throw noFallbackError(`points[${i}] is not an [x, y] pair.`);
    return [Number(xy[0]), Number(xy[1])];
  });
}

// Freehand stroke: press, follow a (smoothed) polyline, release. Signatures, pen
// tools, whiteboards, curved sliders. hold:false just moves along the path.
async function cdpPath(tabId, pts, p = {}) {
  const mouse = (params) => timedSend(tabId, 'Input.dispatchMouseEvent', params, null, 'mouse:' + params.type);
  const btn = MOUSE_BUTTONS[p.button] || MOUSE_BUTTONS.left;
  const modifiers = modifierMask(p);
  const hold = p.hold !== false;
  const smooth = p.smooth !== false && pts.length > 2;
  const seg = Math.min(Math.max(parseInt(p.steps, 10) || 8, 1), 60);
  const stepDelay = p.stepDelayMs != null ? p.stepDelayMs : 12;
  const vp = p._viewport;
  const clamp = (v, max) => (max ? Math.min(Math.max(v, 0), max - 1) : v);
  const samples = samplePath(pts, seg, smooth).map(([sx, sy]) => [Math.round(clamp(sx, vp && vp.w)), Math.round(clamp(sy, vp && vp.h))]);
  const [x0, y0] = samples[0];
  moveCursor(tabId, x0, y0, 'move');
  try { await mouse({ type: 'mouseMoved', x: x0, y: y0, modifiers }); } catch (e) { throw hiddenError(e); }
  await sleep(CURSOR_LEAD_MS);
  let last = samples[0];
  let aborted = false;
  if (hold) await mouse({ type: 'mousePressed', x: x0, y: y0, button: btn.name, buttons: btn.mask, clickCount: 1, modifiers });
  try {
    for (let k = 1; k < samples.length; k++) {
      if (automationStopped) { aborted = true; break; }
      const [sx, sy] = samples[k];
      await mouse(hold ? { type: 'mouseMoved', x: sx, y: sy, button: btn.name, buttons: btn.mask, modifiers } : { type: 'mouseMoved', x: sx, y: sy, modifiers });
      last = samples[k];
      if (k % 2 === 0 || k === samples.length - 1) moveCursor(tabId, sx, sy, hold ? 'drag' : 'move');
      if (stepDelay) await sleep(stepDelay);
    }
  } finally {
    if (hold) {
      try { await mouse({ type: 'mouseReleased', x: last[0], y: last[1], button: btn.name, buttons: 0, clickCount: 1, modifiers }); } catch (e) {}
      moveCursor(tabId, last[0], last[1], 'release');
    }
  }
  return { status: aborted ? 'path_aborted_by_user' : 'path_drawn', points: pts.length, samples: samples.length, smooth, hold };
}

// ---------------------------------------------------------------- touch
// Real touch input (tap, double tap, long press, swipe, pinch). Touch emulation is
// switched on only for the gesture so desktop sites that check for touch support
// respond, then restored.
async function cdpTouch(tabId, kind, p) {
  const send = (type, touchPoints) => timedSend(tabId, 'Input.dispatchTouchEvent', { type, touchPoints, modifiers: 0 }, null, 'touch:' + type);
  const tp = (tx, ty, id) => ({ x: Math.round(tx), y: Math.round(ty), radiusX: 2, radiusY: 2, force: 1, id });
  const steps = Math.min(Math.max(parseInt(p.steps, 10) || 12, 2), 80);
  const stepDelay = p.stepDelayMs != null ? p.stepDelayMs : 16;
  const { x, y } = p;
  let emulated = false;
  if (p.emulateTouch !== false) {
    try { await dbgSend(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); emulated = true; await sleep(40); } catch (e) {}
  }
  let first = true;
  const start = async (pts) => {
    try { await send('touchStart', pts); } catch (e) { if (first) throw hiddenError(e); throw e; } finally { first = false; }
  };
  let touching = false;
  try {
    if (kind === 'tap' || kind === 'doubletap') {
      const n = kind === 'doubletap' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        moveCursor(tabId, x, y, 'click');
        await start([tp(x, y, 0)]); touching = true;
        await sleep(45);
        await send('touchEnd', []); touching = false;
        if (i < n - 1) await sleep(110);
      }
      return { status: kind === 'tap' ? 'tapped' : 'double_tapped', x, y };
    }
    if (kind === 'longpress') {
      const holdMs = Math.min(Math.max(parseInt(p.holdMs, 10) || 800, 50), 10000);
      moveCursor(tabId, x, y, 'drag');
      await start([tp(x, y, 0)]); touching = true;
      await sleep(holdMs);
      await send('touchEnd', []); touching = false;
      moveCursor(tabId, x, y, 'release');
      return { status: 'long_pressed', x, y, holdMs };
    }
    if (kind === 'swipe') {
      const ex = p.endX;
      const ey = p.endY;
      if (ex == null || ey == null) throw noFallbackError('swipe needs endX/endY.');
      moveCursor(tabId, x, y, 'drag');
      await start([tp(x, y, 0)]); touching = true;
      for (let i = 1; i <= steps; i++) {
        const cx = x + (ex - x) * i / steps;
        const cy = y + (ey - y) * i / steps;
        await send('touchMove', [tp(cx, cy, 0)]);
        if (i % 2 === 0 || i === steps) moveCursor(tabId, cx, cy, 'drag');
        if (stepDelay) await sleep(stepDelay);
      }
      await send('touchEnd', []); touching = false;
      moveCursor(tabId, ex, ey, 'release');
      return { status: 'swiped', start: { x, y }, end: { x: ex, y: ey }, steps };
    }
    if (kind === 'pinch') {
      const scale = Number(p.scale) > 0 ? Number(p.scale) : 2;
      const d0 = Number(p.distance) > 10 ? Number(p.distance) : 120;
      const d1 = d0 * scale;
      const at = (d) => [tp(x - d / 2, y, 0), tp(x + d / 2, y, 1)];
      moveCursor(tabId, x, y, 'drag');
      await start(at(d0)); touching = true;
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', at(d0 + (d1 - d0) * i / steps));
        if (stepDelay) await sleep(stepDelay);
      }
      await send('touchEnd', []); touching = false;
      moveCursor(tabId, x, y, 'release');
      return { status: scale >= 1 ? 'pinched_out' : 'pinched_in', center: { x, y }, scale, fromDistance: d0, toDistance: Math.round(d1) };
    }
    throw noFallbackError(`Unknown touch action: ${kind} (use tap, doubletap, longpress, swipe, pinch).`);
  } finally {
    if (touching) { try { await send('touchCancel', []); } catch (e) {} }
    if (emulated && !p.keepTouchEmulation) {
      try { await dbgSend(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: false }); } catch (e) {}
    }
  }
}

// Ask the page-side helpers. Tabs opened before an extension update keep running
// the old content script, which ignores these messages (the port just closes).
// Treat that as "fall back to synthetic" rather than an error.
async function askHelper(action, payload) {
  try {
    return await askContentScript(action, payload);
  } catch (e) {
    if (/port closed|receiving end does not exist|could not establish connection/i.test(String(e && e.message))) {
      throw Object.assign(new Error('this page runs an outdated DevPilot content script; reload the page to enable trusted input'), { fallbackOk: true });
    }
    throw e;
  }
}

// --- trusted handlers (each returns the same shape as its synthetic twin) ---
const TRUSTED_ONLY_MOUSE = new Set(['tripleclick', 'longpress', 'path']);

async function trustedMouseAction(tab, p) {
  const kind = resolveMouseAction(p);
  if (kind === 'path') {
    const pts = normalizePoints(p.points);
    pts.forEach(([px, py], i) => assertInViewport(p, Math.round(px), Math.round(py), `Path point ${i}`));
    return { ...(await withHeldModifiers(tab.id, p, () => cdpPath(tab.id, pts, p))), inputMode: 'trusted' };
  }
  let { x, y, endX, endY } = p;
  let measureEnd = null;
  if (p.selector || p.dropSelector || x == null || y == null) {
    const autoScroll = kind === 'drag' && !!p.dropSelector && p.autoScroll !== false && !!p._viewport;
    const pt = await askHelper('RESOLVE_POINT', { selector: p.selector, dropSelector: p.dropSelector, dropNoScroll: autoScroll, dropOptional: autoScroll, timeoutMs: p.timeoutMs, tabId: tab.id });
    if (pt) {
      if (x == null || y == null) { x = pt.x; y = pt.y; }
      if (pt.endX != null) { endX = pt.endX; endY = pt.endY; }
      if (autoScroll && (pt.endMissing || pt.endInView === false)) {
        measureEnd = async () => {
          const m = await askHelper('RESOLVE_POINT', { dropSelector: p.dropSelector, dropNoScroll: true, dropOptional: true, timeoutMs: 0, tabId: tab.id });
          return m && m.endX != null ? { x: m.endX, y: m.endY, inView: !!m.endInView } : null;
        };
      }
    }
  }
  if (x == null || y == null) throw noFallbackError('mouse_action needs x/y coordinates or a selector.');
  x = Math.round(x); y = Math.round(y);
  const modifiers = modifierMask(p);
  assertInViewport(p, x, y, kind === 'drag' ? 'Drag start' : 'Point');

  if (kind === 'move' || kind === 'hover') {
    moveCursor(tab.id, x, y, 'move');
    await timedSend(tab.id, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers }, null, 'mouse:mouseMoved');
    if (kind === 'hover') {
      const dwellMs = Math.min(Math.max(parseInt(p.dwellMs, 10) || 600, 0), 10000);
      if (dwellMs) await sleep(dwellMs);
      return { status: 'hovered', x, y, dwellMs, inputMode: 'trusted' };
    }
    return { status: 'moved', x, y, inputMode: 'trusted' };
  }
  if (kind === 'click' || kind === 'dblclick' || kind === 'tripleclick') {
    const clicks = kind === 'tripleclick' ? 3 : kind === 'dblclick' ? 2 : 1;
    await withHeldModifiers(tab.id, p, () => cdpClick(tab.id, x, y, p, clicks));
    return { status: { 1: 'clicked', 2: 'double_clicked', 3: 'triple_clicked' }[clicks], button: p.button || 'left', x, y, modifiers: chordLabelMods(p), inputMode: 'trusted' };
  }
  if (kind === 'longpress') {
    const held = await withHeldModifiers(tab.id, p, () => cdpLongPress(tab.id, x, y, p));
    return { status: 'long_pressed', x, y, holdMs: held, inputMode: 'trusted' };
  }
  if (kind === 'scroll') {
    moveCursor(tab.id, x, y, 'move');
    await timedSend(tab.id, 'Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: p.deltaX || 0, deltaY: p.deltaY || 0, modifiers }, null, 'mouse:mouseWheel');
    return { status: 'scrolled', deltaX: p.deltaX || 0, deltaY: p.deltaY || 0, inputMode: 'trusted' };
  }
  if (kind === 'drag') {
    if (!measureEnd) {
      if (endX == null || endY == null) { endX = x + 100; endY = y + 100; }
      endX = Math.round(endX); endY = Math.round(endY);
      assertInViewport(p, endX, endY, 'Drag end');
    }
    const r = await withHeldModifiers(tab.id, p, () => cdpDrag(tab.id, { ...p, x, y, endX, endY, measureEnd, vp: p._viewport }));
    return { ...r, start: { x, y }, inputMode: 'trusted' };
  }
  throw noFallbackError(`Unknown mouse action: ${kind}`);
}

function chordLabelMods(p) {
  const mods = MODIFIER_KEYS.filter((m) => p[m.flag]).map((m) => m.label);
  return mods.length ? mods.join('+') : undefined;
}

async function trustedClickElement(tab, p) {
  const pt = await askHelper('RESOLVE_POINT', { selector: p.selector, timeoutMs: p.timeoutMs, tabId: tab.id });
  // If something covers the element, a real click would land on the cover; keep
  // the old behaviour (dispatch straight on the element) for that case.
  if (!pt || pt.occluded || !pt.w || !pt.h) {
    throw Object.assign(new Error(pt && pt.occluded ? `element is covered by <${pt.occludedBy}>` : 'element has no visible box'), { fallbackOk: true });
  }
  const clicks = Math.min(Math.max(parseInt(p.clicks, 10) || 1, 1), 3);
  await withHeldModifiers(tab.id, p, () => cdpClick(tab.id, pt.x, pt.y, p, clicks));
  return `Element ${p.selector} clicked successfully (trusted input${chordLabelMods(p) ? ', ' + chordLabelMods(p) : ''}).`;
}

async function trustedPressKey(tab, p) {
  const chord = parseChord(p.key || 'Enter', p);
  if (p.selector) await askHelper('FOCUS_ELEMENT', { selector: p.selector, timeoutMs: p.timeoutMs, tabId: tab.id });
  hud(tab.id, chordLabel(chord));
  await cdpChord(tab.id, chord);
  return `Key '${chordLabel(chord)}' pressed successfully (trusted input).`;
}

async function trustedPressKeys(tab, p) {
  const keys = Array.isArray(p.keys) ? p.keys.map(String) : String(p.keys || '').split(',').map((k) => k.trim()).filter(Boolean);
  if (!keys.length) throw noFallbackError('press_keys needs a non-empty "keys" array, e.g. ["Ctrl+A", "Delete"].');
  const chords = keys.map((k) => parseChord(k));          // validate everything before pressing anything
  if (p.selector) await askHelper('FOCUS_ELEMENT', { selector: p.selector, timeoutMs: p.timeoutMs, tabId: tab.id });
  const delay = p.delayMs != null ? Math.max(0, Number(p.delayMs)) : 60;
  const pressed = [];
  for (const c of chords) {
    if (automationStopped) break;
    hud(tab.id, chordLabel(c));
    await cdpChord(tab.id, c);
    pressed.push(chordLabel(c));
    if (delay) await sleep(delay);
  }
  return { status: pressed.length === chords.length ? 'pressed' : 'stopped_by_user', keys: pressed, inputMode: 'trusted' };
}

async function trustedTypeText(tab, p) {
  const f = await askHelper('FOCUS_ELEMENT', { selector: p.selector, timeoutMs: p.timeoutMs, selectAll: !p.append, tabId: tab.id });
  if (f && f.x != null) moveCursor(tab.id, f.x, f.y, 'click');
  const text = String(p.text == null ? '' : p.text);
  hud(tab.id, '⌨ ' + (text.length > 40 ? text.slice(0, 40) + '…' : text));
  if (p.keystrokes) {
    const typed = await cdpTypeKeystrokes(tab.id, text, p);
    return `Typed ${typed} keystrokes into ${p.selector || 'activeElement'} (trusted input).`;
  }
  await timedSend(tab.id, 'Input.insertText', { text }, null, 'insertText'); // replaces the selection
  return `Typed text into ${p.selector || 'activeElement'} (trusted input).`;
}

async function trustedTouch(tab, p) {
  const kind = String(p.subAction || p.touchAction || 'tap').toLowerCase();
  let { x, y, endX, endY } = p;
  if (p.selector || x == null || y == null) {
    const pt = await askHelper('RESOLVE_POINT', { selector: p.selector, dropSelector: p.dropSelector, timeoutMs: p.timeoutMs, tabId: tab.id });
    if (pt) {
      if (x == null || y == null) { x = pt.x; y = pt.y; }
      if (pt.endX != null) { endX = pt.endX; endY = pt.endY; }
    }
  }
  if (x == null || y == null) throw noFallbackError('touch_action needs x/y coordinates or a selector.');
  x = Math.round(x); y = Math.round(y);
  assertInViewport(p, x, y, 'Touch point');
  if (kind === 'swipe' && endX != null && endY != null) { endX = Math.round(endX); endY = Math.round(endY); assertInViewport(p, endX, endY, 'Swipe end'); }
  const r = await cdpTouch(tab.id, kind, { ...p, x, y, endX, endY });
  return { ...r, inputMode: 'trusted' };
}

const TRUSTED_HANDLERS = {
  MOUSE_ACTION: trustedMouseAction,
  CLICK_ELEMENT: trustedClickElement,
  PRESS_KEY: trustedPressKey,
  PRESS_KEYS: trustedPressKeys,
  TYPE_TEXT: trustedTypeText,
  TOUCH_ACTION: trustedTouch
};

// Actions that only exist as real input (no synthetic twin to fall back to).
function isTrustedOnly(action, payload) {
  if (action === 'PRESS_KEYS' || action === 'TOUCH_ACTION') return true;
  if (action === 'TYPE_TEXT' && payload.keystrokes) return true;
  if (action === 'MOUSE_ACTION' && TRUSTED_ONLY_MOUSE.has(resolveMouseAction(payload))) return true;
  return false;
}

// Trusted by default for mouse/click/key; type_text stays on the React-safe
// synthetic path unless trusted:true or keystrokes:true. trusted:false forces the
// old path (where one exists).
async function runInput(action, payload = {}) {
  const trustedOnly = isTrustedOnly(action, payload);
  const wantTrusted = trustedOnly || (action === 'TYPE_TEXT' ? payload.trusted === true : payload.trusted !== false);
  const mouseKind = action === 'MOUSE_ACTION' ? resolveMouseAction(payload) : null;
  const synthPayload = action === 'MOUSE_ACTION' ? { ...payload, subAction: mouseKind === 'hover' ? 'move' : mouseKind } : payload;
  if (!wantTrusted) return askContentScript(action, synthPayload);

  const tab = await resolveTargetTab(payload);
  const decorate = (res, mode, note) => {
    if (res && typeof res === 'object' && !Array.isArray(res)) return { ...res, inputMode: mode, note };
    return typeof res === 'string' ? res + ' [' + mode + ': ' + note + ']' : res;
  };

  // Chrome never acknowledges real input sent to a hidden tab (it would just hang),
  // and we don't steal focus unless the caller opts in with focusTab:true.
  const state = await pageState(tab.id);
  const visible = state ? state.visible : null;
  if (visible === false) {
    if (payload.focusTab) {
      await bringTabToFront(tab);
      const fresh = await pageState(tab.id);
      if (fresh) Object.assign(state, fresh);
    } else {
      // Drags crawl in hidden tabs (timer throttling) and trusted-only gestures have
      // no synthetic twin, so fail fast instead of hanging until the bridge times out.
      if (trustedOnly || mouseKind === 'drag') {
        throw new Error('Tab is hidden: Chrome only delivers real input to a visible tab. Bring the tab to front or pass focusTab:true.');
      }
      const res = await askContentScript(action, { ...synthPayload, tabId: tab.id });
      return decorate(res, 'synthetic-hidden-tab',
        'the tab is not visible, so real input cannot be delivered; used synthetic events (canvas apps may ignore them). Pass focusTab:true to bring it to front and use trusted input.');
    }
  }

  try {
    const viewport = state && state.vw ? { w: state.vw, h: state.vh } : null;
    return await serializeInput(() => TRUSTED_HANDLERS[action](tab, { ...payload, _viewport: viewport }));
  } catch (err) {
    const msg = String((err && err.message) || err);
    // A stall mid-gesture almost always means another window covered Chrome, which
    // stops input delivery. Say so plainly instead of a bare timeout.
    if (/timed out/i.test(msg) && !(err && err.fallbackOk)) {
      const st = await pageState(tab.id);
      if (st && st.visible === false) {
        throw new Error('Tab is not visible: it became hidden during the action (another window covered Chrome), so Chrome stopped delivering input. The gesture was cancelled safely and the mouse button released. Keep Chrome visible (e.g. side by side) and retry.');
      }
    }
    // Only fall back when no trusted input was sent (debugger unavailable, target
    // covered, or the very first event was refused). Falling back mid-sequence
    // would repeat a half-done action.
    if (!(err && (err.attachFailed || err.fallbackOk)) || trustedOnly) throw err;
    const res = await askContentScript(action, { ...synthPayload, tabId: tab.id });
    return decorate(res, 'synthetic-fallback', msg);
  }
}

// File drop onto a drop zone: synthetic DataTransfer events (what drop-zone
// libraries read), no visibility requirement.
async function dropFiles(payload = {}) {
  const tab = await resolveTargetTab(payload);
  if (!Array.isArray(payload.files) || !payload.files.length) throw noFallbackError('drop_files needs at least one file.');
  return askHelper('DROP_FILES', { ...payload, tabId: tab.id });
}

async function pageState(tabId) {
  try {
    const st = await askContentScript('PAGE_STATE', { tabId });
    return st ? { visible: !!st.visible, focused: !!st.focused, vw: st.vw, vh: st.vh, v: st.v || 0 } : null;
  } catch (e) {
    return null;                     // unknown (no content script): let trusted input try
  }
}

// Real input outside the viewport hits nothing (or the browser chrome). Coordinates
// are viewport-relative, so say so instead of silently missing.
function assertInViewport(p, x, y, label) {
  const v = p._viewport;
  if (!v) return;
  if (x < 0 || y < 0 || x >= v.w || y >= v.h) {
    throw Object.assign(new Error(`${label} (${x}, ${y}) is outside the visible viewport (${v.w}x${v.h}). Coordinates are viewport-relative: scroll it into view first, or target it with a selector (auto-scrolls).`), { noFallback: true });
  }
}

// Opt-in only (focusTab:true): make the tab visible so Chrome will accept real input.
async function bringTabToFront(tab) {
  await new Promise((r) => chrome.tabs.update(tab.id, { active: true }, () => { void chrome.runtime.lastError; r(); }));
  const win = await new Promise((r) => chrome.windows.get(tab.windowId, (w) => { void chrome.runtime.lastError; r(w); }));
  const upd = { focused: true };
  if (win && win.state === 'minimized') upd.state = 'normal';   // never un-maximize
  await new Promise((r) => chrome.windows.update(tab.windowId, upd, () => { void chrome.runtime.lastError; r(); }));
  // The OS activates the window asynchronously; a focus change landing mid-gesture
  // makes Chrome drop pointer capture (drag libraries then lose the drag). Wait
  // until the page reports visible + focused before sending any input.
  const t0 = Date.now();
  while (Date.now() - t0 < 1500) {
    await sleep(100);
    const st = await pageState(tab.id);
    if (!st) break;
    if (st.visible && st.focused) break;
  }
  await sleep(150);
}

// Capture a tab's viewport via the DevTools Protocol. Unlike captureVisibleTab,
// this does not require the tab to be active/visible and does not steal focus.
async function captureViaDebugger(tabId, payload = {}) {
  const params = { format: 'png', captureBeyondViewport: !!payload.fullPage };
  const res = await dbgSend(tabId, 'Page.captureScreenshot', params);
  if (!res || !res.data) throw new Error('No screenshot data returned by CDP.');
  return 'data:image/png;base64,' + res.data;
}

async function evaluateViaDebugger(payload) {
  const resolved = await resolveTargetTab(payload);
  const tabId = resolved.id;
  const send = (method, params) => dbgSend(tabId, method, params);

  const code = payload.script || '';
  const hasReturn = /^\s*return\b/m.test(code);
  const exprWrap = `(async () => { ${hasReturn ? code : 'return (' + code + '\n);'} })()`;
  const stmtWrap = `(async () => { ${code} })()`;
  const runEval = async (expression) => send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true, userGesture: true, allowUnsafeEvalBlockedByCSP: true
  });

  {
    let evalRes;
    try {
      evalRes = await runEval(exprWrap);
      if (evalRes && evalRes.exceptionDetails && !hasReturn) evalRes = await runEval(stmtWrap);
    } catch (e) {
      evalRes = await runEval(stmtWrap);
    }
    if (evalRes && evalRes.exceptionDetails) {
      const ex = evalRes.exceptionDetails;
      const text = (ex.exception && (ex.exception.description || ex.exception.value)) || ex.text || 'Script execution error';
      throw new Error(String(text));
    }
    const result = evalRes && evalRes.result ? evalRes.result.value : null;
    return result !== undefined ? result : null;
  }
}

async function askContentScript(action, payload = {}) {
  // Resolve the working tab up front (explicit tabId > sticky tab > active tab),
  // so no command silently follows whatever tab the user switched to.
  const resolvedTab = await resolveTargetTab(payload);
  return new Promise((resolve, reject) => {
    const sendToTab = (tabId, tabUrl) => {
      if (tabUrl && tabUrl.startsWith('chrome://')) {
        return reject(new Error("Cannot access chrome:// pages."));
      }

      chrome.tabs.sendMessage(tabId, { action, ...payload }, (response) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || '';
          if (errMsg.includes('Receiving end does not exist') || errMsg.includes('Could not establish connection')) {
            // Auto-inject content script and retry
            chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                return reject(new Error(`Failed to inject content script: ${chrome.runtime.lastError.message}`));
              }
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { action, ...payload }, (retryRes) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else if (retryRes && retryRes.error) {
                    reject(new Error(retryRes.error));
                  } else {
                    resolve(retryRes ? retryRes.result : null);
                  }
                });
              }, 120);
            });
          } else {
            reject(new Error(errMsg));
          }
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response ? response.result : null);
        }
      });
    };

    sendToTab(resolvedTab.id, resolvedTab.url);
  });
}

// Helper to compile standard HAR 1.2 log
function buildHarLog(tabId, tabTitle, tabUrl, entries) {
  const pageId = `page_${tabId || 1}`;
  const now = new Date().toISOString();
  
  const harPages = [
    {
      startedDateTime: entries.length > 0 ? entries[0].startedDateTime : now,
      id: pageId,
      title: tabTitle || tabUrl || 'DevPilot Recorded Page',
      pageTimings: {
        onContentLoad: -1,
        onLoad: -1
      }
    }
  ];

  const harEntries = entries.map(item => {
    let queryString = [];
    try {
      const parsedUrl = new URL(item.url);
      parsedUrl.searchParams.forEach((val, key) => {
        queryString.push({ name: key, value: val });
      });
    } catch (e) {}

    const reqHeaders = item.requestHeaders || [];
    const resHeaders = item.responseHeaders || [];
    
    let mimeType = 'text/plain';
    let contentLength = -1;
    for (const h of resHeaders) {
      const hn = (h.name || '').toLowerCase();
      if (hn === 'content-type') mimeType = h.value;
      if (hn === 'content-length') contentLength = parseInt(h.value, 10) || -1;
    }

    return {
      pageref: pageId,
      startedDateTime: item.startedDateTime || now,
      time: Math.max(1, Math.round(item.time || 0)),
      request: {
        method: item.method || 'GET',
        url: item.url,
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: reqHeaders,
        queryString,
        headersSize: -1,
        bodySize: item.requestBodySize || -1
      },
      response: {
        status: item.statusCode || 200,
        statusText: item.statusLine ? item.statusLine.replace(/^HTTP\/\d\.\d\s+\d+\s*/, '') : (item.statusCode === 200 ? 'OK' : ''),
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: resHeaders,
        content: {
          size: contentLength > -1 ? contentLength : 0,
          mimeType: mimeType || 'application/octet-stream',
          compression: 0
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: contentLength > -1 ? contentLength : -1
      },
      cache: {},
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: 0,
        wait: Math.max(1, Math.round(item.time || 0)),
        receive: 0,
        ssl: -1
      },
      serverIPAddress: item.ip || ''
    };
  });

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Xtra DevPilot',
        version: '1.0.0'
      },
      pages: harPages,
      entries: harEntries
    }
  };
}

// Intercept network requests natively in the background (with full HAR tracking)
if (chrome.webRequest) {
  // onBeforeRequest
  try {
    chrome.webRequest.onBeforeRequest.addListener((details) => {
      if (details.tabId >= 0) {
        harPendingRequests[details.requestId] = {
          requestId: details.requestId,
          tabId: details.tabId,
          url: details.url,
          method: details.method,
          type: details.type,
          startTime: details.timeStamp,
          startedDateTime: new Date(details.timeStamp).toISOString(),
          requestHeaders: [],
          responseHeaders: []
        };
      }
    }, { urls: ["<all_urls>"] });
  } catch (e) {}

  // onSendHeaders
  try {
    chrome.webRequest.onSendHeaders.addListener((details) => {
      const req = harPendingRequests[details.requestId];
      if (req && details.requestHeaders) {
        req.requestHeaders = details.requestHeaders;
      }
    }, { urls: ["<all_urls>"] }, ["requestHeaders"]);
  } catch (e) {
    try {
      chrome.webRequest.onSendHeaders.addListener((details) => {
        const req = harPendingRequests[details.requestId];
        if (req && details.requestHeaders) {
          req.requestHeaders = details.requestHeaders;
        }
      }, { urls: ["<all_urls>"] });
    } catch (err) {}
  }

  // onHeadersReceived
  try {
    chrome.webRequest.onHeadersReceived.addListener((details) => {
      const req = harPendingRequests[details.requestId];
      if (req) {
        req.statusCode = details.statusCode;
        req.statusLine = details.statusLine;
        if (details.responseHeaders) {
          req.responseHeaders = details.responseHeaders;
        }
      }
    }, { urls: ["<all_urls>"] }, ["responseHeaders"]);
  } catch (e) {
    try {
      chrome.webRequest.onHeadersReceived.addListener((details) => {
        const req = harPendingRequests[details.requestId];
        if (req) {
          req.statusCode = details.statusCode;
          req.statusLine = details.statusLine;
          if (details.responseHeaders) {
            req.responseHeaders = details.responseHeaders;
          }
        }
      }, { urls: ["<all_urls>"] });
    } catch (err) {}
  }

  // onCompleted
  try {
    const handleCompleted = (details) => {
      if (details.tabId >= 0 && (details.type === 'xmlhttprequest' || details.type === 'fetch')) {
        if (!networkLogsByTab[details.tabId]) networkLogsByTab[details.tabId] = [];
        networkLogsByTab[details.tabId].push({
          url: details.url,
          method: details.method,
          status: details.statusCode,
          time: details.timeStamp
        });
        if (networkLogsByTab[details.tabId].length > 100) networkLogsByTab[details.tabId].shift();
      }

      const req = harPendingRequests[details.requestId] || {
        requestId: details.requestId,
        tabId: details.tabId,
        url: details.url,
        method: details.method,
        type: details.type,
        startTime: details.timeStamp,
        startedDateTime: new Date(details.timeStamp).toISOString()
      };
      req.statusCode = details.statusCode || req.statusCode || 200;
      req.statusLine = details.statusLine || req.statusLine || 'HTTP/1.1 200 OK';
      req.time = Math.max(1, details.timeStamp - (req.startTime || details.timeStamp));
      req.ip = details.ip;

      const tabId = details.tabId;
      if (tabId >= 0) {
        if (!harDataByTab[tabId]) harDataByTab[tabId] = [];
        harDataByTab[tabId].push(req);
        if (harDataByTab[tabId].length > 500) harDataByTab[tabId].shift();
      }
      delete harPendingRequests[details.requestId];
    };

    try {
      chrome.webRequest.onCompleted.addListener(handleCompleted, { urls: ["<all_urls>"] }, ["responseHeaders"]);
    } catch (e) {
      chrome.webRequest.onCompleted.addListener(handleCompleted, { urls: ["<all_urls>"] });
    }
  } catch (e) {}

  // onErrorOccurred
  try {
    chrome.webRequest.onErrorOccurred.addListener((details) => {
      if (details.tabId >= 0 && (details.type === 'xmlhttprequest' || details.type === 'fetch')) {
        if (!networkLogsByTab[details.tabId]) networkLogsByTab[details.tabId] = [];
        networkLogsByTab[details.tabId].push({
          url: details.url,
          method: details.method,
          status: 0,
          error: details.error,
          time: details.timeStamp
        });
        if (networkLogsByTab[details.tabId].length > 100) networkLogsByTab[details.tabId].shift();
      }

      const req = harPendingRequests[details.requestId] || {
        requestId: details.requestId,
        tabId: details.tabId,
        url: details.url,
        method: details.method,
        type: details.type,
        startTime: details.timeStamp,
        startedDateTime: new Date(details.timeStamp).toISOString()
      };
      req.statusCode = 0;
      req.error = details.error;
      req.time = Math.max(1, details.timeStamp - (req.startTime || details.timeStamp));

      const tabId = details.tabId;
      if (tabId >= 0) {
        if (!harDataByTab[tabId]) harDataByTab[tabId] = [];
        harDataByTab[tabId].push(req);
        if (harDataByTab[tabId].length > 500) harDataByTab[tabId].shift();
      }
      delete harPendingRequests[details.requestId];
    }, { urls: ["<all_urls>"] });
  } catch (e) {}
}

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'AUTOMATION_STOPPED') {
    automationStopped = true; // aborts an in-flight trusted drag
    return false;
  }

  if (message.action === 'START_SELECTION' && message.tabId) {
    chrome.tabs.sendMessage(message.tabId, { action: 'WAIT_FOR_CLICK' }, (response) => {
      if (response && response.result) {
        const tabId = message.tabId;
        if (!consoleLogsByTab[tabId]) consoleLogsByTab[tabId] = [];
        consoleLogsByTab[tabId].push({
          level: 'info',
          text: `[DevPilot UI Selection]: \n${response.result}`,
          timestamp: Date.now()
        });
        if (consoleLogsByTab[tabId].length > 200) consoleLogsByTab[tabId].shift();
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'MANUAL_SELECTION') {
    const tabId = message.tabId || (sender.tab ? sender.tab.id : null);
    if (tabId) {
      if (!consoleLogsByTab[tabId]) consoleLogsByTab[tabId] = [];
      consoleLogsByTab[tabId].push({
        level: 'info',
        text: `[DevPilot UI Selection]: \n${message.html}`,
        timestamp: Date.now()
      });
      if (consoleLogsByTab[tabId].length > 200) consoleLogsByTab[tabId].shift();
    }
    return true;
  }

  if (message.action === 'RECONNECT') {
    connectWebSocket();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'GET_STATS') {
    const isConnected = socket && socket.readyState === WebSocket.OPEN;
    
    // Count total network logs
    let totalNetwork = 0;
    for (const tab in networkLogsByTab) {
      totalNetwork += networkLogsByTab[tab].length;
    }
    
    // Count total console logs
    let totalConsole = 0;
    for (const tab in consoleLogsByTab) {
      totalConsole += consoleLogsByTab[tab].length;
    }

    sendResponse({ isConnected, totalNetwork, totalConsole });
    return true;
  }

  if (message.type === 'CONSOLE_LOG' && sender.tab) {
    const tabId = sender.tab.id;
    if (!consoleLogsByTab[tabId]) consoleLogsByTab[tabId] = [];
    consoleLogsByTab[tabId].push(message.data);
    if (consoleLogsByTab[tabId].length > 200) consoleLogsByTab[tabId].shift();
  }
});

// Clean up logs when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete networkLogsByTab[tabId];
  delete consoleLogsByTab[tabId];
  delete harDataByTab[tabId];
});

// Keep alive hack for Manifest V3 Service Worker
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'PING' }));
  }
  // Calling a Chrome API resets the idle timer
  if (chrome.runtime && chrome.runtime.getPlatformInfo) {
    chrome.runtime.getPlatformInfo();
  }
}, 20000);
