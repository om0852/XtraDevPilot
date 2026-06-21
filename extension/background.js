let socket = null;
let networkLogsByTab = {};
let consoleLogsByTab = {};

function connectWebSocket() {
  console.log("[DevPilot] Connecting to WebSocket...");
  socket = new WebSocket('ws://localhost:42819');

  socket.onopen = () => {
    console.log("[DevPilot] Connected to IDE Bridge.");
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

async function handleAction(action, payload) {
  switch (action) {
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
    case 'MOCK_NETWORK_RESPONSE':
    case 'CLEAR_NETWORK_MOCKS':
    case 'GET_STORAGE':
    case 'INJECT_CSS':
    case 'TOGGLE_LAYOUT_DEBUG':
    case 'GET_WEB_VITALS':
    case 'RUN_SECURITY_AUDIT':
    case 'RUN_ACCESSIBILITY_AUDIT':
      return await askContentScript(action, payload);
    case 'CAPTURE_SCREENSHOT':
      return new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve(dataUrl);
        });
      });
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        return reject(new Error("No active tab found."));
      }
      const activeTab = tabs[0];
      
      if (activeTab.url.startsWith('chrome://')) {
        return reject(new Error("Cannot access chrome:// pages."));
      }

      chrome.tabs.sendMessage(activeTab.id, { action, ...payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response ? response.result : null);
        }
      });
    });
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
