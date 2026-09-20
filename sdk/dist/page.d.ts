import { BaseTransport } from './transports/base.js';
import { Logger } from './utils/logger.js';
import { ClickOptions, ConsoleLogEntry, NetworkLogEntry, ScreenshotOptions, SecurityAuditReport, AccessibilityAuditReport, StorageData, TypeOptions, TabInfo, ViewportSize, WaitOptions, WebVitalsReport } from './types/index.js';
export declare class Page {
    private transport;
    private logger;
    private defaultTimeoutMs;
    constructor(transport: BaseTransport, logger: Logger, defaultTimeoutMs?: number);
    /**
     * Helper to wait/poll until a condition function resolves to truthy.
     */
    private poll;
    /**
     * Polls the DOM until an element matching selector is present.
     */
    waitForSelector(selector: string, options?: WaitOptions): Promise<boolean>;
    /**
     * Simulates a user click on an element matching CSS selector.
     */
    /**
     * Navigates the active browser tab to the target URL.
     */
    goto(url: string): Promise<any>;
    /**
     * Opens a new browser tab in Chrome and navigates to target URL.
     */
    openTab(url: string): Promise<any>;
    click(selector: string, options?: ClickOptions): Promise<void>;
    /**
     * Simulates typing text into an input field or textarea.
     */
    type(selector: string, text: string, options?: TypeOptions): Promise<void>;
    /**
     * Visually highlights an element on screen and scrolls it into view.
     */
    highlight(selector: string): Promise<void>;
    /**
     * Retrieves tab metadata (title, URL, dimensions, favicon, status) of active page.
     */
    getTabInfo(): Promise<TabInfo>;
    /**
     * Retrieves full DOM HTML snapshot of active page.
     */
    getDomSnapshot(): Promise<string>;
    /**
     * Retrieves clean, token-optimized HTML structure of active page.
     */
    getCleanDomSnapshot(): Promise<string>;
    /**
     * Captures a viewport screenshot and optionally saves it to disk.
     */
    screenshot(options?: ScreenshotOptions): Promise<string>;
    /**
     * Mock network requests matching a URL pattern.
     */
    route(urlPattern: string, responseBody: Record<string, any> | string, status?: number): Promise<void>;
    /**
     * Clears all network mocks.
     */
    unrouteAll(): Promise<void>;
    /**
     * Injects CSS into the active tab dynamically.
     */
    injectStyle(cssString: string): Promise<void>;
    /**
     * Toggles element layout debug mode (red outlines).
     */
    toggleLayoutDebug(): Promise<void>;
    /**
     * Retrieves recent console log entries from active page.
     */
    getConsoleLogs(): Promise<ConsoleLogEntry[]>;
    /**
     * Retrieves recent network log entries from active page.
     */
    getNetworkLogs(): Promise<NetworkLogEntry[]>;
    /**
     * Retrieves localStorage and sessionStorage contents.
     */
    getStorage(): Promise<StorageData>;
    /**
     * Runs Core Web Vitals audit.
     */
    getWebVitals(): Promise<WebVitalsReport>;
    /**
     * Runs security audit scan.
     */
    runSecurityAudit(): Promise<SecurityAuditReport>;
    /**
     * Runs accessibility (a11y) audit scan.
     */
    runAccessibilityAudit(): Promise<AccessibilityAuditReport>;
    /**
     * Sets viewport dimensions.
     */
    setViewport(width: number, height: number): Promise<ViewportSize>;
    /**
     * Pauses execution until the user clicks any element in Chrome.
     */
    waitForUserClick(): Promise<any>;
    /**
     * Uploads a local file (e.g. resume PDF) to a file input or drag-and-drop zone.
     */
    uploadFile(filePath: string, selector?: string, tabId?: number): Promise<any>;
    /**
     * Fills multiple form fields in a single rapid roundtrip.
     */
    batchFill(actions: Array<{
        selector: string;
        value?: string;
        action?: 'type' | 'select' | 'click' | 'check' | 'uncheck';
        waitMs?: number;
    }>, tabId?: number): Promise<any>;
    /**
     * Selects an option from modern searchable custom dropdowns (Workday, Greenhouse, ARIA comboboxes).
     */
    smartSelectCombobox(triggerSelector: string, optionText: string, searchQuery?: string, tabId?: number): Promise<any>;
    /**
     * Extracts structured job posting details from the active job page.
     */
    extractJobDetails(tabId?: number): Promise<any>;
    /**
     * Lists all open tabs in Chrome.
     */
    listTabs(): Promise<any>;
    /**
     * Evaluates arbitrary JavaScript in the webpage execution context.
     */
    evaluate(script: string, tabId?: number): Promise<any>;
    /**
     * Scrolls the page or a scrollable inner container.
     */
    scroll(options?: {
        direction?: 'down' | 'up' | 'top' | 'bottom';
        amount?: number;
        scrollToSelector?: string;
        containerSelector?: string;
        smooth?: boolean;
    }, tabId?: number): Promise<any>;
    /**
     * Extracts structured data from HTML tables, lists, or card grids.
     */
    extractStructuredData(targetSelector?: string, type?: 'auto' | 'table' | 'cards' | 'list', itemSelector?: string, tabId?: number): Promise<any>;
    /**
     * QA assertion engine to check element state.
     */
    assertElement(selector: string, condition: 'is_visible' | 'is_hidden' | 'is_enabled' | 'is_disabled' | 'contains_text' | 'has_value' | 'has_attribute', expected?: string, tabId?: number): Promise<any>;
    /**
     * Storage and cookie management.
     */
    manageStorage(type: 'cookie' | 'local_storage' | 'session_storage', operation: 'get' | 'get_all' | 'set' | 'remove' | 'clear', options?: {
        name?: string;
        value?: string;
        url?: string;
        domain?: string;
    }, tabId?: number): Promise<any>;
    /**
     * Records user interaction flow and compiles it into a Playwright test.
     */
    recordFlow(action: 'start' | 'stop' | 'status', tabId?: number): Promise<any>;
}
//# sourceMappingURL=page.d.ts.map