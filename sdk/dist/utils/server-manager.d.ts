import { Logger } from './logger.js';
export declare function isPortListening(port?: number, host?: string): Promise<boolean>;
/**
 * Ensures XtraDevPilot bridge server is running on the specified port.
 * If not running, automatically spawns it as a background process.
 */
export declare function ensureServerRunning(logger: Logger, port?: number, host?: string, serverPath?: string): Promise<boolean>;
//# sourceMappingURL=server-manager.d.ts.map