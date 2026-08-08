"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StdioTransport = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const path_1 = __importDefault(require("path"));
const base_js_1 = require("./base.js");
const index_js_2 = require("../errors/index.js");
function getDefaultServerPath() {
    if (typeof __dirname !== 'undefined') {
        return path_1.default.resolve(__dirname, '../../../mcp-server/index.js');
    }
    return path_1.default.resolve(process.cwd(), 'mcp-server/index.js');
}
class StdioTransport extends base_js_1.BaseTransport {
    client = null;
    transport = null;
    serverPath;
    constructor(logger, serverPath) {
        super(logger);
        this.serverPath = serverPath || getDefaultServerPath();
    }
    async connect() {
        if (this.isConnected)
            return;
        this.logger.debug(`Connecting via StdioTransport to MCP server at: ${this.serverPath}`);
        try {
            this.transport = new stdio_js_1.StdioClientTransport({
                command: 'node',
                args: [this.serverPath]
            });
            this.client = new index_js_1.Client({
                name: 'xtradevpilot-sdk-stdio',
                version: '1.0.0'
            }, {
                capabilities: {}
            });
            await this.client.connect(this.transport);
            this.isConnected = true;
            this.logger.info('Connected to MCP server via StdioClientTransport.');
        }
        catch (err) {
            this.logger.error(`Failed to connect to MCP server: ${err.message}`);
            throw new index_js_2.ConnectionError(`MCP Stdio Connection failed: ${err.message}`);
        }
    }
    async sendRequest(action, payload = {}) {
        if (!this.isConnected || !this.client) {
            throw new index_js_2.ConnectionError('Transport is not connected. Call connect() first.');
        }
        this.logger.debug(`Sending Stdio MCP request for action: ${action}`, payload);
        try {
            const response = await this.client.callTool({
                name: action,
                arguments: payload
            });
            const contentList = (response.content || []);
            if (response.isError) {
                const errorMsg = contentList[0]?.text || 'MCP Tool Error';
                throw new index_js_2.DevPilotError(errorMsg);
            }
            const rawText = contentList[0]?.text;
            if (typeof rawText === 'string') {
                try {
                    return JSON.parse(rawText);
                }
                catch {
                    return rawText;
                }
            }
            return rawText;
        }
        catch (err) {
            if (err instanceof index_js_2.DevPilotError)
                throw err;
            throw new index_js_2.DevPilotError(`Stdio tool invocation error (${action}): ${err.message}`);
        }
    }
    async disconnect() {
        if (this.transport) {
            this.logger.debug('Closing StdioTransport...');
            await this.transport.close();
            this.transport = null;
            this.client = null;
            this.isConnected = false;
            this.logger.info('Disconnected StdioTransport.');
        }
    }
}
exports.StdioTransport = StdioTransport;
//# sourceMappingURL=stdio.js.map