import { BaseTransport } from './base.js';
import { Logger } from '../utils/logger.js';
export declare class WebSocketTransport extends BaseTransport {
    private ws;
    private host;
    private port;
    private timeoutMs;
    private messageIdCounter;
    private pendingRequests;
    private static readonly ACTION_MAP;
    constructor(logger: Logger, host?: string, port?: number, timeoutMs?: number);
    connect(): Promise<void>;
    private handleMessage;
    sendRequest(action: string, payload?: Record<string, any>): Promise<any>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=websocket.d.ts.map