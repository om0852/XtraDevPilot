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
const WSS_PORT = 42819;

let wss = null;
let activeExtensionSocket = null;
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
            activeExtensionSocket = ws;
            console.error(`[DevPilot Bridge] Chrome Extension registered via WebSocket.`);
            return;
          }
          
          if (data.type === 'PING') {
            activeExtensionSocket = ws;
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
              const result = await askExtension(data.action, data);
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
        if (activeExtensionSocket === ws) {
          console.error(`[DevPilot Bridge] Chrome Extension disconnected.`);
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
  let targetSocket = activeExtensionSocket;
  if (!targetSocket || targetSocket.readyState !== 1) {
    if (wss && wss.clients) {
      for (const client of wss.clients) {
        if (client.readyState === 1) {
          targetSocket = client;
          activeExtensionSocket = client;
          break;
        }
      }
    }
  }

  if (!targetSocket || targetSocket.readyState !== 1) {
    throw new Error("Chrome extension is not currently connected to the bridge. Ensure the extension is installed and loaded in your active browser.");
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

    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timeout waiting for extension to respond to action: ${action}`));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (result) => { clearTimeout(timeout); resolve(result); },
      reject: (err) => { clearTimeout(timeout); reject(err); }
    });

    targetSocket.send(JSON.stringify({ ...payload, action, id }));
  });
}

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
        name: 'open_tab',
        description: 'Opens a new browser tab in Chrome and navigates to the specified URL.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Target URL to open in a new tab (e.g. "https://google.com")' }
          },
          required: ['url']
        },
      },
      {
        name: 'navigate',
        description: 'Navigates the browser tab to the specified URL.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Target URL to navigate to' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['url']
        },
      },
      {
        name: 'list_tabs',
        description: 'Lists all open Chrome tabs with their tab IDs, titles, URLs, and active status.',
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
        description: 'Simulates a user click on an element specified by a CSS selector. Automatically waits up to timeoutMs if the element is still rendering.',
        inputSchema: { 
          type: 'object', 
          properties: { 
            selector: { type: 'string' },
            timeoutMs: { type: 'number', description: 'Optional wait timeout in ms (default: 3000)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['selector']
        },
      },
      {
        name: 'type_text',
        description: 'Simulates typing text into an input or textarea using React-compatible state triggers. Automatically waits up to timeoutMs if the element is still rendering.',
        inputSchema: { 
          type: 'object', 
          properties: { 
            selector: { type: 'string' },
            text: { type: 'string' },
            timeoutMs: { type: 'number', description: 'Optional wait timeout in ms (default: 3000)' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['text']
        },
      },
      {
        name: 'press_key',
        description: 'Simulates pressing keyboard keys (Enter, Tab, Escape, Shift, Backspace, ArrowDown, etc.) with synthetic event triggers.',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Key name (e.g. "Enter", "Tab", "Escape", "Backspace", "ArrowDown", "Space")' },
            selector: { type: 'string', description: 'Optional CSS selector of target element (defaults to document.activeElement)' },
            shiftKey: { type: 'boolean', description: 'Whether Shift key is held down' },
            ctrlKey: { type: 'boolean', description: 'Whether Ctrl key is held down' },
            altKey: { type: 'boolean', description: 'Whether Alt key is held down' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['key']
        },
      },
      {
        name: 'mouse_action',
        description: 'Advanced synthetic mouse controller for precise coordinate clicks, right-clicks, double clicks, mouse moves, and drag-and-drop actions.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['click', 'dblclick', 'move', 'drag', 'scroll'], description: 'Mouse action type' },
            x: { type: 'number', description: 'Target X coordinate (viewport pixels)' },
            y: { type: 'number', description: 'Target Y coordinate (viewport pixels)' },
            endX: { type: 'number', description: 'End X coordinate for drag action' },
            endY: { type: 'number', description: 'End Y coordinate for drag action' },
            selector: { type: 'string', description: 'Optional CSS selector of target element' },
            button: { type: 'string', enum: ['left', 'middle', 'right'], description: 'Mouse button (default: left)' },
            deltaX: { type: 'number', description: 'Horizontal scroll delta for scroll action' },
            deltaY: { type: 'number', description: 'Vertical scroll delta for scroll action' },
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
          },
          required: ['action']
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
        description: 'Captures a visible screenshot of the active browser tab and returns the absolute path to the image file.',
        inputSchema: { 
          type: 'object', 
          properties: {
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' },
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const args = request.params.arguments || {};
    let result;
    switch (request.params.name) {
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
        result = await askExtension('CLICK_ELEMENT', { 
          selector: args.selector, 
          timeoutMs: args.timeoutMs, 
          tabId: args.tabId 
        });
        break;
      case 'type_text':
        result = await askExtension('TYPE_TEXT', { 
          selector: args.selector, 
          text: args.text, 
          timeoutMs: args.timeoutMs, 
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
          button: args.button,
          deltaX: args.deltaX,
          deltaY: args.deltaY,
          tabId: args.tabId
        });
        break;
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
      case 'list_tabs':
        result = await askExtension('LIST_TABS');
        break;
      case 'capture_screenshot': {
        const base64DataUrl = await askExtension('CAPTURE_SCREENSHOT', { tabId: args.tabId });
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
        result = await askExtension('OPEN_TAB', { url: args.url });
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
        if (args.outputPath) {
          const resolvedOut = path.resolve(process.cwd(), args.outputPath);
          const dir = path.dirname(resolvedOut);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolvedOut, JSON.stringify(scanRes.openApiSpec, null, 2), 'utf8');
        }
        result = {
          ...scanRes,
          savedSpecTo: args.outputPath ? path.resolve(process.cwd(), args.outputPath) : undefined
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

    return {
      content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
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

  process.stdin.on('close', () => cleanupAndExit('STDIN_CLOSE'));
  process.stdin.on('end', () => cleanupAndExit('STDIN_END'));
  process.on('SIGINT', () => cleanupAndExit('SIGINT'));
  process.on('SIGTERM', () => cleanupAndExit('SIGTERM'));
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
