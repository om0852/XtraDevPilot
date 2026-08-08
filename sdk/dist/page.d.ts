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
}
//# sourceMappingURL=page.d.ts.map