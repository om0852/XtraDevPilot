/**
 * Base error class for all Xtra DevPilot SDK errors.
 */
export class DevPilotError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'DEVPILOT_ERROR') {
    super(message);
    this.name = 'DevPilotError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when connection to MCP server or WebSocket fails.
 */
export class ConnectionError extends DevPilotError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

/**
 * Thrown when an operation or waiter times out.
 */
export class TimeoutError extends DevPilotError {
  constructor(message: string) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when a targeted DOM element cannot be located.
 */
export class ElementNotFoundError extends DevPilotError {
  public readonly selector: string;

  constructor(selector: string, message?: string) {
    const msg = message || `Element matching selector '${selector}' was not found on the active page.`;
    super(msg, 'ELEMENT_NOT_FOUND');
    this.name = 'ElementNotFoundError';
    this.selector = selector;
  }
}

/**
 * Thrown when an audit fails or returns invalid results.
 */
export class AuditFailedError extends DevPilotError {
  constructor(message: string) {
    super(message, 'AUDIT_FAILED');
    this.name = 'AuditFailedError';
  }
}
