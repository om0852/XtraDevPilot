import { Browser, launch } from './browser.js';
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
export class XtraDevPilot {
  private browserInstance?: Browser;
  private options: ClientOptions;

  constructor(options: ClientOptions = {}) {
    this.options = options;
  }

  /**
   * Connect to the browser and return the active Page controller.
   */
  public async connect(): Promise<Page> {
    this.browserInstance = await launch(this.options);
    return this.browserInstance.page();
  }

  /**
   * Close session and disconnect.
   */
  public async disconnect(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = undefined;
    }
  }
}
