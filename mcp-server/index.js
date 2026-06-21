#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
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
const wss = new WebSocketServer({ port: WSS_PORT });

let activeExtensionSocket = null;
let messageIdCounter = 1;
const pendingRequests = new Map();

wss.on('connection', (ws) => {
  console.error(`[DevPilot Bridge] Chrome Extension connected via WebSocket.`);
  activeExtensionSocket = ws;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'PING') {
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
      } else {
        console.error(`[DevPilot Bridge] Unhandled message:`, data);
      }
    } catch (e) {
      console.error(`[DevPilot Bridge] Failed to parse WebSocket message:`, e);
    }
  });

  ws.on('close', () => {
    console.error(`[DevPilot Bridge] Chrome Extension disconnected.`);
    if (activeExtensionSocket === ws) {
      activeExtensionSocket = null;
    }
  });
});

async function askExtension(action, payload = {}) {
  if (!activeExtensionSocket || activeExtensionSocket.readyState !== 1) {
    throw new Error("Chrome extension is not currently connected to the bridge. Ensure the extension is installed and loaded in your active browser.");
  }

  const id = messageIdCounter++;
  
  return new Promise((resolve, reject) => {
    const timeoutMs = action === 'WAIT_FOR_CLICK' ? 60000 : 10000;
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timeout waiting for extension to respond to action: ${action}`));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (result) => { clearTimeout(timeout); resolve(result); },
      reject: (err) => { clearTimeout(timeout); reject(err); }
    });

    activeExtensionSocket.send(JSON.stringify({ id, action, ...payload }));
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
        name: 'get_dom_snapshot',
        description: 'Get the current HTML structure (DOM) of the active browser tab. Use this to understand the page layout and element IDs.',
        inputSchema: { type: 'object', properties: {} },
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
        name: 'get_clean_dom_snapshot',
        description: 'Get an LLM-optimized HTML structure of the active browser tab. Strips out bloated classes, styles, scripts, and SVGs to save tokens.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'highlight_element',
        description: 'Visually highlight an element on the user screen and scroll to it.',
        inputSchema: { 
          type: 'object', 
          properties: {
            selector: { type: 'string', description: 'CSS selector of the element to highlight' }
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
        name: 'click_element',
        description: 'Simulates a user click on an element specified by a CSS selector.',
        inputSchema: { 
          type: 'object', 
          properties: { selector: { type: 'string' } },
          required: ['selector']
        },
      },
      {
        name: 'type_text',
        description: 'Simulates a user typing text into an input field or textarea.',
        inputSchema: { 
          type: 'object', 
          properties: { 
            selector: { type: 'string' },
            text: { type: 'string' }
          },
          required: ['selector', 'text']
        },
      },
      {
        name: 'capture_screenshot',
        description: 'Captures a visible screenshot of the active browser tab and returns the absolute path to the image file.',
        inputSchema: { type: 'object', properties: {} },
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
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    let result;
    switch (request.params.name) {
      case 'get_dom_snapshot':
        result = await askExtension('GET_DOM');
        break;
      case 'get_clean_dom_snapshot':
        result = await askExtension('GET_CLEAN_DOM');
        break;
      case 'highlight_element':
        result = await askExtension('HIGHLIGHT_ELEMENT', { selector: request.params.arguments.selector });
        break;
      case 'wait_for_user_click':
        result = await askExtension('WAIT_FOR_CLICK');
        break;
      case 'click_element':
        result = await askExtension('CLICK_ELEMENT', { selector: request.params.arguments.selector });
        break;
      case 'type_text':
        result = await askExtension('TYPE_TEXT', { selector: request.params.arguments.selector, text: request.params.arguments.text });
        break;
      case 'capture_screenshot':
        const base64DataUrl = await askExtension('CAPTURE_SCREENSHOT');
        if (base64DataUrl && base64DataUrl.startsWith('data:image/png;base64,')) {
          const base64Data = base64DataUrl.replace(/^data:image\/png;base64,/, "");
          const filePath = path.resolve(process.cwd(), '.devpilot-screenshot.png');
          fs.writeFileSync(filePath, base64Data, 'base64');
          result = `Screenshot saved to: ${filePath}`;
        } else {
          result = "Failed to capture screenshot. The extension must have the active tab focused.";
        }
        break;
      case 'mock_network_response':
        result = await askExtension('MOCK_NETWORK_RESPONSE', { 
          urlPattern: request.params.arguments.urlPattern, 
          responseBody: request.params.arguments.responseBody,
          status: request.params.arguments.status || 200
        });
        break;
      case 'clear_network_mocks':
        result = await askExtension('CLEAR_NETWORK_MOCKS');
        break;
      case 'inject_css':
        result = await askExtension('INJECT_CSS', { cssString: request.params.arguments.cssString });
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
          width: request.params.arguments.width, 
          height: request.params.arguments.height 
        });
        break;
      case 'get_network_logs':
        result = await askExtension('GET_NETWORK_LOGS');
        break;
      case 'get_console_logs':
        result = await askExtension('GET_CONSOLE_LOGS');
        break;
      case 'get_storage':
        result = await askExtension('GET_STORAGE');
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
