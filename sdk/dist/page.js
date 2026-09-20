"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Page = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("./errors/index.js");
class Page {
    transport;
    logger;
    defaultTimeoutMs;
    constructor(transport, logger, defaultTimeoutMs = 10000) {
        this.transport = transport;
        this.logger = logger;
        this.defaultTimeoutMs = defaultTimeoutMs;
    }
    /**
     * Helper to wait/poll until a condition function resolves to truthy.
     */
    async poll(fn, options) {
        const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
        const intervalMs = options?.pollingIntervalMs || 250;
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            try {
                const result = await fn();
                if (result)
                    return result;
            }
            catch {
                // Ignore transient errors during polling
            }
            await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new index_js_1.TimeoutError(`Operation timed out after ${timeoutMs}ms.`);
    }
    /**
     * Polls the DOM until an element matching selector is present.
     */
    async waitForSelector(selector, options) {
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
        }
        catch {
            throw new index_js_1.ElementNotFoundError(selector, `Timed out waiting for element matching selector '${selector}'`);
        }
    }
    /**
     * Simulates a user click on an element matching CSS selector.
     */
    /**
     * Navigates the active browser tab to the target URL.
     */
    async goto(url) {
        this.logger.info(`Navigating active tab to: '${url}'`);
        return await this.transport.sendRequest('navigate', { url });
    }
    /**
     * Opens a new browser tab in Chrome and navigates to target URL.
     */
    async openTab(url) {
        this.logger.info(`Opening new browser tab with URL: '${url}'`);
        return await this.transport.sendRequest('open_tab', { url });
    }
    async click(selector, options) {
        this.logger.info(`Clicking element: '${selector}'`);
        if (options?.highlight) {
            await this.highlight(selector);
        }
        try {
            await this.transport.sendRequest('click_element', { selector });
        }
        catch (err) {
            throw new index_js_1.ElementNotFoundError(selector, `Failed to click '${selector}': ${err.message}`);
        }
    }
    /**
     * Simulates typing text into an input field or textarea.
     */
    async type(selector, text, options) {
        this.logger.info(`Typing text into '${selector}'`);
        try {
            await this.transport.sendRequest('type_text', { selector, text });
        }
        catch (err) {
            throw new index_js_1.ElementNotFoundError(selector, `Failed to type into '${selector}': ${err.message}`);
        }
    }
    /**
     * Visually highlights an element on screen and scrolls it into view.
     */
    async highlight(selector) {
        this.logger.debug(`Highlighting element: '${selector}'`);
        await this.transport.sendRequest('highlight_element', { selector });
    }
    /**
     * Retrieves tab metadata (title, URL, dimensions, favicon, status) of active page.
     */
    async getTabInfo() {
        this.logger.info('Fetching active tab metadata...');
        return await this.transport.sendRequest('get_tab_info');
    }
    /**
     * Retrieves full DOM HTML snapshot of active page.
     */
    async getDomSnapshot() {
        return await this.transport.sendRequest('get_dom_snapshot');
    }
    /**
     * Retrieves clean, token-optimized HTML structure of active page.
     */
    async getCleanDomSnapshot() {
        return await this.transport.sendRequest('get_clean_dom_snapshot');
    }
    /**
     * Captures a viewport screenshot and optionally saves it to disk.
     */
    async screenshot(options) {
        this.logger.info('Capturing screenshot...');
        const result = await this.transport.sendRequest('capture_screenshot');
        let filePath = typeof result === 'string' ? result : result?.path;
        if (options?.path && filePath) {
            const destination = path_1.default.resolve(process.cwd(), options.path);
            if (typeof result === 'string' && result.startsWith('data:image/png;base64,')) {
                const base64Data = result.replace(/^data:image\/png;base64,/, '');
                fs_1.default.writeFileSync(destination, base64Data, 'base64');
                filePath = destination;
            }
        }
        return filePath || result;
    }
    /**
     * Mock network requests matching a URL pattern.
     */
    async route(urlPattern, responseBody, status = 200) {
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
    async unrouteAll() {
        this.logger.info('Clearing network mocks...');
        await this.transport.sendRequest('clear_network_mocks');
    }
    /**
     * Injects CSS into the active tab dynamically.
     */
    async injectStyle(cssString) {
        this.logger.debug('Injecting custom CSS...');
        await this.transport.sendRequest('inject_css', { cssString });
    }
    /**
     * Toggles element layout debug mode (red outlines).
     */
    async toggleLayoutDebug() {
        this.logger.debug('Toggling layout debug mode...');
        await this.transport.sendRequest('toggle_layout_debug_mode');
    }
    /**
     * Retrieves recent console log entries from active page.
     */
    async getConsoleLogs() {
        return await this.transport.sendRequest('get_console_logs');
    }
    /**
     * Retrieves recent network log entries from active page.
     */
    async getNetworkLogs() {
        return await this.transport.sendRequest('get_network_logs');
    }
    /**
     * Retrieves localStorage and sessionStorage contents.
     */
    async getStorage() {
        return await this.transport.sendRequest('get_storage');
    }
    /**
     * Runs Core Web Vitals audit.
     */
    async getWebVitals() {
        this.logger.info('Fetching Core Web Vitals...');
        return await this.transport.sendRequest('get_web_vitals');
    }
    /**
     * Runs security audit scan.
     */
    async runSecurityAudit() {
        this.logger.info('Running security audit scan...');
        return await this.transport.sendRequest('run_security_audit');
    }
    /**
     * Runs accessibility (a11y) audit scan.
     */
    async runAccessibilityAudit() {
        this.logger.info('Running accessibility audit scan...');
        return await this.transport.sendRequest('run_accessibility_audit');
    }
    /**
     * Sets viewport dimensions.
     */
    async setViewport(width, height) {
        this.logger.info(`Setting viewport size to ${width}x${height}`);
        await this.transport.sendRequest('set_viewport_size', { width, height });
        return { width, height };
    }
    /**
     * Pauses execution until the user clicks any element in Chrome.
     */
    async waitForUserClick() {
        this.logger.info('Entering select mode, waiting for user click in browser...');
        return await this.transport.sendRequest('wait_for_user_click');
    }
    /**
     * Uploads a local file (e.g. resume PDF) to a file input or drag-and-drop zone.
     */
    async uploadFile(filePath, selector, tabId) {
        this.logger.info(`Uploading file '${filePath}' to selector '${selector || 'input[type="file"]'}'`);
        return await this.transport.sendRequest('upload_file', { filePath, selector, tabId });
    }
    /**
     * Fills multiple form fields in a single rapid roundtrip.
     */
    async batchFill(actions, tabId) {
        this.logger.info(`Batch filling ${actions.length} fields...`);
        return await this.transport.sendRequest('batch_fill_form', { actions, tabId });
    }
    /**
     * Selects an option from modern searchable custom dropdowns (Workday, Greenhouse, ARIA comboboxes).
     */
    async smartSelectCombobox(triggerSelector, optionText, searchQuery, tabId) {
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
    async extractJobDetails(tabId) {
        this.logger.info('Extracting structured job details...');
        return await this.transport.sendRequest('extract_job_details', { tabId });
    }
    /**
     * Lists all open tabs in Chrome.
     */
    async listTabs() {
        return await this.transport.sendRequest('list_tabs', {});
    }
    /**
     * Evaluates arbitrary JavaScript in the webpage execution context.
     */
    async evaluate(script, tabId) {
        this.logger.debug(`Evaluating script: ${script.substring(0, 80)}...`);
        return await this.transport.sendRequest('execute_script', { script, tabId });
    }
    /**
     * Scrolls the page or a scrollable inner container.
     */
    async scroll(options = {}, tabId) {
        return await this.transport.sendRequest('scroll_page', { ...options, tabId });
    }
    /**
     * Extracts structured data from HTML tables, lists, or card grids.
     */
    async extractStructuredData(targetSelector, type, itemSelector, tabId) {
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
    async assertElement(selector, condition, expected, tabId) {
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
    async manageStorage(type, operation, options = {}, tabId) {
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
    async recordFlow(action, tabId) {
        return await this.transport.sendRequest('record_user_flow', { action, tabId });
    }
}
exports.Page = Page;
//# sourceMappingURL=page.js.map