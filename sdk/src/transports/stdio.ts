import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { BaseTransport } from './base.js';
import { Logger } from '../utils/logger.js';
import { ConnectionError, DevPilotError } from '../errors/index.js';

function getDefaultServerPath(): string {
  if (typeof __dirname !== 'undefined') {
    return path.resolve(__dirname, '../../../mcp-server/index.js');
  }
  return path.resolve(process.cwd(), 'mcp-server/index.js');
}

export class StdioTransport extends BaseTransport {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverPath: string;

  constructor(logger: Logger, serverPath?: string) {
    super(logger);
    this.serverPath = serverPath || getDefaultServerPath();
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;

    this.logger.debug(`Connecting via StdioTransport to MCP server at: ${this.serverPath}`);
    try {
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [this.serverPath]
      });

      this.client = new Client(
        {
          name: 'xtradevpilot-sdk-stdio',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await this.client.connect(this.transport);
      this.isConnected = true;
      this.logger.info('Connected to MCP server via StdioClientTransport.');
    } catch (err: any) {
      this.logger.error(`Failed to connect to MCP server: ${err.message}`);
      throw new ConnectionError(`MCP Stdio Connection failed: ${err.message}`);
    }
  }

  public async sendRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    if (!this.isConnected || !this.client) {
      throw new ConnectionError('Transport is not connected. Call connect() first.');
    }

    this.logger.debug(`Sending Stdio MCP request for action: ${action}`, payload);
    try {
      const response = await this.client.callTool({
        name: action,
        arguments: payload
      });

      const contentList = (response.content || []) as any[];
      if (response.isError) {
        const errorMsg = contentList[0]?.text || 'MCP Tool Error';
        throw new DevPilotError(errorMsg);
      }

      const rawText = contentList[0]?.text;
      if (typeof rawText === 'string') {
        try {
          return JSON.parse(rawText);
        } catch {
          return rawText;
        }
      }
      return rawText;
    } catch (err: any) {
      if (err instanceof DevPilotError) throw err;
      throw new DevPilotError(`Stdio tool invocation error (${action}): ${err.message}`);
    }
  }

  public async disconnect(): Promise<void> {
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
