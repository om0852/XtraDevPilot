import { Logger } from '../utils/logger.js';

export interface TransportResponse {
  result?: any;
  error?: string;
}

export abstract class BaseTransport {
  protected logger: Logger;
  protected isConnected: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public abstract connect(): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract sendRequest(action: string, payload?: Record<string, any>): Promise<any>;

  public connected(): boolean {
    return this.isConnected;
  }
}
