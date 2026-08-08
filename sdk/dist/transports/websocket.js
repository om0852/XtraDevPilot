"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketTransport = void 0;
const ws_1 = __importDefault(require("ws"));
const base_js_1 = require("./base.js");
const index_js_1 = require("../errors/index.js");
class WebSocketTransport extends base_js_1.BaseTransport {
    ws = null;
    host;
    port;
    timeoutMs;
    messageIdCounter = 1;
    pendingRequests = new Map();
    // Mapping SDK action names to Chrome Extension raw WebSocket action codes
    static ACTION_MAP = {
        'open_tab': 'OPEN_TAB',
        'navigate': 'NAVIGATE',
        'get_tab_info': 'GET_TAB_INFO',
        'get_dom_snapshot': 'GET_DOM',
        'get_clean_dom_snapshot': 'GET_CLEAN_DOM',
        'click_element': 'CLICK_ELEMENT',
        'type_text': 'TYPE_TEXT',
        'highlight_element': 'HIGHLIGHT_ELEMENT',
        'wait_for_user_click': 'WAIT_FOR_CLICK',
        'capture_screenshot': 'CAPTURE_SCREENSHOT',
        'mock_network_response': 'MOCK_NETWORK_RESPONSE',
        'clear_network_mocks': 'CLEAR_NETWORK_MOCKS',
        'inject_css': 'INJECT_CSS',
        'toggle_layout_debug_mode': 'TOGGLE_LAYOUT_DEBUG',
        'get_web_vitals': 'GET_WEB_VITALS',
        'run_security_audit': 'RUN_SECURITY_AUDIT',
        'run_accessibility_audit': 'RUN_ACCESSIBILITY_AUDIT',
        'set_viewport_size': 'SET_VIEWPORT_SIZE',
        'get_network_logs': 'GET_NETWORK_LOGS',
        'get_console_logs': 'GET_CONSOLE_LOGS',
        'get_storage': 'GET_STORAGE'
    };
    constructor(logger, host = '127.0.0.1', port = 42819, timeoutMs = 10000) {
        super(logger);
        this.host = host;
        this.port = port;
        this.timeoutMs = timeoutMs;
    }
    async connect() {
        if (this.isConnected)
            return;
        const url = `ws://${this.host}:${this.port}`;
        this.logger.debug(`Connecting directly via WebSocket to: ${url}`);
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.default(url);
                const connectionTimeout = setTimeout(() => {
                    if (this.ws && this.ws.readyState !== ws_1.default.OPEN) {
                        this.ws.terminate();
                        reject(new index_js_1.ConnectionError(`WebSocket connection to ${url} timed out.`));
                    }
                }, this.timeoutMs);
                this.ws.on('open', () => {
                    clearTimeout(connectionTimeout);
                    this.isConnected = true;
                    this.logger.info(`Successfully connected to WebSocket bridge at ${url}`);
                    resolve();
                });
                this.ws.on('message', (data) => {
                    this.handleMessage(data.toString());
                });
                this.ws.on('error', (err) => {
                    this.logger.error(`WebSocket error: ${err.message}`);
                    if (!this.isConnected) {
                        clearTimeout(connectionTimeout);
                        reject(new index_js_1.ConnectionError(`WebSocket error: ${err.message}`));
                    }
                });
                this.ws.on('close', () => {
                    this.logger.info('WebSocket connection closed.');
                    this.isConnected = false;
                });
            }
            catch (err) {
                reject(new index_js_1.ConnectionError(`Failed to initialize WebSocket: ${err.message}`));
            }
        });
    }
    handleMessage(rawMessage) {
        try {
            const data = JSON.parse(rawMessage);
            if (data.type === 'PING')
                return;
            if (data.id && this.pendingRequests.has(data.id)) {
                const { resolve, reject } = this.pendingRequests.get(data.id);
                this.pendingRequests.delete(data.id);
                if (data.error) {
                    reject(new index_js_1.DevPilotError(data.error));
                }
                else {
                    resolve(data.result);
                }
            }
        }
        catch (e) {
            this.logger.warn(`Failed to parse WebSocket incoming message: ${e.message}`);
        }
    }
    async sendRequest(action, payload = {}) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            throw new index_js_1.ConnectionError('WebSocket transport is not connected.');
        }
        const rawAction = WebSocketTransport.ACTION_MAP[action] || action.toUpperCase();
        const id = this.messageIdCounter++;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new index_js_1.TimeoutError(`Action '${action}' timed out waiting for Chrome response.`));
            }, this.timeoutMs);
            this.pendingRequests.set(id, {
                resolve: (val) => {
                    clearTimeout(timeout);
                    resolve(val);
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    reject(err);
                }
            });
            const message = JSON.stringify({ id, action: rawAction, ...payload });
            this.ws.send(message);
        });
    }
    async disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.logger.info('Disconnected WebSocketTransport.');
        }
    }
}
exports.WebSocketTransport = WebSocketTransport;
//# sourceMappingURL=websocket.js.map