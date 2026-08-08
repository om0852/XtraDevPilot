"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPortListening = isPortListening;
exports.ensureServerRunning = ensureServerRunning;
const child_process_1 = require("child_process");
const net_1 = __importDefault(require("net"));
const path_1 = __importDefault(require("path"));
async function isPortListening(port = 42819, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const socket = new net_1.default.Socket();
        socket.setTimeout(400);
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, host);
    });
}
function getDefaultServerPath() {
    if (typeof __dirname !== 'undefined') {
        return path_1.default.resolve(__dirname, '../../../mcp-server/index.js');
    }
    return path_1.default.resolve(process.cwd(), 'mcp-server/index.js');
}
/**
 * Ensures XtraDevPilot bridge server is running on the specified port.
 * If not running, automatically spawns it as a background process.
 */
async function ensureServerRunning(logger, port = 42819, host = '127.0.0.1', serverPath) {
    const isRunning = await isPortListening(port, host);
    if (isRunning) {
        logger.debug(`Server is already running on ${host}:${port}. Reusing connection.`);
        return true;
    }
    const targetPath = serverPath || getDefaultServerPath();
    logger.info(`XtraDevPilot server not detected on port ${port}. Auto-starting background server at: ${targetPath}`);
    try {
        const child = (0, child_process_1.spawn)('node', [targetPath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();
        // Poll for port to open (up to 3 seconds)
        const startTime = Date.now();
        while (Date.now() - startTime < 3000) {
            await new Promise((r) => setTimeout(r, 200));
            if (await isPortListening(port, host)) {
                logger.info(`✅ Auto-started XtraDevPilot bridge server on port ${port}. Chrome can connect!`);
                return true;
            }
        }
        logger.warn(`Server spawned but port ${port} did not respond within 3s.`);
        return false;
    }
    catch (err) {
        logger.error(`Failed to auto-spawn server: ${err.message}`);
        return false;
    }
}
//# sourceMappingURL=server-manager.js.map