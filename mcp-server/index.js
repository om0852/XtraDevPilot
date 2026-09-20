#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
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

// Setup WebSocket Server to listen for the Chrome Extension
const WSS_PORT = 42819;

let wss = null;
let activeExtensionSocket = null;
let messageIdCounter = 1;
const pendingRequests = new Map();

function startWebSocketServer() {
  try {
    if (wss) {
      try { wss.close(); } catch (e) {}
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
        console.error(`[DevPilot Bridge] Port ${WSS_PORT} is in use. Retrying in 2 seconds...`);
        setTimeout(startWebSocketServer, 2000);
      }
    });
  } catch (err) {
    console.error(`[DevPilot Bridge] Failed to start WebSocketServer: ${err.message}`);
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

    targetSocket.send(JSON.stringify({ id, action, ...payload }));
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
          required: ['selector', 'text']
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
            tabId: { type: 'number', description: 'Optional target Chrome tab ID' }
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
          const filePath = path.resolve(process.cwd(), '.devpilot-screenshot.png');
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
          scriptToRun = `(() => { ${scriptToRun} })()`;
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
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
