"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const logger_js_1 = require("../../utils/logger.js");
const index_js_1 = require("../../errors/index.js");
const browser_js_1 = require("../../browser.js");
(0, node_test_1.default)('Error Taxonomy Hierarchy', () => {
    const devErr = new index_js_1.DevPilotError('base error');
    strict_1.default.equal(devErr.code, 'DEVPILOT_ERROR');
    strict_1.default.equal(devErr instanceof Error, true);
    const connErr = new index_js_1.ConnectionError('failed connection');
    strict_1.default.equal(connErr.code, 'CONNECTION_ERROR');
    strict_1.default.equal(connErr instanceof index_js_1.DevPilotError, true);
    const timeoutErr = new index_js_1.TimeoutError('timed out');
    strict_1.default.equal(timeoutErr.code, 'TIMEOUT_ERROR');
    strict_1.default.equal(timeoutErr instanceof index_js_1.DevPilotError, true);
    const elemErr = new index_js_1.ElementNotFoundError('#missing', 'not found');
    strict_1.default.equal(elemErr.code, 'ELEMENT_NOT_FOUND');
    strict_1.default.equal(elemErr.selector, '#missing');
    strict_1.default.equal(elemErr instanceof index_js_1.DevPilotError, true);
});
(0, node_test_1.default)('Logger Levels & Output', () => {
    const logs = [];
    const logger = new logger_js_1.Logger({
        level: 'warn',
        customLogger: (level, msg) => logs.push(`${level}:${msg}`)
    });
    logger.debug('debug test'); // Should be ignored
    logger.info('info test'); // Should be ignored
    logger.warn('warn test'); // Should log
    logger.error('error test'); // Should log
    strict_1.default.deepEqual(logs, ['warn:warn test', 'error:error test']);
});
(0, node_test_1.default)('Browser Initialization & Options', () => {
    const browser = new browser_js_1.Browser({
        transport: 'websocket',
        wsPort: 42819,
        logger: { level: 'silent' }
    });
    strict_1.default.notEqual(browser.page(), null);
    strict_1.default.notEqual(browser.activePage(), null);
});
//# sourceMappingURL=sdk.test.js.map