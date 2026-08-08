/**
 * Base error class for all Xtra DevPilot SDK errors.
 */
export declare class DevPilotError extends Error {
    readonly code: string;
    constructor(message: string, code?: string);
}
/**
 * Thrown when connection to MCP server or WebSocket fails.
 */
export declare class ConnectionError extends DevPilotError {
    constructor(message: string);
}
/**
 * Thrown when an operation or waiter times out.
 */
export declare class TimeoutError extends DevPilotError {
    constructor(message: string);
}
/**
 * Thrown when a targeted DOM element cannot be located.
 */
export declare class ElementNotFoundError extends DevPilotError {
    readonly selector: string;
    constructor(selector: string, message?: string);
}
/**
 * Thrown when an audit fails or returns invalid results.
 */
export declare class AuditFailedError extends DevPilotError {
    constructor(message: string);
}
//# sourceMappingURL=index.d.ts.map