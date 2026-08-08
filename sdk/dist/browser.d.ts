import { Page } from './page.js';
import { ClientOptions } from './types/index.js';
export declare class Browser {
    private transport;
    private logger;
    private activePageInstance;
    private options;
    constructor(options?: ClientOptions);
    /**
     * Connect to Chrome Extension / MCP server.
     */
    connect(): Promise<Browser>;
    /**
     * Returns the active Page instance.
     */
    activePage(): Page;
    /**
     * Alias for activePage() to match Playwright/Puppeteer naming conventions.
     */
    page(): Page;
    /**
     * Opens a new browser tab with target URL (if specified) and returns the Page controller.
     */
    newPage(url?: string): Promise<Page>;
    /**
     * Disconnect transport and close session.
     */
    close(): Promise<void>;
}
/**
 * Convenient helper to launch and connect a new Browser instance.
 */
export declare function launch(options?: ClientOptions): Promise<Browser>;
//# sourceMappingURL=browser.d.ts.map