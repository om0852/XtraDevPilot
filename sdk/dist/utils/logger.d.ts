import { LoggerOptions } from '../types/index.js';
export declare class Logger {
    private level;
    private customLogger?;
    constructor(options?: LoggerOptions);
    private shouldLog;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}
//# sourceMappingURL=logger.d.ts.map