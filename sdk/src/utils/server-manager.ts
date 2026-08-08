import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './logger.js';

export async function isPortListening(port: number = 42819, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
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

function getDefaultServerPath(): string {
  if (typeof __dirname !== 'undefined') {
    return path.resolve(__dirname, '../../../mcp-server/index.js');
  }
  return path.resolve(process.cwd(), 'mcp-server/index.js');
}

/**
 * Ensures XtraDevPilot bridge server is running on the specified port.
 * If not running, automatically spawns it as a background process.
 */
export async function ensureServerRunning(
  logger: Logger,
  port: number = 42819,
  host: string = '127.0.0.1',
  serverPath?: string
): Promise<boolean> {
  const isRunning = await isPortListening(port, host);
  if (isRunning) {
    logger.debug(`Server is already running on ${host}:${port}. Reusing connection.`);
    return true;
  }

  const targetPath = serverPath || getDefaultServerPath();
  logger.info(`XtraDevPilot server not detected on port ${port}. Auto-starting background server at: ${targetPath}`);

  try {
    const child = spawn('node', [targetPath], {
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
  } catch (err: any) {
    logger.error(`Failed to auto-spawn server: ${err.message}`);
    return false;
  }
}
