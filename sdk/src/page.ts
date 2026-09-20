import fs from 'fs';
import path from 'path';
import { BaseTransport } from './transports/base.js';
import { Logger } from './utils/logger.js';
import {
  ClickOptions,
  ConsoleLogEntry,
  MockRouteOptions,
  NetworkLogEntry,
  ScreenshotOptions,
  SecurityAuditReport,
  AccessibilityAuditReport,
  StorageData,
  TypeOptions,
  TabInfo,
  ViewportSize,
  WaitOptions,
  WebVitalsReport
} from './types/index.js';
import { ElementNotFoundError, TimeoutError } from './errors/index.js';

export class Page {
  private transport: BaseTransport;
  private logger: Logger;
  private defaultTimeoutMs: number;

  constructor(transport: BaseTransport, logger: Logger, defaultTimeoutMs: number = 10000) {
    this.transport = transport;
    this.logger = logger;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Helper to wait/poll until a condition function resolves to truthy.
   */
  private async poll<T>(
    fn: () => Promise<T | null | false>,
    options?: WaitOptions
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
    const intervalMs = options?.pollingIntervalMs || 250;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await fn();
        if (result) return result;
      } catch {
        // Ignore transient errors during polling
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new TimeoutError(`Operation timed out after ${timeoutMs}ms.`);
  }

  /**
   * Polls the DOM until an element matching selector is present.
   */
  public async waitForSelector(selector: string, options?: WaitOptions): Promise<boolean> {
    this.logger.debug(`Waiting for selector: '${selector}'`);
    try {
      return await this.poll(async () => {
        const cleanDom = await this.getCleanDomSnapshot();
        const domStr = typeof cleanDom === 'string' ? cleanDom : JSON.stringify(cleanDom);
        // Simple DOM check or trigger request
        if (domStr.includes(selector.replace(/^[#.]/, ''))) {
          return true;
        }
        return false;
      }, options);
    } catch {
      throw new ElementNotFoundError(selector, `Timed out waiting for element matching selector '${selector}'`);
    }
  }

  /**
   * Simulates a user click on an element matching CSS selector.
   */
  /**
   * Navigates the active browser tab to the target URL.
   */
  public async goto(url: string): Promise<any> {
    this.logger.info(`Navigating active tab to: '${url}'`);
    return await this.transport.sendRequest('navigate', { url });
  }

  /**
   * Opens a new browser tab in Chrome and navigates to target URL.
   */
  public async openTab(url: string): Promise<any> {
    this.logger.info(`Opening new browser tab with URL: '${url}'`);
    return await this.transport.sendRequest('open_tab', { url });
  }

  public async click(selector: string, options?: ClickOptions): Promise<void> {
    this.logger.info(`Clicking element: '${selector}'`);
    if (options?.highlight) {
      await this.highlight(selector);
    }
    try {
      await this.transport.sendRequest('click_element', { selector });
    } catch (err: any) {
      throw new ElementNotFoundError(selector, `Failed to click '${selector}': ${err.message}`);
    }
  }

  /**
   * Simulates typing text into an input field or textarea.
   */
  public async type(selector: string, text: string, options?: TypeOptions): Promise<void> {
    this.logger.info(`Typing text into '${selector}'`);
    try {
      await this.transport.sendRequest('type_text', { selector, text });
    } catch (err: any) {
      throw new ElementNotFoundError(selector, `Failed to type into '${selector}': ${err.message}`);
    }
  }

  /**
   * Visually highlights an element on screen and scrolls it into view.
   */
  public async highlight(selector: string): Promise<void> {
    this.logger.debug(`Highlighting element: '${selector}'`);
    await this.transport.sendRequest('highlight_element', { selector });
  }

  /**
   * Retrieves tab metadata (title, URL, dimensions, favicon, status) of active page.
   */
  public async getTabInfo(): Promise<TabInfo> {
    this.logger.info('Fetching active tab metadata...');
    return await this.transport.sendRequest('get_tab_info');
  }

  /**
   * Retrieves full DOM HTML snapshot of active page.
   */
  public async getDomSnapshot(): Promise<string> {
    return await this.transport.sendRequest('get_dom_snapshot');
  }

  /**
   * Retrieves clean, token-optimized HTML structure of active page.
   */
  public async getCleanDomSnapshot(): Promise<string> {
    return await this.transport.sendRequest('get_clean_dom_snapshot');
  }

  /**
   * Captures a viewport screenshot and optionally saves it to disk.
   */
  public async screenshot(options?: ScreenshotOptions): Promise<string> {
    this.logger.info('Capturing screenshot...');
    const result = await this.transport.sendRequest('capture_screenshot');
    
    let filePath = typeof result === 'string' ? result : result?.path;
    
    if (options?.path && filePath) {
      const destination = path.resolve(process.cwd(), options.path);
      if (typeof result === 'string' && result.startsWith('data:image/png;base64,')) {
        const base64Data = result.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(destination, base64Data, 'base64');
        filePath = destination;
      }
    }
    return filePath || result;
  }

  /**
   * Mock network requests matching a URL pattern.
   */
  public async route(urlPattern: string, responseBody: Record<string, any> | string, status: number = 200): Promise<void> {
    this.logger.info(`Mocking route for pattern '${urlPattern}' with status ${status}`);
    const bodyStr = typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody;
    await this.transport.sendRequest('mock_network_response', {
      urlPattern,
      responseBody: bodyStr,
      status
    });
  }

  /**
   * Clears all network mocks.
   */
  public async unrouteAll(): Promise<void> {
    this.logger.info('Clearing network mocks...');
    await this.transport.sendRequest('clear_network_mocks');
  }

  /**
   * Injects CSS into the active tab dynamically.
   */
  public async injectStyle(cssString: string): Promise<void> {
    this.logger.debug('Injecting custom CSS...');
    await this.transport.sendRequest('inject_css', { cssString });
  }

  /**
   * Toggles element layout debug mode (red outlines).
   */
  public async toggleLayoutDebug(): Promise<void> {
    this.logger.debug('Toggling layout debug mode...');
    await this.transport.sendRequest('toggle_layout_debug_mode');
  }

  /**
   * Retrieves recent console log entries from active page.
   */
  public async getConsoleLogs(): Promise<ConsoleLogEntry[]> {
    return await this.transport.sendRequest('get_console_logs');
  }

  /**
   * Retrieves recent network log entries from active page.
   */
  public async getNetworkLogs(): Promise<NetworkLogEntry[]> {
    return await this.transport.sendRequest('get_network_logs');
  }

  /**
   * Retrieves localStorage and sessionStorage contents.
   */
  public async getStorage(): Promise<StorageData> {
    return await this.transport.sendRequest('get_storage');
  }

  /**
   * Runs Core Web Vitals audit.
   */
  public async getWebVitals(): Promise<WebVitalsReport> {
    this.logger.info('Fetching Core Web Vitals...');
    return await this.transport.sendRequest('get_web_vitals');
  }

  /**
   * Runs security audit scan.
   */
  public async runSecurityAudit(): Promise<SecurityAuditReport> {
    this.logger.info('Running security audit scan...');
    return await this.transport.sendRequest('run_security_audit');
  }

  /**
   * Runs accessibility (a11y) audit scan.
   */
  public async runAccessibilityAudit(): Promise<AccessibilityAuditReport> {
    this.logger.info('Running accessibility audit scan...');
    return await this.transport.sendRequest('run_accessibility_audit');
  }

  /**
   * Sets viewport dimensions.
   */
  public async setViewport(width: number, height: number): Promise<ViewportSize> {
    this.logger.info(`Setting viewport size to ${width}x${height}`);
    await this.transport.sendRequest('set_viewport_size', { width, height });
    return { width, height };
  }

  /**
   * Pauses execution until the user clicks any element in Chrome.
   */
  public async waitForUserClick(): Promise<any> {
    this.logger.info('Entering select mode, waiting for user click in browser...');
    return await this.transport.sendRequest('wait_for_user_click');
  }

  /**
   * Uploads a local file (e.g. resume PDF) to a file input or drag-and-drop zone.
   */
  public async uploadFile(filePath: string, selector?: string, tabId?: number): Promise<any> {
    this.logger.info(`Uploading file '${filePath}' to selector '${selector || 'input[type="file"]'}'`);
    return await this.transport.sendRequest('upload_file', { filePath, selector, tabId });
  }

  /**
   * Fills multiple form fields in a single rapid roundtrip.
   */
  public async batchFill(
    actions: Array<{
      selector: string;
      value?: string;
      action?: 'type' | 'select' | 'click' | 'check' | 'uncheck';
      waitMs?: number;
    }>,
    tabId?: number
  ): Promise<any> {
    this.logger.info(`Batch filling ${actions.length} fields...`);
    return await this.transport.sendRequest('batch_fill_form', { actions, tabId });
  }

  /**
   * Selects an option from modern searchable custom dropdowns (Workday, Greenhouse, ARIA comboboxes).
   */
  public async smartSelectCombobox(
    triggerSelector: string,
    optionText: string,
    searchQuery?: string,
    tabId?: number
  ): Promise<any> {
    this.logger.info(`Selecting '${optionText}' in combobox '${triggerSelector}'`);
    return await this.transport.sendRequest('smart_select_combobox', {
      triggerSelector,
      optionText,
      searchQuery,
      tabId
    });
  }

  /**
   * Extracts structured job posting details from the active job page.
   */
  public async extractJobDetails(tabId?: number): Promise<any> {
    this.logger.info('Extracting structured job details...');
    return await this.transport.sendRequest('extract_job_details', { tabId });
  }

  /**
   * Lists all open tabs in Chrome.
   */
  public async listTabs(): Promise<any> {
    return await this.transport.sendRequest('list_tabs', {});
  }

  /**
   * Evaluates arbitrary JavaScript in the webpage execution context.
   */
  public async evaluate(script: string, tabId?: number): Promise<any> {
    this.logger.debug(`Evaluating script: ${script.substring(0, 80)}...`);
    return await this.transport.sendRequest('execute_script', { script, tabId });
  }

  /**
   * Scrolls the page or a scrollable inner container.
   */
  public async scroll(
    options: {
      direction?: 'down' | 'up' | 'top' | 'bottom';
      amount?: number;
      scrollToSelector?: string;
      containerSelector?: string;
      smooth?: boolean;
    } = {},
    tabId?: number
  ): Promise<any> {
    return await this.transport.sendRequest('scroll_page', { ...options, tabId });
  }

  /**
   * Extracts structured data from HTML tables, lists, or card grids.
   */
  public async extractStructuredData(
    targetSelector?: string,
    type?: 'auto' | 'table' | 'cards' | 'list',
    itemSelector?: string,
    tabId?: number
  ): Promise<any> {
    return await this.transport.sendRequest('extract_structured_data', {
      targetSelector,
      type,
      itemSelector,
      tabId
    });
  }

  /**
   * QA assertion engine to check element state.
   */
  public async assertElement(
    selector: string,
    condition: 'is_visible' | 'is_hidden' | 'is_enabled' | 'is_disabled' | 'contains_text' | 'has_value' | 'has_attribute',
    expected?: string,
    tabId?: number
  ): Promise<any> {
    return await this.transport.sendRequest('assert_element_state', {
      selector,
      condition,
      expected,
      tabId
    });
  }

  /**
   * Storage and cookie management.
   */
  public async manageStorage(
    type: 'cookie' | 'local_storage' | 'session_storage',
    operation: 'get' | 'get_all' | 'set' | 'remove' | 'clear',
    options: { name?: string; value?: string; url?: string; domain?: string } = {},
    tabId?: number
  ): Promise<any> {
    return await this.transport.sendRequest('manage_storage_and_cookies', {
      type,
      operation,
      ...options,
      tabId
    });
  }

  /**
   * Records user interaction flow and compiles it into a Playwright test.
   */
  public async recordFlow(action: 'start' | 'stop' | 'status', tabId?: number): Promise<any> {
    return await this.transport.sendRequest('record_user_flow', { action, tabId });
  }
}


