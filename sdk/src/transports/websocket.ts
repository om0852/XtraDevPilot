import WebSocket from 'ws';
import { BaseTransport } from './base.js';
import { Logger } from '../utils/logger.js';
import { ConnectionError, DevPilotError, TimeoutError } from '../errors/index.js';

export class WebSocketTransport extends BaseTransport {
  private ws: WebSocket | null = null;
  private host: string;
  private port: number;
  private timeoutMs: number;
  private messageIdCounter: number = 1;
  private pendingRequests: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

  // Mapping SDK action names to Chrome Extension raw WebSocket action codes
  private static readonly ACTION_MAP: Record<string, string> = {
    'open_tab': 'OPEN_TAB',
    'navigate': 'NAVIGATE',
    'get_tab_info': 'GET_TAB_INFO',
    'get_dom_snapshot': 'GET_DOM',
    'get_clean_dom_snapshot': 'GET_CLEAN_DOM',
    'click_element': 'CLICK_ELEMENT',
    'type_text': 'TYPE_TEXT',
    'highlight_element': 'HIGHLIGHT_ELEMENT',
    'wait_for_user_click': 'WAIT_FOR_CLICK',
    'capture_screenshot': 'CAPTURE_SCREENSHOT',
    'mock_network_response': 'MOCK_NETWORK_RESPONSE',
    'clear_network_mocks': 'CLEAR_NETWORK_MOCKS',
    'inject_css': 'INJECT_CSS',
    'toggle_layout_debug_mode': 'TOGGLE_LAYOUT_DEBUG',
    'get_web_vitals': 'GET_WEB_VITALS',
    'run_security_audit': 'RUN_SECURITY_AUDIT',
    'run_accessibility_audit': 'RUN_ACCESSIBILITY_AUDIT',
    'set_viewport_size': 'SET_VIEWPORT_SIZE',
    'get_network_logs': 'GET_NETWORK_LOGS',
    'get_console_logs': 'GET_CONSOLE_LOGS',
    'get_storage': 'GET_STORAGE'
  };

  constructor(logger: Logger, host: string = '127.0.0.1', port: number = 42819, timeoutMs: number = 10000) {
    super(logger);
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;

    const url = `ws://${this.host}:${this.port}`;
    this.logger.debug(`Connecting directly via WebSocket to: ${url}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.terminate();
            reject(new ConnectionError(`WebSocket connection to ${url} timed out.`));
          }
        }, this.timeoutMs);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          this.logger.info(`Successfully connected to WebSocket bridge at ${url}`);
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (err) => {
          this.logger.error(`WebSocket error: ${err.message}`);
          if (!this.isConnected) {
            clearTimeout(connectionTimeout);
            reject(new ConnectionError(`WebSocket error: ${err.message}`));
          }
        });

        this.ws.on('close', () => {
          this.logger.info('WebSocket connection closed.');
          this.isConnected = false;
        });

      } catch (err: any) {
        reject(new ConnectionError(`Failed to initialize WebSocket: ${err.message}`));
      }
    });
  }

  private handleMessage(rawMessage: string): void {
    try {
      const data = JSON.parse(rawMessage);
      if (data.type === 'PING') return;

      if (data.id && this.pendingRequests.has(data.id)) {
        const { resolve, reject } = this.pendingRequests.get(data.id)!;
        this.pendingRequests.delete(data.id);

        if (data.error) {
          reject(new DevPilotError(data.error));
        } else {
          resolve(data.result);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to parse WebSocket incoming message: ${e.message}`);
    }
  }

  public async sendRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new ConnectionError('WebSocket transport is not connected.');
    }

    const rawAction = WebSocketTransport.ACTION_MAP[action] || action.toUpperCase();
    const id = this.messageIdCounter++;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new TimeoutError(`Action '${action}' timed out waiting for Chrome response.`));
      }, this.timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timeout);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      });

      const message = JSON.stringify({ id, action: rawAction, ...payload });
      this.ws!.send(message);
    });
  }

  public async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.logger.info('Disconnected WebSocketTransport.');
    }
  }
}
