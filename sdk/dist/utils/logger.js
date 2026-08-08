"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const LOG_LEVEL_WEIGHTS = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};
class Logger {
    level;
    customLogger;
    constructor(options) {
        this.level = options?.level || 'info';
        this.customLogger = options?.customLogger;
    }
    shouldLog(targetLevel) {
        return LOG_LEVEL_WEIGHTS[targetLevel] >= LOG_LEVEL_WEIGHTS[this.level];
    }
    debug(message, ...args) {
        if (!this.shouldLog('debug'))
            return;
        if (this.customLogger) {
            this.customLogger('debug', message, ...args);
        }
        else {
            console.debug(`[XtraDevPilot:DEBUG] ${message}`, ...args);
        }
    }
    info(message, ...args) {
        if (!this.shouldLog('info'))
            return;
        if (this.customLogger) {
            this.customLogger('info', message, ...args);
        }
        else {
            console.log(`[XtraDevPilot:INFO] ${message}`, ...args);
        }
    }
    warn(message, ...args) {
        if (!this.shouldLog('warn'))
            return;
        if (this.customLogger) {
            this.customLogger('warn', message, ...args);
        }
        else {
            console.warn(`[XtraDevPilot:WARN] ${message}`, ...args);
        }
    }
    error(message, ...args) {
        if (!this.shouldLog('error'))
            return;
        if (this.customLogger) {
            this.customLogger('error', message, ...args);
        }
        else {
            console.error(`[XtraDevPilot:ERROR] ${message}`, ...args);
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map