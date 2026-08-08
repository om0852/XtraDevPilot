import { Page } from './page.js';
import { ClientOptions } from './types/index.js';
export * from './types/index.js';
export * from './errors/index.js';
export * from './utils/logger.js';
export * from './transports/base.js';
export * from './transports/stdio.js';
export * from './transports/websocket.js';
export * from './page.js';
export * from './browser.js';
/**
 * Main SDK entrance wrapper for XtraDevPilot automation.
 */
export declare class XtraDevPilot {
    private browserInstance?;
    private options;
    constructor(options?: ClientOptions);
    /**
     * Connect to the browser and return the active Page controller.
     */
    connect(): Promise<Page>;
    /**
     * Close session and disconnect.
     */
    disconnect(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map