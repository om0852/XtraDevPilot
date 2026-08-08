import { LoggerOptions, LogLevel } from '../types/index.js';

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export class Logger {
  private level: LogLevel;
  private customLogger?: LoggerOptions['customLogger'];

  constructor(options?: LoggerOptions) {
    this.level = options?.level || 'info';
    this.customLogger = options?.customLogger;
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    return LOG_LEVEL_WEIGHTS[targetLevel] >= LOG_LEVEL_WEIGHTS[this.level];
  }

  public debug(message: string, ...args: any[]): void {
    if (!this.shouldLog('debug')) return;
    if (this.customLogger) {
      this.customLogger('debug', message, ...args);
    } else {
      console.debug(`[XtraDevPilot:DEBUG] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (!this.shouldLog('info')) return;
    if (this.customLogger) {
      this.customLogger('info', message, ...args);
    } else {
      console.log(`[XtraDevPilot:INFO] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (!this.shouldLog('warn')) return;
    if (this.customLogger) {
      this.customLogger('warn', message, ...args);
    } else {
      console.warn(`[XtraDevPilot:WARN] ${message}`, ...args);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (!this.shouldLog('error')) return;
    if (this.customLogger) {
      this.customLogger('error', message, ...args);
    } else {
      console.error(`[XtraDevPilot:ERROR] ${message}`, ...args);
    }
  }
}
