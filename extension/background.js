let socket = null;
let networkLogsByTab = {};
let consoleLogsByTab = {};

const BRIDGE_URLS = ['ws://127.0.0.1:42819', 'ws://localhost:42819'];
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
    setTimeout(connectWebSocket, 3000);
  };
  
  socket.onerror = (error) => {
    console.error("[DevPilot] WebSocket error:", error);
  };
}

// Initial connection
connectWebSocket();

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
    case 'HIGHLIGHT_ELEMENT':
    case 'WAIT_FOR_CLICK':
    case 'CLICK_ELEMENT':
    case 'TYPE_TEXT':
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
        const capture = (windowId) => {
          chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
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

// Intercept network requests natively in the background
if (chrome.webRequest) {
  chrome.webRequest.onCompleted.addListener((details) => {
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
  }, { urls: ["<all_urls>"] });

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
  }, { urls: ["<all_urls>"] });
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
