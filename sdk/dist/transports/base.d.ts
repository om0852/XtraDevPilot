import { Logger } from '../utils/logger.js';
export interface TransportResponse {
    result?: any;
    error?: string;
}
export declare abstract class BaseTransport {
    protected logger: Logger;
    protected isConnected: boolean;
    constructor(logger: Logger);
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract sendRequest(action: string, payload?: Record<string, any>): Promise<any>;
    connected(): boolean;
}
//# sourceMappingURL=base.d.ts.map