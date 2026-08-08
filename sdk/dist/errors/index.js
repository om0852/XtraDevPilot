"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditFailedError = exports.ElementNotFoundError = exports.TimeoutError = exports.ConnectionError = exports.DevPilotError = void 0;
/**
 * Base error class for all Xtra DevPilot SDK errors.
 */
class DevPilotError extends Error {
    code;
    constructor(message, code = 'DEVPILOT_ERROR') {
        super(message);
        this.name = 'DevPilotError';
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.DevPilotError = DevPilotError;
/**
 * Thrown when connection to MCP server or WebSocket fails.
 */
class ConnectionError extends DevPilotError {
    constructor(message) {
        super(message, 'CONNECTION_ERROR');
        this.name = 'ConnectionError';
    }
}
exports.ConnectionError = ConnectionError;
/**
 * Thrown when an operation or waiter times out.
 */
class TimeoutError extends DevPilotError {
    constructor(message) {
        super(message, 'TIMEOUT_ERROR');
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
/**
 * Thrown when a targeted DOM element cannot be located.
 */
class ElementNotFoundError extends DevPilotError {
    selector;
    constructor(selector, message) {
        const msg = message || `Element matching selector '${selector}' was not found on the active page.`;
        super(msg, 'ELEMENT_NOT_FOUND');
        this.name = 'ElementNotFoundError';
        this.selector = selector;
    }
}
exports.ElementNotFoundError = ElementNotFoundError;
/**
 * Thrown when an audit fails or returns invalid results.
 */
class AuditFailedError extends DevPilotError {
    constructor(message) {
        super(message, 'AUDIT_FAILED');
        this.name = 'AuditFailedError';
    }
}
exports.AuditFailedError = AuditFailedError;
//# sourceMappingURL=index.js.map