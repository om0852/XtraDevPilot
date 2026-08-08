import test from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../../src/utils/logger.js';
import { ConnectionError, DevPilotError, TimeoutError, ElementNotFoundError } from '../../src/errors/index.js';
import { Browser } from '../../src/browser.js';
test('Error Taxonomy Hierarchy', () => {
    const devErr = new DevPilotError('base error');
    assert.equal(devErr.code, 'DEVPILOT_ERROR');
    assert.equal(devErr instanceof Error, true);
    const connErr = new ConnectionError('failed connection');
    assert.equal(connErr.code, 'CONNECTION_ERROR');
    assert.equal(connErr instanceof DevPilotError, true);
    const timeoutErr = new TimeoutError('timed out');
    assert.equal(timeoutErr.code, 'TIMEOUT_ERROR');
    assert.equal(timeoutErr instanceof DevPilotError, true);
    const elemErr = new ElementNotFoundError('#missing', 'not found');
    assert.equal(elemErr.code, 'ELEMENT_NOT_FOUND');
    assert.equal(elemErr.selector, '#missing');
    assert.equal(elemErr instanceof DevPilotError, true);
});
test('Logger Levels & Output', () => {
    const logs = [];
    const logger = new Logger({
        level: 'warn',
        customLogger: (level, msg) => logs.push(`${level}:${msg}`)
    });
    logger.debug('debug test'); // Should be ignored
    logger.info('info test'); // Should be ignored
    logger.warn('warn test'); // Should log
    logger.error('error test'); // Should log
    assert.deepEqual(logs, ['warn:warn test', 'error:error test']);
});
test('Browser Initialization & Options', () => {
    const browser = new Browser({
        transport: 'websocket',
        wsPort: 42819,
        logger: { level: 'silent' }
    });
    assert.notEqual(browser.page(), null);
    assert.notEqual(browser.activePage(), null);
});
//# sourceMappingURL=sdk.test.js.map