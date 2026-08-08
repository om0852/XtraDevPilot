export type TransportType = 'stdio' | 'websocket';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export interface LoggerOptions {
    level?: LogLevel;
    customLogger?: (level: LogLevel, message: string, ...args: any[]) => void;
}
export interface ClientOptions {
    /**
     * Transport mode to connect with.
     * 'stdio': Spawns local MCP Server process (Default).
     * 'websocket': Connects directly to Chrome Extension WebSocket bridge port.
     */
    transport?: TransportType;
    /**
     * Path to the mcp-server index.js when using stdio transport.
     */
    serverPath?: string;
    /**
     * WebSocket port when using direct WebSocket transport. Defaults to 42819.
     */
    wsPort?: number;
    /**
     * Host for WebSocket transport. Defaults to '127.0.0.1'.
     */
    wsHost?: string;
    /**
     * Global default timeout in milliseconds for operations. Defaults to 10000ms.
     */
    timeoutMs?: number;
    /**
     * Logger settings.
     */
    logger?: LoggerOptions;
    /**
     * Retry attempts for element polling.
     */
    maxRetries?: number;
    /**
     * Automatically start and keep the background bridge server running if not already active. Defaults to true.
     */
    autoStartServer?: boolean;
}
export interface TabInfo {
    id?: number;
    title: string;
    url: string;
    favIconUrl?: string;
    width?: number;
    height?: number;
    status?: string;
}
export interface ViewportSize {
    width: number;
    height: number;
}
export interface WaitOptions {
    timeoutMs?: number;
    pollingIntervalMs?: number;
}
export interface ClickOptions extends WaitOptions {
    highlight?: boolean;
}
export interface TypeOptions extends WaitOptions {
    clearFirst?: boolean;
}
export interface ScreenshotOptions {
    path?: string;
}
export interface MockRouteOptions {
    urlPattern: string;
    responseBody: Record<string, any> | string;
    status?: number;
}
export interface ConsoleLogEntry {
    type: 'log' | 'warn' | 'error' | 'info' | 'debug';
    text: string;
    timestamp?: number;
}
export interface NetworkLogEntry {
    url: string;
    method: string;
    status?: number;
    type?: string;
    timestamp?: number;
}
export interface StorageData {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
}
export interface WebVitalsMetric {
    name: 'LCP' | 'CLS' | 'FCP' | string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
}
export interface WebVitalsReport {
    metrics: WebVitalsMetric[];
    url?: string;
    timestamp?: number;
}
export interface AuditIssue {
    id: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    selector?: string;
}
export interface SecurityAuditReport {
    passed: boolean;
    score?: number;
    issues: AuditIssue[];
}
export interface AccessibilityAuditReport {
    passed: boolean;
    violationsCount: number;
    issues: AuditIssue[];
}
//# sourceMappingURL=index.d.ts.map