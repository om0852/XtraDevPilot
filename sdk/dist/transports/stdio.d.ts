import { BaseTransport } from './base.js';
import { Logger } from '../utils/logger.js';
export declare class StdioTransport extends BaseTransport {
    private client;
    private transport;
    private serverPath;
    constructor(logger: Logger, serverPath?: string);
    connect(): Promise<void>;
    sendRequest(action: string, payload?: Record<string, any>): Promise<any>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=stdio.d.ts.map