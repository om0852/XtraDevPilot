import { BaseTransport } from './transports/base.js';
import { StdioTransport } from './transports/stdio.js';
import { WebSocketTransport } from './transports/websocket.js';
import { Page } from './page.js';
import { Logger } from './utils/logger.js';
import { ClientOptions } from './types/index.js';
import { ensureServerRunning } from './utils/server-manager.js';

export class Browser {
  private transport: BaseTransport;
  private logger: Logger;
  private activePageInstance: Page;
  private options: ClientOptions;

  constructor(options: ClientOptions = {}) {
    this.options = options;
    this.logger = new Logger(options.logger);

    const transportType = options.transport || 'websocket'; // Default to WebSocket for zero-overhead persistent server mode
    if (transportType === 'websocket') {
      this.transport = new WebSocketTransport(
        this.logger,
        options.wsHost || '127.0.0.1',
        options.wsPort || 42819,
        options.timeoutMs || 10000
      );
    } else {
      this.transport = new StdioTransport(this.logger, options.serverPath);
    }

    this.activePageInstance = new Page(this.transport, this.logger, options.timeoutMs || 10000);
  }

  /**
   * Connect to Chrome Extension / MCP server.
   */
  public async connect(): Promise<Browser> {
    if (this.options.autoStartServer !== false) {
      await ensureServerRunning(
        this.logger,
        this.options.wsPort || 42819,
        this.options.wsHost || '127.0.0.1',
        this.options.serverPath
      );
    }

    await this.transport.connect();
    return this;
  }

  /**
   * Returns the active Page instance.
   */
  public activePage(): Page {
    return this.activePageInstance;
  }

  /**
   * Alias for activePage() to match Playwright/Puppeteer naming conventions.
   */
  public page(): Page {
    return this.activePage();
  }

  /**
   * Opens a new browser tab with target URL (if specified) and returns the Page controller.
   */
  public async newPage(url?: string): Promise<Page> {
    if (url) {
      await this.activePageInstance.openTab(url);
    } else {
      await this.activePageInstance.openTab('https://google.com');
    }
    return this.activePageInstance;
  }

  /**
   * Disconnect transport and close session.
   */
  public async close(): Promise<void> {
    await this.transport.disconnect();
  }
}

/**
 * Convenient helper to launch and connect a new Browser instance.
 */
export async function launch(options?: ClientOptions): Promise<Browser> {
  const browser = new Browser(options);
  await browser.connect();
  return browser;
}
