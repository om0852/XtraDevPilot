import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class XtraDevPilot {
  /**
   * @param {Object} options
   * @param {string} [options.serverPath] - Path to the mcp-server index.js. Defaults to local mcp-server.
   * @param {Object} [options.env] - Optional environment variables to pass to the MCP server process.
   */
  constructor(options = {}) {
    this.serverPath = options.serverPath || path.resolve(__dirname, '../mcp-server/index.js');
    this.env = options.env || process.env;
    this.client = null;
    this.transport = null;
    this.isConnected = false;
  }

  /**
   * Connect to the Xtra DevPilot MCP Server.
   */
  async connect() {
    if (this.isConnected) return;

    this.transport = new StdioClientTransport({
      command: 'node',
      args: [this.serverPath],
      env: this.env
    });

    this.client = new Client(
      {
        name: 'xtradevpilot-automation-sdk',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  /**
   * Internal helper to invoke MCP tool and parse response content.
   */
  async _callTool(name, args = {}) {
    if (!this.isConnected) {
      throw new Error("XtraDevPilot SDK is not connected. Call await pilot.connect() first.");
    }

    const response = await this.client.callTool({
      name,
      arguments: args
    });

    if (response.isError) {
      const errorMsg = response.content?.[0]?.text || "Unknown MCP Tool Error";
      throw new Error(`[XtraDevPilot] ${name} failed: ${errorMsg}`);
    }

    const rawText = response.content?.[0]?.text;
    try {
      return JSON.parse(rawText);
    } catch {
      return rawText;
    }
  }

  /**
   * Simulate a click on an element by CSS selector.
   * @param {string} selector
   */
  async click(selector) {
    return await this._callTool('click_element', { selector });
  }

  /**
   * Simulate typing text into an input field or textarea.
   * @param {string} selector
   * @param {string} text
   */
  async type(selector, text) {
    return await this._callTool('type_text', { selector, text });
  }

  /**
   * Retrieve full DOM HTML structure of the active browser tab.
   */
  async getDomSnapshot() {
    return await this._callTool('get_dom_snapshot');
  }

  /**
   * Retrieve an LLM-optimized clean HTML structure of the active browser tab.
   */
  async getCleanDomSnapshot() {
    return await this._callTool('get_clean_dom_snapshot');
  }

  /**
   * Visually highlight an element on the screen and scroll to it.
   * @param {string} selector
   */
  async highlightElement(selector) {
    return await this._callTool('highlight_element', { selector });
  }

  /**
   * Pauses execution until the user clicks an element in the active browser tab.
   */
  async waitForUserClick() {
    return await this._callTool('wait_for_user_click');
  }

  /**
   * Captures a visible screenshot of the active tab and saves it.
   */
  async captureScreenshot() {
    return await this._callTool('capture_screenshot');
  }

  /**
   * Fetch recent network requests made by the active browser tab.
   */
  async getNetworkLogs() {
    return await this._callTool('get_network_logs');
  }

  /**
   * Fetch recent console logs (errors, warnings, info) from active tab.
   */
  async getConsoleLogs() {
    return await this._callTool('get_console_logs');
  }

  /**
   * Get localStorage and sessionStorage data of active tab.
   */
  async getStorage() {
    return await this._callTool('get_storage');
  }

  /**
   * Mock network requests matching a URL pattern with a custom JSON response.
   * @param {string} urlPattern
   * @param {Object|string} responseBody
   * @param {number} [status=200]
   */
  async mockNetworkResponse(urlPattern, responseBody, status = 200) {
    const bodyStr = typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody;
    return await this._callTool('mock_network_response', {
      urlPattern,
      responseBody: bodyStr,
      status
    });
  }

  /**
   * Clear all active network mocks.
   */
  async clearNetworkMocks() {
    return await this._callTool('clear_network_mocks');
  }

  /**
   * Inject raw CSS dynamically into the active tab without reloading.
   * @param {string} cssString
   */
  async injectCss(cssString) {
    return await this._callTool('inject_css', { cssString });
  }

  /**
   * Toggle red layout debugging outlines on elements.
   */
  async toggleLayoutDebugMode() {
    return await this._callTool('toggle_layout_debug_mode');
  }

  /**
   * Extract Core Web Vitals metrics from active tab.
   */
  async getWebVitals() {
    return await this._callTool('get_web_vitals');
  }

  /**
   * Run a security audit scan on the active tab.
   */
  async runSecurityAudit() {
    return await this._callTool('run_security_audit');
  }

  /**
   * Run an accessibility (a11y) audit scan on the active tab.
   */
  async runAccessibilityAudit() {
    return await this._callTool('run_accessibility_audit');
  }

  /**
   * Resize the browser viewport window.
   * @param {number} width
   * @param {number} height
   */
  async setViewportSize(width, height) {
    return await this._callTool('set_viewport_size', { width, height });
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect() {
    if (this.transport) {
      await this.transport.close();
      this.isConnected = false;
    }
  }
}
