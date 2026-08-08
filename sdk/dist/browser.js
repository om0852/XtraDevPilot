"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Browser = void 0;
exports.launch = launch;
const stdio_js_1 = require("./transports/stdio.js");
const websocket_js_1 = require("./transports/websocket.js");
const page_js_1 = require("./page.js");
const logger_js_1 = require("./utils/logger.js");
const server_manager_js_1 = require("./utils/server-manager.js");
class Browser {
    transport;
    logger;
    activePageInstance;
    options;
    constructor(options = {}) {
        this.options = options;
        this.logger = new logger_js_1.Logger(options.logger);
        const transportType = options.transport || 'websocket'; // Default to WebSocket for zero-overhead persistent server mode
        if (transportType === 'websocket') {
            this.transport = new websocket_js_1.WebSocketTransport(this.logger, options.wsHost || '127.0.0.1', options.wsPort || 42819, options.timeoutMs || 10000);
        }
        else {
            this.transport = new stdio_js_1.StdioTransport(this.logger, options.serverPath);
        }
        this.activePageInstance = new page_js_1.Page(this.transport, this.logger, options.timeoutMs || 10000);
    }
    /**
     * Connect to Chrome Extension / MCP server.
     */
    async connect() {
        if (this.options.autoStartServer !== false) {
            await (0, server_manager_js_1.ensureServerRunning)(this.logger, this.options.wsPort || 42819, this.options.wsHost || '127.0.0.1', this.options.serverPath);
        }
        await this.transport.connect();
        return this;
    }
    /**
     * Returns the active Page instance.
     */
    activePage() {
        return this.activePageInstance;
    }
    /**
     * Alias for activePage() to match Playwright/Puppeteer naming conventions.
     */
    page() {
        return this.activePage();
    }
    /**
     * Opens a new browser tab with target URL (if specified) and returns the Page controller.
     */
    async newPage(url) {
        if (url) {
            await this.activePageInstance.openTab(url);
        }
        else {
            await this.activePageInstance.openTab('https://google.com');
        }
        return this.activePageInstance;
    }
    /**
     * Disconnect transport and close session.
     */
    async close() {
        await this.transport.disconnect();
    }
}
exports.Browser = Browser;
/**
 * Convenient helper to launch and connect a new Browser instance.
 */
async function launch(options) {
    const browser = new Browser(options);
    await browser.connect();
    return browser;
}
//# sourceMappingURL=browser.js.map