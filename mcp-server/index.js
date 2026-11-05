#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';
import { reconstructCodebaseFromDirectory } from '../src/reconstruction/sourcemap-unpacker.js';
import { scanEndpoints } from '../src/reconstruction/endpoint-scanner.js';
import { buildReaEvidenceBundle, exportReaEvidenceToFile } from '../src/bridge/rea-exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup WebSocket Server to listen for the Chrome Extension
// Override with XTRADEVPILOT_PORT to run a second bridge (e.g. for tests); the
// extension itself only dials 42819/42820.
const WSS_PORT = parseInt(process.env.XTRADEVPILOT_PORT, 10) || 42819;

let wss = null;
let activeExtensionSocket = null;
const browserSessions = new Map(); // browserId -> { id, sessionId, ws, meta, connectedAt, lastSeen }
const sessionToBrowserId = new Map(); // sessionId -> browserId
let nextBrowserId = 1;
let currentBrowserId = 1;
let messageIdCounter = 1;
const pendingRequests = new Map();

function killPortOccupant(port) {
  try {
    const isWin = process.platform === 'win32';
    if (isWin) {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.split('\n');
      const pidsToKill = new Set();
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (pid && pid !== process.pid) {
            pidsToKill.add(pid);
          }
        }
      }
      for (const pid of pidsToKill) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.error(`[DevPilot Bridge] Terminated stale process PID ${pid} occupying port ${port}.`);
        } catch (e) {}
      }
    } else {
      try {
        execSync(`fuser -k -9 ${port}/tcp`, { stdio: 'ignore' });
      } catch (e) {
        try {
          const pid = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();
          if (pid && parseInt(pid, 10) !== process.pid) {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          }
        } catch (err) {}
      }
    }
  } catch (err) {
    // Port was likely free or command returned non-zero
  }
}

function startWebSocketServer(retryCount = 0) {
  try {
    if (wss) {
      try { wss.close(); } catch (e) {}
    }

    if (retryCount > 0) {
      killPortOccupant(WSS_PORT);
    }

    wss = new WebSocketServer({ port: WSS_PORT, host: '0.0.0.0' });
    console.error(`[DevPilot Bridge] WebSocket Server listening on 0.0.0.0:${WSS_PORT}`);

    wss.on('connection', (ws) => {
      let isExtensionSocket = false;

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          if (data.role === 'extension') {
            isExtensionSocket = true;
            const sessionId = data.sessionId;
            let browserId = ws.browserId;
            if (!browserId && sessionId && sessionToBrowserId.has(sessionId)) {
              browserId = sessionToBrowserId.get(sessionId);
            }
            if (!browserId) {
              browserId = nextBrowserId++;
              if (sessionId) sessionToBrowserId.set(sessionId, browserId);
            }
            ws.browserId = browserId;

            // If an older socket was registered under this browserId, gracefully terminate it
            const existing = browserSessions.get(browserId);
            if (existing && existing.ws !== ws) {
              try { existing.ws.close(); } catch (e) {}
            }

            browserSessions.set(ws.browserId, {
              id: ws.browserId,
              sessionId,
              ws,
              connectedAt: existing ? existing.connectedAt : Date.now(),
              lastSeen: Date.now(),
              meta: data.meta || {}
            });
            activeExtensionSocket = ws;
            if (!currentBrowserId || !browserSessions.has(currentBrowserId)) {
              currentBrowserId = ws.browserId;
            }
            console.error(`[DevPilot Bridge] Browser #${ws.browserId} connected on port ${WSS_PORT}. Total active browsers: ${browserSessions.size}`);
            return;
          }
          
          if (data.type === 'PING') {
            if (ws.browserId && browserSessions.has(ws.browserId)) {
              browserSessions.get(ws.browserId).lastSeen = Date.now();
            }
            return; // Ignore keep-alive pings
          }
          
          if (data.id && pendingRequests.has(data.id)) {
            const { resolve, reject } = pendingRequests.get(data.id);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.result);
            }
            pendingRequests.delete(data.id);
            return;
          }
          
          if (data.id && data.action) {
            try {
              let result;
              if (data.action === 'LIST_BROWSERS') {
                const browsers = [];
                for (const [id, session] of browserSessions.entries()) {
                  if (session.ws.readyState === 1) {
                    let activeTab = null;
                    try {
                      activeTab = await askExtension('GET_TAB_INFO', { browserId: id, timeoutMs: 2000 });
                    } catch (e) {}
                    browsers.push({
                      browserId: id,
                      active: id === currentBrowserId,
                      title: activeTab?.title || 'Unknown Tab',
                      url: activeTab?.url || '',
                      dimensions: activeTab ? `${activeTab.width}x${activeTab.height}` : undefined,
                      connectedAt: new Date(session.connectedAt).toISOString(),
                      lastSeen: new Date(session.lastSeen).toISOString(),
                      meta: session.meta || {}
                    });
                  }
                }
                result = browsers;
              } else if (data.action === 'SWITCH_BROWSER') {
                const targetId = parseInt(data.browserId, 10);
                if (!browserSessions.has(targetId) || browserSessions.get(targetId).ws.readyState !== 1) {
                  throw new Error(`Browser #${targetId} is not connected.`);
                }
                currentBrowserId = targetId;
                result = { success: true, currentBrowserId: targetId };
              } else {
                result = await askExtension(data.action, data);
              }
              ws.send(JSON.stringify({ id: data.id, result }));
            } catch (err) {
              ws.send(JSON.stringify({ id: data.id, error: err.message }));
            }
            return;
          }
        } catch (e) {
          console.error(`[DevPilot Bridge] Failed to parse WebSocket message:`, e);
        }
      });

      ws.on('close', () => {
        if (ws.browserId) {
          const current = browserSessions.get(ws.browserId);
          if (current && current.ws === ws) {
            browserSessions.delete(ws.browserId);
            console.error(`[DevPilot Bridge] Browser #${ws.browserId} disconnected. Remaining active: ${browserSessions.size}`);
            if (currentBrowserId === ws.browserId) {
              const alive = Array.from(browserSessions.keys()).filter(id => browserSessions.get(id).ws.readyState === 1);
              currentBrowserId = alive.length > 0 ? alive[0] : null;
            }
          }
        }
        if (activeExtensionSocket === ws) {
          activeExtensionSocket = null;
        }
      });

      ws.on('error', (err) => {
        console.error(`[DevPilot Bridge] Extension socket error: ${err.message}`);
      });
    });

    wss.on('error', (err) => {
      console.error(`[DevPilot Bridge] WebSocket Server error: ${err.message}`);
      if (err.code === 'EADDRINUSE') {
        if (retryCount < 3) {
          console.error(`[DevPilot Bridge] Port ${WSS_PORT} is in use. Forcibly clearing stale occupant...`);
          killPortOccupant(WSS_PORT);
          setTimeout(() => startWebSocketServer(retryCount + 1), 500);
        } else {
          console.error(`[DevPilot Bridge] Port ${WSS_PORT} remains unavailable after retries.`);
        }
      }
    });
  } catch (err) {
    if (err.code === 'EADDRINUSE' && retryCount < 3) {
      killPortOccupant(WSS_PORT);
      setTimeout(() => startWebSocketServer(retryCount + 1), 500);
    } else {
      console.error(`[DevPilot Bridge] Failed to start WebSocketServer: ${err.message}`);
    }
  }
}

startWebSocketServer();

async function askExtension(action, payload = {}) {
  // 1. Resolve target browser socket (explicit browserId or currentBrowserId)
  let targetId = payload.browserId !== undefined ? parseInt(payload.browserId, 10) : currentBrowserId;
  let targetSession = browserSessions.get(targetId);

  // 2. If target session is not found or dead, pick the first active session
  if (!targetSession || targetSession.ws.readyState !== 1) {
    for (const [id, session] of browserSessions.entries()) {
      if (session.ws.readyState === 1) {
        targetSession = session;
        currentBrowserId = id;
        break;
      }
    }
  }

  const targetSocket = targetSession ? targetSession.ws : activeExtensionSocket;

  if (!targetSocket || targetSocket.readyState !== 1) {
    throw new Error("No Chrome browser is currently connected to the bridge. Ensure the extension is installed and loaded in your active browser.");
  }

  const id = messageIdCounter++;
  
  return new Promise((resolve, reject) => {
    let timeoutMs = 15000;
    if (action === 'WAIT_FOR_CLICK') timeoutMs = 60000;
    else if (action === 'DOWNLOAD_SOURCES') timeoutMs = 90000;
    else if (action === 'EXPORT_HAR') timeoutMs = 30000;
    else if (payload.timeoutMs) timeoutMs = payload.timeoutMs + 5000;
    else if (action === 'BATCH_FILL_FORM') timeoutMs = 30000;
    else if (action === 'UPLOAD_FILE') timeoutMs = 20000;

    // Long-running input gestures (holds, paths, auto-scroll drags, typing).
    const LONG_INPUT = { MOUSE_ACTION: 30000, TOUCH_ACTION: 30000, PRESS_KEYS: 30000, DROP_FILES: 30000 };
    if (LONG_INPUT[action]) timeoutMs = Math.max(timeoutMs, LONG_INPUT[action] + (payload.timeoutMs || 0));
    if (action === 'TYPE_TEXT' && payload.keystrokes) {
      const per = (payload.delayMs != null ? Number(payload.delayMs) : 35) + 60;
      timeoutMs = Math.max(timeoutMs, String(payload.text || '').length * per + 8000);
    }

    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timeout waiting for extension to respond to action: ${action}`));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (result) => { clearTimeout(timeout); resolve(result); },
      reject: (err) => { clearTimeout(timeout); reject(err); }
    });

    // The wire format uses `action` for the command name, so a tool's own `action`
    // argument (mouse_action's click/drag, trace_action_network's click/type) would
    // be silently overwritten. Ship it as `subAction` instead.
    const { action: subAction, ...rest } = payload;
    const wire = subAction !== undefined ? { ...rest, subAction } : rest;
    targetSocket.send(JSON.stringify({ ...wire, action, id }));
  });
}

// Shared help text for selector / modifier parameters of the input tools.
const SEL_DOC = 'Selector: CSS, or text=Save / text*=Sav (visible text, aria-label, title, placeholder), iframe#id >>> inner (same-origin iframes, chainable), and append " >> nth=N" to pick the Nth match.';
const MOD_PROPS = {
  shiftKey: { type: 'boolean', description: 'Hold Shift during the action (e.g. range select)' },
  ctrlKey: { type: 'boolean', description: 'Hold Ctrl during the action (e.g. multi-select, open in new tab)' },
  altKey: { type: 'boolean', description: 'Hold Alt/Option during the action (e.g. duplicate-drag in design tools)' },
  metaKey: { type: 'boolean', description: 'Hold Meta/Cmd during the action' }
};
const TRUSTED_PROP = { type: 'boolean', description: 'Use real browser-level input via the DevTools protocol (isTrusted events, real pointer capture and hit-testing). Default true; set false to force the legacy synthetic DOM events.' };
const FOCUS_PROP = { type: 'boolean', description: 'Real input can only reach a visible tab. If the target tab is hidden, true brings it to front first; default false keeps your focus (clicks/keys then use synthetic events, gestures fail with TAB_HIDDEN).' };
const DROP_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json', '.md': 'text/markdown', '.html': 'text/html',
  '.zip': 'application/zip', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

const server = new Server(
  {
    name: 'devpilot-bridge',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_browsers',
        description: 'Lists all connected browser windows/profiles connected to the single bridge port 42819 with their active tab and session IDs.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'switch_browser',
        description: 'Switch active target browser window by browserId (1, 2, ...) so subsequent MCP actions target that specific browser.',
        inputSchema: {
          type: 'object',
          properties: {
            browserId: { type: 'number', description: 'Target browser ID to activate' }
          },
          required: ['browserId']
        },
      },
      {
        name: 'open_tab',
        description: 'Opens a new browser tab and navigates to the URL. The new tab becomes the sticky "working tab" that later commands target by default, so the user switching tabs never redirects automation. Set background:true to open it without stealing focus from the user.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Target URL to open in a new tab (e.g. "https://google.com")' },
            background: { type: 'boolean', description: 'Open in the background without activating/focusing it (default false).' }
          },
          required: ['url']
        },
      },
      {
        name: 'navigate',
        description: 'Navigates a tab to the URL. With no tabId it navigates the sticky "working tab" DevPilot is operating on — NOT whatever tab the user currently has focused — so it never hijacks the user\'s active tab. The navigated tab becomes the working tab.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Target URL to navigate to' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID. When set, it becomes the working tab.' }
          },
          required: ['url']
        },
      },
      {
        name: 'list_tabs',
        description: 'Lists all open Chrome tabs with their tab IDs, titles, URLs, active status, and a "working" flag marking the sticky tab DevPilot targets by default.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_tab_info',
        description: 'Get metadata (title, URL, dimensions, favicon, status) of the active or specified Chrome browser tab.',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        },
      },
      {
        name: 'get_dom_snapshot',
        description: 'Get the current HTML structure (DOM) of the browser tab. Use this to inspect the page layout.',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        },
      },
      {
        name: 'get_clean_dom_snapshot',
        description: 'Get an LLM-optimized HTML structure of the browser tab. Strips out bloated classes, styles, scripts, and SVGs to save tokens. Optionally targets a specific subtree using rootSelector.',
        inputSchema: {
          type: 'object',
          properties: {
            rootSelector: { type: 'string', description: 'Optional CSS selector to scope the cleaned DOM subtree (e.g. "form" or "#main-content")' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        },
      },
      {
        name: 'get_ax_tree',
        description: 'Get an ultra-compact ARIA Accessibility Tree representation of the page with indexed node handles. Reduces token usage by up to 95%.',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        },
      },
      {
        name: 'batch_execute',
        description: 'Executes an array of sequential browser actions (e.g. click, type, select) in a single high-speed payload roundtrip.',
        inputSchema: {
          type: 'object',
          properties: {
            actions: {
              type: 'array',
              items: { type: 'object' },
              description: 'List of action steps (e.g. [{ action: "CLICK_ELEMENT", selector: "#btn" }])'
            },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['actions']
        },
      },
      {
        name: 'upload_file',
        description: 'Uploads a local file (e.g. Resume PDF, DOCX) to a file input or drag-and-drop upload zone on the webpage.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Absolute or workspace-relative path to the local file (e.g. "Om_Salunke_Resume_AI_SDE.pdf")' },
            selector: { type: 'string', description: 'CSS selector of the file input (defaults to "input[type=\'file\']")' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['filePath']
        },
      },
      {
        name: 'batch_fill_form',
        description: 'Fills multiple form fields in a single rapid roundtrip. Handles text inputs (with React-compatible setters), dropdowns, checkboxes, and radio buttons.',
        inputSchema: {
          type: 'object',
          properties: {
            actions: {
              type: 'array',
              description: 'Array of actions to execute sequentially on the form',
              items: {
                type: 'object',
                properties: {
                  selector: { type: 'string', description: 'CSS selector or element ID (e.g. "cntryFields.legalFirstName")' },
                  value: { type: 'string', description: 'Text to type or select option value/text' },
                  action: { type: 'string', enum: ['type', 'select', 'click', 'check', 'uncheck'], description: 'Action to perform (default: type)' },
                  waitMs: { type: 'number', description: 'Optional delay in milliseconds before this field action' }
                },
                required: ['selector']
              }
            },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['actions']
        },
      },
      {
        name: 'wait_for_element',
        description: 'Waits for an element matching selector to appear, become visible, or be detached from the DOM.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector of the element' },
            timeoutMs: { type: 'number', description: 'Maximum time to wait in ms (default: 5000)' },
            state: { type: 'string', enum: ['visible', 'attached', 'detached'], description: 'State to wait for (default: visible)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['selector']
        },
      },
      {
        name: 'smart_select_combobox',
        description: 'Selects an option from modern searchable custom dropdowns (Workday, Greenhouse, ARIA comboboxes, Phenom dropdowns).',
        inputSchema: {
          type: 'object',
          properties: {
            triggerSelector: { type: 'string', description: 'CSS selector for the combobox trigger button/container' },
            optionText: { type: 'string', description: 'Text of the dropdown option to select (case-insensitive)' },
            searchQuery: { type: 'string', description: 'Optional search text to type into the combobox search input' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['triggerSelector', 'optionText']
        },
      },
      {
        name: 'extract_job_details',
        description: 'Extracts structured job posting details (title, company, location, requisition ID, ATS platform, description summary, apply URL) from the current job page.',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        },
      },
      {
        name: 'click_element',
        description: 'Clicks an element with real (trusted) browser input, so it also works on canvas apps and strict UI frameworks. Waits up to timeoutMs, scrolls it into view (also inside same-origin iframes) and falls back to a direct synthetic click if the element is covered or the debugger is unavailable. Modifier flags give Shift-click range select, Ctrl-click multi-select / open in new tab. ' + SEL_DOC,
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Element selector. ' + SEL_DOC },
            button: { type: 'string', enum: ['left', 'middle', 'right'], description: 'Mouse button (default left)' },
            clicks: { type: 'number', description: '1 = click, 2 = double click, 3 = triple click (default 1)' },
            ...MOD_PROPS,
            timeoutMs: { type: 'number', description: 'Optional wait timeout in ms (default: 3000)' },
            trusted: TRUSTED_PROP,
            focusTab: FOCUS_PROP,
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['selector']
        },
      },
      {
        name: 'click_text',
        description: 'Clicks the element showing the given visible text (or aria-label / title / placeholder) without needing a CSS selector, e.g. "Sign in", "Rectangle", "Add to cart". Exact matches and clickable elements (buttons, links, menu items) win; otherwise the most specific element containing the text. Same real-input behaviour as click_element.',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Visible text to find (case and whitespace insensitive)' },
            contains: { type: 'boolean', description: 'Rank purely by "contains" instead of preferring exact matches (default false)' },
            nth: { type: 'number', description: 'Pick the Nth match, 0-based (default 0)' },
            within: { type: 'string', description: 'Optional iframe chain to search inside, e.g. "iframe#editor" (same-origin)' },
            button: { type: 'string', enum: ['left', 'middle', 'right'], description: 'Mouse button (default left)' },
            clicks: { type: 'number', description: '1 = click, 2 = double click, 3 = triple click (default 1)' },
            ...MOD_PROPS,
            timeoutMs: { type: 'number', description: 'Optional wait timeout in ms (default: 3000)' },
            trusted: TRUSTED_PROP,
            focusTab: FOCUS_PROP,
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['text']
        },
      },
      {
        name: 'type_text',
        description: 'Types text into an input, textarea or contenteditable. Default: React-compatible value setters (replaces the value). trusted:true types with real browser text input (Input.insertText). keystrokes:true types it like a person, one real key event per character with small random delays, for code editors (Monaco, CodeMirror), Google Docs, autocomplete boxes and anything listening to keydown. append:true keeps existing text.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Field selector (defaults to the focused element). ' + SEL_DOC },
            text: { type: 'string' },
            trusted: { type: 'boolean', description: 'Type via real browser text input instead of value setters (default false for this tool).' },
            keystrokes: { type: 'boolean', description: 'Type character by character with real key events (implies trusted).' },
            delayMs: { type: 'number', description: 'With keystrokes: average delay between keys in ms (default 35, jittered).' },
            append: { type: 'boolean', description: 'With trusted/keystrokes: keep existing text and type at the caret instead of replacing it.' },
            focusTab: FOCUS_PROP,
            timeoutMs: { type: 'number', description: 'Optional wait timeout in ms (default: 3000)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['text']
        },
      },
      {
        name: 'press_key',
        description: 'Presses one key or chord with real (trusted) keyboard input, shown in the on-page keystroke HUD. Accepts chord strings like "Ctrl+Shift+P", "Cmd+A", "Alt+F4", "Shift+Tab", "Ctrl++", named keys (Enter, Tab, Escape, Backspace, Delete, Space, Arrow*, Home, End, PageUp/Down, F1-F12) or any single character (e.g. "r" for an editor shortcut). The modifier flags are merged with the chord.',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Key or chord, e.g. "Enter", "a", "Ctrl+Shift+P"' },
            selector: { type: 'string', description: 'Optional element to focus first (defaults to the focused element). ' + SEL_DOC },
            ...MOD_PROPS,
            trusted: TRUSTED_PROP,
            focusTab: FOCUS_PROP,
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['key']
        },
      },
      {
        name: 'press_keys',
        description: 'Presses a sequence of keys / chords in order with real keyboard input, e.g. ["Ctrl+A", "Delete"] or ["ArrowDown", "ArrowDown", "Enter"]. Every entry is validated before anything is pressed. Optional selector focuses a field first. Each chord shows in the on-page keystroke HUD.',
        inputSchema: {
          type: 'object',
          properties: {
            keys: { type: 'array', items: { type: 'string' }, description: 'Keys or chords, pressed in order' },
            selector: { type: 'string', description: 'Optional element to focus first. ' + SEL_DOC },
            delayMs: { type: 'number', description: 'Pause between keys in ms (default 60)' },
            focusTab: FOCUS_PROP,
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['keys']
        },
      },
      {
        name: 'mouse_action',
        description: 'Mouse controller with real (trusted) browser input, at viewport coordinates or on selectors, shown by the overlay cursor. Actions: click, dblclick, tripleclick (select a paragraph), move, hover (move + dwell for tooltips/menus), longpress (press and hold), drag, path (freehand stroke through points: signatures, pen tools, whiteboards, curved sliders) and scroll (wheel). Drags work on canvas apps and native HTML5 drag-and-drop; with dropSelector an off-screen target is reached by holding at the viewport edge and auto-scrolling. Modifier flags give Shift/Ctrl/Alt clicks and drags.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['click', 'dblclick', 'tripleclick', 'move', 'hover', 'longpress', 'drag', 'path', 'scroll'], description: 'Mouse action type' },
            x: { type: 'number', description: 'Target X coordinate (viewport pixels)' },
            y: { type: 'number', description: 'Target Y coordinate (viewport pixels)' },
            endX: { type: 'number', description: 'End X coordinate for drag' },
            endY: { type: 'number', description: 'End Y coordinate for drag' },
            selector: { type: 'string', description: 'Target element (instead of x/y). ' + SEL_DOC },
            dropSelector: { type: 'string', description: 'Drop destination for drag; off-screen targets are reached by auto-scrolling.' },
            points: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'For path: [[x, y], ...] viewport points, at least 2' },
            smooth: { type: 'boolean', description: 'For path: draw a smooth curve through the points (default true when 3+ points)' },
            hold: { type: 'boolean', description: 'For path: hold the button down while moving (default true); false just traces the path' },
            holdMs: { type: 'number', description: 'For longpress: how long to hold in ms (default 800)' },
            dwellMs: { type: 'number', description: 'For hover: how long to stay in ms (default 600)' },
            autoScroll: { type: 'boolean', description: 'For drag with dropSelector: auto-scroll to an off-screen target (default true)' },
            steps: { type: 'number', description: 'Interpolation steps: per drag (default 20) or per path segment (default 8)' },
            stepDelayMs: { type: 'number', description: 'Delay between steps in ms (default 16 for drag, 12 for path)' },
            button: { type: 'string', enum: ['left', 'middle', 'right'], description: 'Mouse button (default: left)' },
            deltaX: { type: 'number', description: 'Horizontal scroll delta for scroll action' },
            deltaY: { type: 'number', description: 'Vertical scroll delta for scroll action' },
            ...MOD_PROPS,
            trusted: TRUSTED_PROP,
            focusTab: FOCUS_PROP,
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['action']
        },
      },
      {
        name: 'touch_action',
        description: 'Real touch input via the DevTools protocol: tap, doubletap, longpress, swipe (x,y to endX,endY) and pinch (two fingers around x,y; scale > 1 zooms in, < 1 zooms out). Touch emulation is switched on just for the gesture so touch-only handlers respond. For mobile sites, maps, carousels and swipeable UIs.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['tap', 'doubletap', 'longpress', 'swipe', 'pinch'], description: 'Gesture' },
            x: { type: 'number', description: 'X (viewport px); for pinch the centre' },
            y: { type: 'number', description: 'Y (viewport px); for pinch the centre' },
            selector: { type: 'string', description: 'Target element instead of x/y. ' + SEL_DOC },
            endX: { type: 'number', description: 'Swipe end X' },
            endY: { type: 'number', description: 'Swipe end Y' },
            scale: { type: 'number', description: 'Pinch scale factor (default 2)' },
            distance: { type: 'number', description: 'Pinch starting finger distance in px (default 120)' },
            holdMs: { type: 'number', description: 'Longpress duration in ms (default 800)' },
            steps: { type: 'number', description: 'Move steps for swipe/pinch (default 12)' },
            stepDelayMs: { type: 'number', description: 'Delay between steps in ms (default 16)' },
            focusTab: FOCUS_PROP,
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['action']
        },
      },
      {
        name: 'drop_files',
        description: 'Drops real files from disk onto a drop zone that has no <input type=file> (Gmail/Drive-style uploaders, react-dropzone, Dropzone.js) by firing dragenter / dragover / drop with a DataTransfer holding the files. result.accepted is true when the page handled the drop. Use upload_file instead when there is a file input.',
        inputSchema: {
          type: 'object',
          properties: {
            filePaths: { type: 'array', items: { type: 'string' }, description: 'Absolute (or cwd-relative) file paths, 25 MB total max' },
            selector: { type: 'string', description: 'Drop zone element. ' + SEL_DOC },
            x: { type: 'number', description: 'Drop point X instead of a selector' },
            y: { type: 'number', description: 'Drop point Y instead of a selector' },
            timeoutMs: { type: 'number', description: 'Optional wait for the drop zone in ms (default 3000)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['filePaths']
        },
      },
      {
        name: 'highlight_element',
        description: 'Visually highlight an element on the user screen and scroll to it.',
        inputSchema: { 
          type: 'object', 
          properties: {
            selector: { type: 'string', description: 'CSS selector of the element to highlight' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['selector']
        },
      },
      {
        name: 'wait_for_user_click',
        description: 'Enters "Select Mode" (Pencil Button). Pauses execution until the user clicks an element in the browser. Returns a JSON string containing the clean HTML, original CSS classes, computed CSS styles, and inline JS events of the clicked element.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'capture_screenshot',
        description: 'Captures a screenshot of the working tab (or tabId if given) and returns the absolute image path. Uses the DevTools protocol so it captures the tab WITHOUT activating it or stealing window focus, and works even when the tab is in the background (no more blank captures).',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional target Chrome tab ID (defaults to the sticky working tab)' },
            fullPage: { type: 'boolean', description: 'Capture the full page beyond the viewport (default false).' },
            outputPath: { type: 'string', description: 'Optional absolute file path to save screenshot (default: .devpilot-screenshot.png in CWD)' }
          }
        },
      },
      {
        name: 'mock_network_response',
        description: 'Mocks network fetch requests matching a URL pattern with a fake JSON response. Ideal for testing UI without a backend.',
        inputSchema: { 
          type: 'object', 
          properties: { 
            urlPattern: { type: 'string', description: 'String to match against the fetch URL (e.g. "/api/users")' },
            responseBody: { type: 'string', description: 'JSON string of the fake response body' },
            status: { type: 'number', description: 'HTTP status code (default: 200)' }
          },
          required: ['urlPattern', 'responseBody']
        },
      },
      {
        name: 'clear_network_mocks',
        description: 'Clears all active network mocks.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'inject_css',
        description: 'Injects a raw CSS string dynamically into the active browser tab without reloading. Useful for live design tweaks and testing visual fixes.',
        inputSchema: { 
          type: 'object', 
          properties: { cssString: { type: 'string', description: 'Raw CSS to inject (e.g. "body { background: red; }")' } },
          required: ['cssString']
        },
      },
      {
        name: 'toggle_layout_debug_mode',
        description: 'Toggles a red outline on all elements on the active browser tab to instantly reveal layout boundaries, margins, and overflow issues.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_web_vitals',
        description: 'Extracts Core Web Vitals metrics (LCP, CLS, FCP) from the active browser tab. Use this to audit and optimize page load performance.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'run_security_audit',
        description: 'Scans the active browser tab for basic security flaws, including insecure HTTP protocols, insecure forms, and plain-text JWTs or secrets in LocalStorage.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'run_accessibility_audit',
        description: 'Scans the active browser tab for accessibility (a11y) issues. Checks for missing alt tags, missing aria-labels on buttons/links, and incorrect heading hierarchies.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'set_viewport_size',
        description: "Resizes the user's Chrome window to test responsive design breakpoints (e.g. mobile, tablet, desktop).",
        inputSchema: { 
          type: 'object', 
          properties: { 
            width: { type: 'number', description: 'Window width in pixels (e.g. 375 for mobile, 1024 for desktop)' },
            height: { type: 'number', description: 'Window height in pixels (e.g. 812)' }
          },
          required: ['width', 'height']
        },
      },
      {
        name: 'get_network_logs',
        description: 'Get recent network requests made by the active browser tab. Use this to debug failed API calls, 404s, or inspect payloads.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_console_logs',
        description: 'Get recent console logs (errors, warnings, info) from the active browser tab. Use this to see Javascript errors.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_storage',
        description: 'Get the local storage and session storage data of the active browser tab. Use this to check auth tokens or saved user state.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'execute_script',
        description: 'Executes arbitrary JavaScript in the webpage context and returns the evaluated result. Supports async functions and promises. Ideal for inspecting React/Vue/Redux stores, window globals, or triggering custom events.',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'JavaScript code/expression to evaluate (e.g. "window.__REDUX_STORE__?.getState()" or "document.title")' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['script']
        },
      },
      {
        name: 'scroll_page',
        description: 'Scrolls the page or a scrollable container. Supports directional scrolling, exact pixel amounts, and scrolling to specific elements.',
        inputSchema: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['down', 'up', 'top', 'bottom'], description: 'Direction to scroll (default: down)' },
            amount: { type: 'number', description: 'Pixel distance to scroll (default: 500)' },
            scrollToSelector: { type: 'string', description: 'Optional selector to scroll into view' },
            containerSelector: { type: 'string', description: 'Optional selector of a scrollable inner container (defaults to window)' },
            smooth: { type: 'boolean', description: 'Whether to use smooth scrolling (default: true)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        },
      },
      {
        name: 'extract_structured_data',
        description: 'Extracts structured data from HTML tables, lists, or repeated card grids into clean JSON. Ideal for scraping dashboards, financial data, and product lists.',
        inputSchema: {
          type: 'object',
          properties: {
            targetSelector: { type: 'string', description: 'CSS selector of the table, list, or container element' },
            type: { type: 'string', enum: ['auto', 'table', 'cards', 'list'], description: 'Data structure type (default: auto)' },
            itemSelector: { type: 'string', description: 'Optional CSS selector for items within a card grid (e.g. ".product-card")' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        },
      },
      {
        name: 'manage_storage_and_cookies',
        description: 'Inspects, sets, or clears browser cookies, localStorage, and sessionStorage. Ideal for switching user sessions, mocking auth JWTs, or resetting test state.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['cookie', 'local_storage', 'session_storage'], description: 'Target storage type' },
            operation: { type: 'string', enum: ['get', 'get_all', 'set', 'remove', 'clear'], description: 'Operation to perform' },
            name: { type: 'string', description: 'Cookie name or storage key' },
            value: { type: 'string', description: 'Value to set' },
            url: { type: 'string', description: 'URL for cookie operations' },
            domain: { type: 'string', description: 'Domain for cookie operations' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['type', 'operation']
        },
      },
      {
        name: 'assert_element_state',
        description: 'QA assertion tool to verify element conditions (visibility, enabled/disabled state, text content, attribute values) with deterministic pass/fail reporting.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector of the element to assert' },
            condition: { type: 'string', enum: ['is_visible', 'is_hidden', 'is_enabled', 'is_disabled', 'contains_text', 'has_value', 'has_attribute'], description: 'Assertion condition' },
            expected: { type: 'string', description: 'Expected text, value, or attribute name (required for contains_text, has_value, has_attribute)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['selector', 'condition']
        },
      },
      {
        name: 'record_user_flow',
        description: 'Records user clicks, inputs, and navigations in the browser and compiles them into a ready-to-run Playwright test script.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['start', 'stop', 'status'], description: 'Recording lifecycle action' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['action']
        },
      },
      {
        name: 'reload_extension',
        description: 'Reloads the Xtra DevPilot Chrome extension background service worker and active connections. Useful when updating extension files.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'download_page_html',
        description: 'Downloads the live, complete HTML markup of the active page or a specific feature/component and saves it directly to a local file in your workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            outputPath: { type: 'string', description: 'Target file path to save the HTML (defaults to "./downloaded-page.html")' },
            selector: { type: 'string', description: 'Optional CSS selector to isolate and download only a specific feature/component subtree' },
            clean: { type: 'boolean', description: 'Optional boolean to strip noisy SVG paths, empty scripts, and comments for cleaner markup (defaults to false)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        }
      },
      {
        name: 'export_har',
        description: 'Exports captured network requests for the active tab into a standard HAR 1.2 format file and saves it directly to disk for analysis in Chrome DevTools or API clients.',
        inputSchema: {
          type: 'object',
          properties: {
            outputPath: { type: 'string', description: 'Target file path to save the .har file (defaults to "./network-traffic.har")' },
            clearAfterExport: { type: 'boolean', description: 'Whether to clear the captured network logs after exporting (defaults to false)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        }
      },
      {
        name: 'download_sources',
        description: 'Scans the active page for all referenced source files (JavaScript bundles, CSS stylesheets, Source Maps, images, fonts) and downloads them into an organized local directory.',
        inputSchema: {
          type: 'object',
          properties: {
            outputDir: { type: 'string', description: 'Target directory path to save the downloaded source files (defaults to "./downloaded-sources")' },
            types: {
              type: 'array',
              items: { type: 'string', enum: ['scripts', 'styles', 'sourcemaps', 'images', 'fonts'] },
              description: 'Asset types to download (defaults to all: ["scripts", "styles", "sourcemaps", "images", "fonts"])'
            },
            selector: { type: 'string', description: 'Optional CSS selector to isolate source files referenced within a specific feature/component' },
            includeSourceMaps: { type: 'boolean', description: 'Whether to detect and download .map source map files (defaults to true)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        }
      },
      {
        name: 'reconstruct_source_tree',
        description: 'Reconstructs original frontend project source code (TypeScript, React, Vue, Svelte, CSS) from downloaded .map SourceMap files and extracted modules.',
        inputSchema: {
          type: 'object',
          properties: {
            inputDir: { type: 'string', description: 'Input directory containing downloaded sources and sourcemaps (defaults to "./downloaded-sources")' },
            outputDir: { type: 'string', description: 'Output directory for reconstructed source code (defaults to "./reconstructed-codebase")' }
          }
        }
      },
      {
        name: 'trace_action_network',
        description: 'Traces outgoing HTTP/XHR/fetch network requests and payload details triggered by a specific user UI action (click, type) on an element.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector of the element to interact with' },
            action: { type: 'string', enum: ['click', 'type'], description: 'Action type to perform (defaults to "click")' },
            text: { type: 'string', description: 'Text to type if action is "type"' },
            waitDurationMs: { type: 'number', description: 'Observation window in milliseconds after the action (default: 1500)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['selector']
        }
      },
      {
        name: 'extract_api_endpoints',
        description: 'Scans downloaded JavaScript source files or HAR logs to discover backend API routes, HTTP methods, and generates an OpenAPI 3.0 draft specification.',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: { type: 'string', description: 'Path to directory or HAR file to scan (defaults to "./downloaded-sources")' },
            outputPath: { type: 'string', description: 'Optional file path to save the generated OpenAPI 3.0 JSON specification' }
          }
        }
      },
      {
        name: 'export_rea_evidence',
        description: 'Exports live authenticated browser state (DOM snapshot, HAR requests, cookies, storage, endpoints) into the standard REA (Reverse Engineer Anything) Evidence Bundle format (io.github.morluto/rea).',
        inputSchema: {
          type: 'object',
          properties: {
            outputPath: { type: 'string', description: 'File path to save the REA Evidence bundle JSON (defaults to "./xtradevpilot-rea-evidence.json")' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          }
        }
      }
    ],
  };
});

// Maps a raw error message to a stable, machine-readable code + a fix hint so the
// calling agent can recover instead of parsing a stack trace.
function classifyError(message) {
  const m = String(message || '');
  if (/not currently connected to the bridge|no chrome browser|not connected/i.test(m))
    return { code: 'BRIDGE_DISCONNECTED', hint: 'Open a page in Chrome with the extension loaded, then retry. Check list_browsers.' };
  if (/no active tab/i.test(m))
    return { code: 'NO_ACTIVE_TAB', hint: 'Pass an explicit tabId (from list_tabs) or focus a tab.' };
  if (/tab with id .* not found|no tab with id/i.test(m))
    return { code: 'TAB_NOT_FOUND', hint: 'The tabId is stale. Call list_tabs for current ids.' };
  if (/tab is hidden|not visible/i.test(m))
    return { code: 'TAB_HIDDEN', hint: 'Real input only reaches a visible tab. Pass focusTab:true to bring it to front, or ask the user to switch to it.' };
  if (/timeout/i.test(m))
    return { code: 'TIMEOUT', hint: 'The page/element was not ready. Use wait_for_element first, or raise timeoutMs.' };
  if (/cannot access chrome:\/\/|restricted/i.test(m))
    return { code: 'RESTRICTED_PAGE', hint: 'chrome:// and store pages cannot be scripted. Switch to a normal web page.' };
  if (/content security policy|unsafe-eval|trusted.?type/i.test(m))
    return { code: 'CSP_BLOCKED', hint: 'Page CSP blocked eval; the debugger fallback should handle this (reload the extension if needed).' };
  return { code: 'TOOL_ERROR', hint: 'Unexpected error. Retry; if it persists, check list_browsers / console logs.' };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const __t0 = Date.now();
  try {
    const args = request.params.arguments || {};
    if (args.browserId !== undefined && browserSessions.has(parseInt(args.browserId, 10))) {
      currentBrowserId = parseInt(args.browserId, 10);
    }
    let result;
    switch (request.params.name) {
      case 'list_browsers': {
        const browsers = [];
        for (const [id, session] of browserSessions.entries()) {
          if (session.ws.readyState === 1) {
            let activeTab = null;
            try {
              activeTab = await askExtension('GET_TAB_INFO', { browserId: id, timeoutMs: 2000 });
            } catch (e) {}
            browsers.push({
              browserId: id,
              active: id === currentBrowserId,
              title: activeTab?.title || 'Unknown Tab',
              url: activeTab?.url || '',
              dimensions: activeTab ? `${activeTab.width}x${activeTab.height}` : undefined,
              connectedAt: new Date(session.connectedAt).toISOString(),
              meta: session.meta || {}
            });
          }
        }
        result = browsers;
        break;
      }
      case 'switch_browser': {
        const targetId = parseInt(args.browserId, 10);
        if (!browserSessions.has(targetId) || browserSessions.get(targetId).ws.readyState !== 1) {
          throw new Error(`Browser #${targetId} is not connected. Call 'list_browsers' to inspect available sessions.`);
        }
        currentBrowserId = targetId;
        result = {
          success: true,
          currentBrowserId: targetId,
          message: `Switched active target to Browser #${targetId}`
        };
        break;
      }
      case 'get_dom_snapshot':
        result = await askExtension('GET_DOM', { tabId: args.tabId });
        break;
      case 'get_clean_dom_snapshot':
        result = await askExtension('GET_CLEAN_DOM', { 
          rootSelector: args.rootSelector, 
          tabId: args.tabId 
        });
        break;
      case 'get_ax_tree':
        result = await askExtension('GET_AX_TREE', { tabId: args.tabId });
        break;
      case 'batch_execute':
        result = await askExtension('BATCH_EXECUTE', { actions: args.actions, tabId: args.tabId });
        break;
      case 'highlight_element':
        result = await askExtension('HIGHLIGHT_ELEMENT', { 
          selector: args.selector, 
          tabId: args.tabId 
        });
        break;
      case 'wait_for_user_click':
        result = await askExtension('WAIT_FOR_CLICK');
        break;
      case 'click_element':
      case 'click_text': {
        let selector = args.selector;
        if (request.params.name === 'click_text') {
          if (!args.text) throw new Error('click_text needs "text".');
          selector = (args.contains ? 'text*=' : 'text=') + String(args.text);
          if (args.within) selector = String(args.within) + ' >>> ' + selector;
          if (Number.isInteger(args.nth)) selector += ` >> nth=${args.nth}`;
        }
        result = await askExtension('CLICK_ELEMENT', {
          selector,
          button: args.button,
          clicks: args.clicks,
          shiftKey: args.shiftKey,
          ctrlKey: args.ctrlKey,
          altKey: args.altKey,
          metaKey: args.metaKey,
          timeoutMs: args.timeoutMs,
          trusted: args.trusted,
          focusTab: args.focusTab,
          tabId: args.tabId
        });
        break;
      }
      case 'type_text':
        result = await askExtension('TYPE_TEXT', {
          selector: args.selector,
          text: args.text,
          timeoutMs: args.timeoutMs,
          trusted: args.trusted,
          keystrokes: args.keystrokes,
          delayMs: args.delayMs,
          focusTab: args.focusTab,
          append: args.append,
          tabId: args.tabId
        });
        break;
      case 'press_key':
        result = await askExtension('PRESS_KEY', {
          key: args.key,
          selector: args.selector,
          shiftKey: args.shiftKey,
          ctrlKey: args.ctrlKey,
          altKey: args.altKey,
          metaKey: args.metaKey,
          trusted: args.trusted,
          focusTab: args.focusTab,
          tabId: args.tabId
        });
        break;
      case 'press_keys':
        result = await askExtension('PRESS_KEYS', {
          keys: args.keys,
          selector: args.selector,
          delayMs: args.delayMs,
          focusTab: args.focusTab,
          tabId: args.tabId
        });
        break;
      case 'mouse_action':
        result = await askExtension('MOUSE_ACTION', {
          action: args.action,
          x: args.x,
          y: args.y,
          endX: args.endX,
          endY: args.endY,
          selector: args.selector,
          dropSelector: args.dropSelector,
          points: args.points,
          smooth: args.smooth,
          hold: args.hold,
          holdMs: args.holdMs,
          dwellMs: args.dwellMs,
          autoScroll: args.autoScroll,
          steps: args.steps,
          stepDelayMs: args.stepDelayMs,
          button: args.button,
          deltaX: args.deltaX,
          deltaY: args.deltaY,
          shiftKey: args.shiftKey,
          ctrlKey: args.ctrlKey,
          altKey: args.altKey,
          metaKey: args.metaKey,
          trusted: args.trusted,
          focusTab: args.focusTab,
          tabId: args.tabId
        });
        break;
      case 'touch_action':
        result = await askExtension('TOUCH_ACTION', {
          action: args.action,
          x: args.x,
          y: args.y,
          selector: args.selector,
          endX: args.endX,
          endY: args.endY,
          scale: args.scale,
          distance: args.distance,
          holdMs: args.holdMs,
          steps: args.steps,
          stepDelayMs: args.stepDelayMs,
          focusTab: args.focusTab,
          tabId: args.tabId
        });
        break;
      case 'drop_files': {
        const list = Array.isArray(args.filePaths) ? args.filePaths : (args.filePaths ? [args.filePaths] : []);
        if (!list.length) throw new Error('drop_files needs filePaths, e.g. ["C:/Users/me/photo.png"].');
        let total = 0;
        const files = list.map((fp) => {
          const abs = path.isAbsolute(fp) ? fp : path.resolve(process.cwd(), fp);
          if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error(`File not found: ${abs}`);
          const buf = fs.readFileSync(abs);
          total += buf.length;
          if (total > 25 * 1024 * 1024) throw new Error('drop_files is limited to 25 MB in total.');
          return { name: path.basename(abs), mimeType: DROP_MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', base64: buf.toString('base64') };
        });
        result = await askExtension('DROP_FILES', { files, selector: args.selector, x: args.x, y: args.y, timeoutMs: args.timeoutMs, tabId: args.tabId });
        break;
      }
      case 'upload_file': {
        const inputPath = args.filePath;
        const selector = args.selector || 'input[type="file"]';
        const tabId = args.tabId;

        const candidatePaths = [
          path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath),
          path.resolve(process.cwd(), '..', inputPath),
          path.resolve(__dirname, '..', inputPath),
          path.resolve(__dirname, inputPath),
          path.resolve('c:/Users/salun/OneDrive - smarttech/Desktop/D folder/xtradevpilot', inputPath)
        ];

        let resolvedPath = candidatePaths.find(p => fs.existsSync(p));
        if (!resolvedPath) {
          throw new Error(`File not found at path: ${inputPath} (checked: ${candidatePaths[0]}, ${path.resolve(__dirname, '..', inputPath)})`);
        }

        const fileBuffer = fs.readFileSync(resolvedPath);
        const base64 = fileBuffer.toString('base64');
        const fileName = path.basename(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();

        const mimeMap = {
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.txt': 'text/plain',
          '.rtf': 'application/rtf',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg'
        };
        const mimeType = mimeMap[ext] || 'application/octet-stream';

        result = await askExtension('UPLOAD_FILE', {
          selector,
          base64,
          fileName,
          mimeType,
          tabId
        });
        break;
      }
      case 'batch_fill_form':
        result = await askExtension('BATCH_FILL_FORM', {
          actions: args.actions,
          tabId: args.tabId
        });
        break;
      case 'wait_for_element':
        result = await askExtension('WAIT_FOR_ELEMENT', {
          selector: args.selector,
          timeoutMs: args.timeoutMs,
          state: args.state,
          tabId: args.tabId
        });
        break;
      case 'smart_select_combobox':
        result = await askExtension('SMART_SELECT_COMBOBOX', {
          triggerSelector: args.triggerSelector,
          optionText: args.optionText,
          searchQuery: args.searchQuery,
          tabId: args.tabId
        });
        break;
      case 'extract_job_details':
        result = await askExtension('EXTRACT_JOB_DETAILS', {
          tabId: args.tabId
        });
        break;
      case 'list_tabs': {
        const queryAll = args.allBrowsers !== false && (browserSessions.size > 1 || args.allBrowsers === true);
        if (queryAll && browserSessions.size > 1 && args.browserId === undefined) {
          const allTabs = [];
          for (const [id, session] of browserSessions.entries()) {
            if (session.ws.readyState === 1) {
              try {
                const tabs = await askExtension('LIST_TABS', { browserId: id, timeoutMs: 3000 });
                if (Array.isArray(tabs)) {
                  allTabs.push(...tabs.map(t => ({
                    ...t,
                    browserId: id,
                    isCurrentBrowser: id === currentBrowserId
                  })));
                }
              } catch (e) {}
            }
          }
          result = allTabs;
        } else {
          result = await askExtension('LIST_TABS', { browserId: args.browserId });
        }
        break;
      }
      case 'capture_screenshot': {
        const base64DataUrl = await askExtension('CAPTURE_SCREENSHOT', { tabId: args.tabId, fullPage: args.fullPage });
        if (base64DataUrl && base64DataUrl.startsWith('data:image/png;base64,')) {
          const base64Data = base64DataUrl.replace(/^data:image\/png;base64,/, "");
          const filePath = args.outputPath ? path.resolve(args.outputPath) : path.resolve(process.cwd(), '.devpilot-screenshot.png');
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, base64Data, 'base64');
          result = `Screenshot saved to: ${filePath}`;
        } else {
          result = "Failed to capture screenshot. The extension must have the active tab focused.";
        }
        break;
      }
      case 'mock_network_response':
        result = await askExtension('MOCK_NETWORK_RESPONSE', { 
          urlPattern: args.urlPattern, 
          responseBody: args.responseBody, 
          status: args.status || 200 
        });
        break;
      case 'clear_network_mocks':
        result = await askExtension('CLEAR_NETWORK_MOCKS');
        break;
      case 'inject_css':
        result = await askExtension('INJECT_CSS', { cssString: args.cssString });
        break;
      case 'toggle_layout_debug_mode':
        result = await askExtension('TOGGLE_LAYOUT_DEBUG');
        break;
      case 'get_web_vitals':
        result = await askExtension('GET_WEB_VITALS');
        break;
      case 'run_security_audit':
        result = await askExtension('RUN_SECURITY_AUDIT');
        break;
      case 'run_accessibility_audit':
        result = await askExtension('RUN_ACCESSIBILITY_AUDIT');
        break;
      case 'set_viewport_size':
        result = await askExtension('SET_VIEWPORT_SIZE', { 
          width: args.width, 
          height: args.height 
        });
        break;
      case 'get_network_logs':
        result = await askExtension('GET_NETWORK_LOGS');
        break;
      case 'get_console_logs':
        result = await askExtension('GET_CONSOLE_LOGS');
        break;
      case 'get_tab_info':
        result = await askExtension('GET_TAB_INFO', { tabId: args.tabId });
        break;
      case 'open_tab':
        result = await askExtension('OPEN_TAB', { url: args.url, background: args.background });
        break;
      case 'navigate':
        result = await askExtension('NAVIGATE', { url: args.url, tabId: args.tabId });
        break;
      case 'get_storage':
        result = await askExtension('GET_STORAGE');
        break;
      case 'execute_script': {
        let scriptToRun = (args.script || '').trim();
        if (/^\s*return\b/m.test(scriptToRun)) {
          scriptToRun = `return (() => { ${scriptToRun} })()`;
        }
        result = await askExtension('EXECUTE_SCRIPT', {
          script: scriptToRun,
          tabId: args.tabId
        });
        break;
      }
      case 'scroll_page':
        result = await askExtension('SCROLL_PAGE', {
          direction: args.direction,
          amount: args.amount,
          scrollToSelector: args.scrollToSelector,
          containerSelector: args.containerSelector,
          smooth: args.smooth,
          tabId: args.tabId
        });
        break;
      case 'extract_structured_data':
        result = await askExtension('EXTRACT_STRUCTURED_DATA', {
          targetSelector: args.targetSelector,
          type: args.type,
          itemSelector: args.itemSelector,
          tabId: args.tabId
        });
        break;
      case 'manage_storage_and_cookies':
        if (args.type === 'cookie') {
          result = await askExtension('MANAGE_COOKIES', {
            operation: args.operation,
            name: args.name,
            value: args.value,
            domain: args.domain,
            url: args.url,
            tabId: args.tabId
          });
        } else {
          result = await askExtension('MANAGE_STORAGE', {
            operation: args.operation,
            key: args.name,
            value: args.value,
            storageType: args.type === 'session_storage' ? 'session' : 'local',
            tabId: args.tabId
          });
        }
        break;
      case 'assert_element_state':
        result = await askExtension('ASSERT_ELEMENT_STATE', {
          selector: args.selector,
          condition: args.condition,
          expected: args.expected,
          tabId: args.tabId
        });
        break;
      case 'record_user_flow':
        result = await askExtension('RECORD_FLOW', {
          subAction: args.action,
          tabId: args.tabId
        });
        break;
      case 'reload_extension':
        result = await askExtension('RELOAD_EXTENSION');
        break;
      case 'download_page_html': {
        const data = await askExtension('DOWNLOAD_PAGE_HTML', {
          selector: args.selector,
          clean: args.clean,
          tabId: args.tabId
        });
        const defaultFileName = args.selector ? 'downloaded-feature.html' : 'downloaded-page.html';
        const targetPath = args.outputPath ? path.resolve(process.cwd(), args.outputPath) : path.resolve(process.cwd(), defaultFileName);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, data.html, 'utf8');
        const stats = fs.statSync(targetPath);
        result = {
          status: 'success',
          filePath: targetPath,
          fileSizeKB: Math.round((stats.size / 1024) * 100) / 100,
          title: data.title,
          url: data.url,
          scopedSelector: data.selector || 'FULL_PAGE',
          characterCount: data.html.length
        };
        break;
      }
      case 'export_har': {
        const har = await askExtension('EXPORT_HAR', {
          clearAfterExport: args.clearAfterExport,
          tabId: args.tabId
        });
        const targetPath = args.outputPath ? path.resolve(process.cwd(), args.outputPath) : path.resolve(process.cwd(), 'network-traffic.har');
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const jsonContent = JSON.stringify(har, null, 2);
        fs.writeFileSync(targetPath, jsonContent, 'utf8');
        const stats = fs.statSync(targetPath);
        result = {
          status: 'success',
          filePath: targetPath,
          totalEntries: har.log?.entries?.length || 0,
          fileSizeKB: Math.round((stats.size / 1024) * 100) / 100,
          harVersion: har.log?.version || '1.2'
        };
        break;
      }
      case 'download_sources': {
        const data = await askExtension('DOWNLOAD_SOURCES', {
          outputDir: args.outputDir,
          types: args.types,
          selector: args.selector,
          includeSourceMaps: args.includeSourceMaps,
          tabId: args.tabId
        });
        const targetDir = args.outputDir ? path.resolve(process.cwd(), args.outputDir) : path.resolve(process.cwd(), 'downloaded-sources');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const breakdown = { scripts: 0, styles: 0, sourcemaps: 0, images: 0, fonts: 0, other: 0 };
        let totalBytes = 0;

        if (Array.isArray(data.files)) {
          for (const f of data.files) {
            const fullPath = path.resolve(targetDir, f.relativePath);
            const subDir = path.dirname(fullPath);
            if (!fs.existsSync(subDir)) {
              fs.mkdirSync(subDir, { recursive: true });
            }

            if (f.isBinary && f.base64) {
              fs.writeFileSync(fullPath, Buffer.from(f.base64, 'base64'));
              totalBytes += f.size || 0;
            } else if (f.content !== undefined) {
              fs.writeFileSync(fullPath, f.content, 'utf8');
              totalBytes += Buffer.byteLength(f.content, 'utf8');
            }

            const prefix = f.relativePath.split('/')[0];
            if (breakdown[prefix] !== undefined) breakdown[prefix]++;
            else breakdown.other++;
          }
        }

        // Write manifest.json
        const manifestPath = path.resolve(targetDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(data.manifest || [], null, 2), 'utf8');

        result = {
          status: 'success',
          outputDir: targetDir,
          totalFiles: data.totalFiles || 0,
          totalSizeKB: Math.round((totalBytes / 1024) * 100) / 100,
          manifestPath,
          breakdown
        };
        break;
      }
      case 'reconstruct_source_tree': {
        const inputDir = args.inputDir || './downloaded-sources';
        const outputDir = args.outputDir || './reconstructed-codebase';
        result = reconstructCodebaseFromDirectory(inputDir, outputDir);
        break;
      }
      case 'trace_action_network': {
        result = await askExtension('TRACE_ACTION', {
          selector: args.selector,
          action: args.action || 'click',
          text: args.text,
          waitDurationMs: args.waitDurationMs || 1500,
          tabId: args.tabId
        });
        break;
      }
      case 'extract_api_endpoints': {
        const inputPath = args.inputPath || './downloaded-sources';
        const scanRes = scanEndpoints(inputPath);
        // Always persist the full spec + endpoint catalog to disk so the (potentially huge)
        // result never floods the model's context. Default next to the input if no path given.
        const outPath = args.outputPath
          ? path.resolve(process.cwd(), args.outputPath)
          : path.resolve(process.cwd(), 'xtradevpilot-openapi.json');
        const catalogPath = outPath.replace(/\.json$/i, '') + '.endpoints.json';
        try {
          const dir = path.dirname(outPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(outPath, JSON.stringify(scanRes.openApiSpec, null, 2), 'utf8');
          fs.writeFileSync(catalogPath, JSON.stringify(scanRes.endpoints, null, 2), 'utf8');
        } catch (e) {}
        // Return a concise summary only — full data is on disk.
        result = {
          status: 'success',
          totalEndpoints: scanRes.totalEndpoints,
          summary: scanRes.summary,
          savedSpecTo: outPath,
          savedEndpointsTo: catalogPath
        };
        break;
      }
      case 'export_rea_evidence': {
        const outputPath = args.outputPath || 'xtradevpilot-rea-evidence.json';
        const tabInfo = await askExtension('GET_TAB_INFO', { tabId: args.tabId });
        const harLog = await askExtension('EXPORT_HAR', { tabId: args.tabId });
        const domSnapshot = await askExtension('GET_CLEAN_DOM', { tabId: args.tabId });
        let storage = {};
        try { storage = await askExtension('GET_STORAGE', { tabId: args.tabId }); } catch (e) {}
        let cookies = [];
        try { cookies = await askExtension('MANAGE_COOKIES', { operation: 'get_all', tabId: args.tabId }); } catch (e) {}

        const evidence = buildReaEvidenceBundle({
          tabInfo,
          harLog,
          domSnapshot,
          storage,
          cookies
        });

        const saveRes = exportReaEvidenceToFile(evidence, outputPath);
        result = {
          status: 'success',
          evidenceId: evidence.evidence_id,
          savedTo: saveRes.savedTo,
          sizeBytes: saveRes.sizeBytes
        };
        break;
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    const durationMs = Date.now() - __t0;
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      result = { ...result, durationMs };
    }
    return {
      content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const durationMs = Date.now() - __t0;
    const { code, hint } = classifyError(error.message);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: { code, message: error.message, hint }, durationMs }, null, 2) }],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[DevPilot Bridge] MCP Server connected to stdio transport.`);
  console.error(`[DevPilot Bridge] WebSocket server listening on port ${WSS_PORT}.`);

  const cleanupAndExit = (signal) => {
    console.error(`[DevPilot Bridge] Received ${signal || 'exit'}, shutting down WebSocket server...`);
    if (wss) {
      try { wss.close(); } catch (e) {}
    }
    process.exit(0);
  };

  process.on('SIGINT', () => cleanupAndExit('SIGINT'));
  process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
