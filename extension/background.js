let socket = null;
let heartbeatInterval = null;
let networkLogsByTab = {};
let consoleLogsByTab = {};
let harDataByTab = {};
let harPendingRequests = {};

const BRIDGE_URLS = ['ws://127.0.0.1:42819', 'ws://localhost:42819', 'ws://127.0.0.1:42820', 'ws://localhost:42820'];
let bridgeUrlIndex = 0;

function connectWebSocket() {
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
    socket.send(JSON.stringify({ role: 'extension' }));
    
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
  if (!socket || socket.readyState !== WebSocket.OPEN) {
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

function getActiveTabLogs(logsObj) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return resolve([]);
      resolve(logsObj[tabs[0].id] || []);
    });
  });
}

async function handleAction(action, payload = {}) {
  switch (action) {
    case 'OPEN_TAB':
    case 'NAVIGATE':
      return new Promise((resolve, reject) => {
        const url = payload.url || 'https://google.com';
        if (action === 'OPEN_TAB' || payload.newTab) {
          chrome.tabs.create({ url, active: true }, (tab) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve({ tabId: tab.id, url: tab.url, status: tab.status });
          });
        } else if (payload.tabId) {
          chrome.tabs.update(payload.tabId, { url }, (tab) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve({ tabId: tab.id, url: tab.url, status: tab.status });
          });
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return reject(new Error("No active tab found."));
            chrome.tabs.update(tabs[0].id, { url }, (tab) => {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              resolve({ tabId: tab.id, url: tab.url, status: tab.status });
            });
          });
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
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return reject(new Error("No active tab found."));
            resolve(parseTab(tabs[0]));
          });
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
            status: t.status
          })));
        });
      });
    case 'GET_NETWORK_LOGS':
      return await getActiveTabLogs(networkLogsByTab);
    case 'GET_CONSOLE_LOGS':
      return await getActiveTabLogs(consoleLogsByTab);
    case 'GET_DOM':
    case 'GET_CLEAN_DOM':
    case 'GET_AX_TREE':
    case 'BATCH_EXECUTE':
    case 'HIGHLIGHT_ELEMENT':
    case 'WAIT_FOR_CLICK':
    case 'CLICK_ELEMENT':
    case 'TYPE_TEXT':
    case 'PRESS_KEY':
    case 'MOUSE_ACTION':
    case 'UPLOAD_FILE':
    case 'BATCH_FILL_FORM':
    case 'WAIT_FOR_ELEMENT':
    case 'SMART_SELECT_COMBOBOX':
    case 'EXTRACT_JOB_DETAILS':
    case 'EXECUTE_SCRIPT':
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
    case 'DOWNLOAD_PAGE_HTML':
      return await askContentScript('DOWNLOAD_PAGE_HTML', payload);
    case 'TRACE_ACTION': {
      let targetTab = null;
      if (payload.tabId) {
        try { targetTab = await new Promise(r => chrome.tabs.get(payload.tabId, r)); } catch (e) {}
      }
      if (!targetTab) {
        const tabs = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
        targetTab = tabs && tabs.length > 0 ? tabs[0] : null;
      }
      if (!targetTab) throw new Error("No active tab found to trace action.");

      const tabId = targetTab.id;
      const initialHarCount = (harDataByTab[tabId] || []).length;
      const initialNetLogCount = (networkLogsByTab[tabId] || []).length;

      let actionResult = null;
      const actionType = (payload.action || 'click').toLowerCase();
      if (actionType === 'click') {
        actionResult = await askContentScript('CLICK_ELEMENT', { selector: payload.selector, timeoutMs: 3000, tabId });
      } else if (actionType === 'type') {
        actionResult = await askContentScript('TYPE_TEXT', { selector: payload.selector, text: payload.text || '', timeoutMs: 3000, tabId });
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
      let targetTab = null;
      if (payload.tabId) {
        try {
          targetTab = await new Promise(r => chrome.tabs.get(payload.tabId, r));
        } catch (e) {}
      }
      if (!targetTab) {
        const tabs = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
        targetTab = tabs && tabs.length > 0 ? tabs[0] : { id: 1, title: 'Active Tab', url: '' };
      }

      const tabId = targetTab.id;
      const entries = harDataByTab[tabId] || [];
      const harLog = buildHarLog(tabId, targetTab.title, targetTab.url, entries);

      if (payload.clearAfterExport) {
        harDataByTab[tabId] = [];
      }

      return harLog;
    }
    case 'DOWNLOAD_SOURCES': {
      let targetTab = null;
      if (payload.tabId) {
        try {
          targetTab = await new Promise(r => chrome.tabs.get(payload.tabId, r));
        } catch (e) {}
      }
      if (!targetTab) {
        const tabs = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
        targetTab = tabs && tabs.length > 0 ? tabs[0] : null;
      }
      const tabId = targetTab ? targetTab.id : null;

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
    case 'CAPTURE_SCREENSHOT':
      return new Promise((resolve, reject) => {
        const fallbackToContentScript = () => {
          askContentScript('GET_CANVAS_SNAPSHOT', payload)
            .then(dataUrl => resolve(dataUrl))
            .catch(err => reject(err));
        };

        const capture = (windowId) => {
          chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
              return fallbackToContentScript();
            }
            resolve(dataUrl);
          });
        };

        if (payload.tabId) {
          chrome.tabs.get(payload.tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) return capture(null);
            chrome.tabs.update(tab.id, { active: true }, () => {
              chrome.windows.update(tab.windowId, { focused: true }, () => {
                setTimeout(() => capture(tab.windowId), 150);
              });
            });
          });
        } else {
          chrome.windows.getCurrent((win) => {
            const winId = win ? win.id : null;
            if (winId) {
              chrome.windows.update(winId, { focused: true }, () => {
                setTimeout(() => capture(winId), 100);
              });
            } else {
              capture(null);
            }
          });
        }
      });
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

async function askContentScript(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const sendToTab = (tabId, tabUrl) => {
      if (tabUrl && tabUrl.startsWith('chrome://')) {
        return reject(new Error("Cannot access chrome:// pages."));
      }

      chrome.tabs.sendMessage(tabId, { action, ...payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response ? response.result : null);
        }
      });
    };

    if (payload.tabId) {
      chrome.tabs.get(payload.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          return reject(new Error(`Tab with ID ${payload.tabId} not found: ${chrome.runtime.lastError ? chrome.runtime.lastError.message : ''}`));
        }
        sendToTab(tab.id, tab.url);
      });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          return reject(new Error("No active tab found."));
        }
        sendToTab(tabs[0].id, tabs[0].url);
      });
    }
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
