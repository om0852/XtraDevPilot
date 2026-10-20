import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import { BridgeClient } from './bridge-client.js';
import * as fmt from './formatters.js';
import { reconstructCodebaseFromDirectory, unpackSourceMap } from '../src/reconstruction/sourcemap-unpacker.js';
import { scanEndpoints } from '../src/reconstruction/endpoint-scanner.js';
import { buildReaEvidenceBundle, exportReaEvidenceToFile } from '../src/bridge/rea-exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse flags and arguments manually for maximum compatibility
export function parseArgs(rawArgs) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      const keyVal = arg.slice(2);
      if (keyVal.includes('=')) {
        const [k, ...v] = keyVal.split('=');
        flags[k] = v.join('=');
      } else {
        const next = rawArgs[i + 1];
        const isNegativeNum = next && /^-\d+(\.\d+)?$/.test(next);
        if (next && (!next.startsWith('-') || isNegativeNum)) {
          flags[keyVal] = next;
          i++;
        } else {
          flags[keyVal] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const shortKey = arg.slice(1);
      const next = rawArgs[i + 1];
      const isNegativeNum = next && /^-\d+(\.\d+)?$/.test(next);
      if (next && (!next.startsWith('-') || isNegativeNum)) {
        flags[shortKey] = next;
        i++;
      } else {
        flags[shortKey] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

function printHelp() {
  console.log(`
${fmt.bold(fmt.cyan('XtraDevPilot CLI'))} — Real-Browser AI Automation & Diagnostics

${fmt.bold('USAGE:')}
  devpilot <command> [arguments] [options]
  xtradevpilot <command> [arguments] [options]

${fmt.bold('COMMANDS:')}
  ${fmt.cyan('status')}                                Check connection to Chrome bridge
  ${fmt.cyan('tabs, list-tabs')}                       List all open Chrome tabs
  ${fmt.cyan('open <url>')}                            Open a new tab or navigate to URL
  ${fmt.cyan('goto, navigate <url>')}                  Navigate active tab to URL
  ${fmt.cyan('tab-info')}                              Get active or targeted tab metadata
  ${fmt.cyan('dom')}                                   Get current HTML DOM (supports --clean, --selector)
  ${fmt.cyan('click <selector>')}                      Click an element
  ${fmt.cyan('type <selector> <text>')}                Type text into an input field
  ${fmt.cyan('fill <jsonFile|jsonString>')}            Batch fill form inputs
  ${fmt.cyan('combobox <trigger> <option>')}           Select option from searchable combobox
  ${fmt.cyan('upload <filePath>')}                     Upload a local file to input[type=file]
  ${fmt.cyan('screenshot')}                            Capture visible viewport screenshot
  ${fmt.cyan('download-html')}                         Download live DOM or scoped feature HTML
  ${fmt.cyan('export-har')}                            Export network requests to standard HAR 1.2
  ${fmt.cyan('download-sources')}                      Download all client JS, CSS, images, and fonts
  ${fmt.cyan('unpack-sources, reconstruct')}           Reconstruct original project source tree from sourcemaps
  ${fmt.cyan('trace-action <selector>')}               Trace outgoing network calls triggered by UI action
  ${fmt.cyan('extract-endpoints [dir|har]')}           Discover API endpoints & generate OpenAPI 3.0 spec
  ${fmt.cyan('export-rea')}                            Export authenticated session to REA Evidence Bundle
  ${fmt.cyan('eval <javascript>')}                     Evaluate JS in page's main execution context
  ${fmt.cyan('assert <sel> <cond> [exp]')}             Run deterministic QA checks
  ${fmt.cyan('network')}                               Display recent HTTP network requests
  ${fmt.cyan('console')}                               Display recent browser console logs
  ${fmt.cyan('storage <local|session|cookie> <op>')}   Manage storage and cookies (get, set, clear)
  ${fmt.cyan('record <start|stop|status>')}            Record user actions into Playwright script
  ${fmt.cyan('audit <security|a11y>')}                 Run security or accessibility audit scan
  ${fmt.cyan('inject-css <cssString>')}                Inject CSS rules without page reload
  ${fmt.cyan('debug-layout')}                          Toggle red outline layout debug mode
  ${fmt.cyan('mcp')}                                   Launch stdio MCP server for IDEs

${fmt.bold('GLOBAL OPTIONS:')}
  --json                     Output strictly structured JSON for AI tools & automation
  --tab-id <id>              Target a specific Chrome tab ID
  -s, --selector <sel>       CSS selector for targeting elements
  -o, --output <path>        Output file or directory path
  -t, --timeout <ms>         Action wait timeout in milliseconds
  -c, --clean                Strip noisy SVGs and comments (for DOM/HTML)
  -h, --help                 Show help message
  -v, --version              Show version information
`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const { flags, positional } = parseArgs(argv);

  if (flags.help || flags.h || (positional.length === 0 && !flags.version && !flags.v)) {
    printHelp();
    return 0;
  }

  if (flags.version || flags.v) {
    console.log("2.0.2");
    return 0;
  }

  const isJson = Boolean(flags.json);
  const tabId = flags['tab-id'] ? parseInt(flags['tab-id'], 10) : undefined;
  if (flags['tab-id'] && isNaN(tabId)) {
    if (isJson) fmt.printJson({ error: "Invalid --tab-id: must be an integer", code: 2 });
    else console.error(fmt.error("Invalid --tab-id: must be an integer"));
    return 2;
  }

  const command = positional[0]?.toLowerCase();
  const args = positional.slice(1);

  // Standalone MCP runner
  if (command === 'mcp') {
    const mcpServerPath = path.resolve(__dirname, '..', 'mcp-server', 'index.js');
    const child = fork(mcpServerPath, [], { stdio: 'inherit' });
    return new Promise((resolve) => {
      child.on('exit', (code) => resolve(code ?? 0));
    });
  }

  const client = new BridgeClient();

  try {
    switch (command) {
      case 'status': {
        try {
          await client.connect(3000);
          const tabs = await client.call('LIST_TABS');
          const data = { connected: true, bridgeUrl: client.url, tabsCount: Array.isArray(tabs) ? tabs.length : 0 };
          if (isJson) fmt.printJson(data);
          else console.log(fmt.success(`Connected to Chrome bridge at ${client.url} (${data.tabsCount} active tabs)`));
          return 0;
        } catch (err) {
          if (isJson) fmt.printJson({ connected: false, error: err.message, code: 1 });
          else console.error(fmt.error(`Bridge offline: ${err.message}`));
          return 1;
        }
      }

      case 'tabs':
      case 'list-tabs': {
        const tabs = await client.call('LIST_TABS');
        if (isJson) {
          fmt.printJson(tabs);
        } else {
          const rows = (tabs || []).map(t => [String(t.id), t.active ? '* Yes' : 'No', t.title || 'Untitled', t.url || '']);
          fmt.printTable(['TAB ID', 'ACTIVE', 'TITLE', 'URL'], rows);
        }
        return 0;
      }

      case 'open': {
        const url = args[0];
        if (!url) {
          if (isJson) fmt.printJson({ error: "Missing required argument: <url>", code: 2 });
          else console.error(fmt.error("Missing required argument: <url>\nUsage: devpilot open <url>"));
          return 2;
        }
        const res = await client.call('OPEN_TAB', { url, newTab: true });
        if (isJson) fmt.printJson(res);
        else console.log(fmt.success(`Opened new tab ID ${res?.tabId || ''} (${url})`));
        return 0;
      }

      case 'goto':
      case 'navigate': {
        const url = args[0];
        if (!url) {
          if (isJson) fmt.printJson({ error: "Missing required argument: <url>", code: 2 });
          else console.error(fmt.error("Missing required argument: <url>\nUsage: devpilot goto <url>"));
          return 2;
        }
        const res = await client.call('NAVIGATE', { url, tabId });
        if (isJson) fmt.printJson(res);
        else console.log(fmt.success(`Navigated tab to ${url}`));
        return 0;
      }

      case 'tab-info': {
        const res = await client.call('GET_TAB_INFO', { tabId });
        if (isJson) {
          fmt.printJson(res);
        } else {
          fmt.printTable(
            ['PROPERTY', 'VALUE'],
            [
              ['ID', String(res?.id || '')],
              ['Title', res?.title || ''],
              ['URL', res?.url || ''],
              ['Dimensions', `${res?.width || 0}x${res?.height || 0}`],
              ['Status', res?.status || '']
            ]
          );
        }
        return 0;
      }

      case 'dom':
      case 'get-dom': {
        const selector = flags.selector || flags.s;
        const clean = Boolean(flags.clean || flags.c);
        const outputPath = flags.output || flags.o;

        let res;
        if (clean || selector) {
          res = await client.call('GET_CLEAN_DOM', { rootSelector: selector, tabId });
        } else {
          res = await client.call('GET_DOM', { tabId });
        }

        if (outputPath) {
          const resolvedPath = path.resolve(process.cwd(), outputPath);
          const dir = path.dirname(resolvedPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolvedPath, res, 'utf8');
          if (isJson) fmt.printJson({ status: 'success', savedTo: resolvedPath, sizeBytes: Buffer.byteLength(res) });
          else console.log(fmt.success(`DOM saved to ${resolvedPath} (${Buffer.byteLength(res)} bytes)`));
        } else {
          if (isJson) fmt.printJson({ html: res, sizeBytes: Buffer.byteLength(res) });
          else console.log(res);
        }
        return 0;
      }

      case 'click': {
        const selector = args[0] || flags.selector || flags.s;
        if (!selector) {
          if (isJson) fmt.printJson({ error: "Missing required argument: <selector>", code: 2 });
          else console.error(fmt.error("Missing required argument: <selector>\nUsage: devpilot click <selector>"));
          return 2;
        }
        const timeoutMs = flags.timeout || flags.t ? parseInt(flags.timeout || flags.t, 10) : 3000;
        if (timeoutMs < 0) {
          if (isJson) fmt.printJson({ error: "Invalid --timeout: must be non-negative", code: 2 });
          else console.error(fmt.error("Invalid --timeout: must be non-negative"));
          return 2;
        }
        const res = await client.call('CLICK_ELEMENT', { selector, timeoutMs, tabId });
        if (isJson) fmt.printJson({ status: 'success', selector, result: res });
        else console.log(fmt.success(`Clicked element '${selector}'`));
        return 0;
      }

      case 'type': {
        const selector = args[0] || flags.selector || flags.s;
        const text = args[1];
        if (!selector || text === undefined) {
          if (isJson) fmt.printJson({ error: "Missing required arguments: <selector> <text>", code: 2 });
          else console.error(fmt.error("Missing required arguments: <selector> <text>\nUsage: devpilot type <selector> <text>"));
          return 2;
        }
        const timeoutMs = flags.timeout || flags.t ? parseInt(flags.timeout || flags.t, 10) : 3000;
        if (timeoutMs < 0) {
          if (isJson) fmt.printJson({ error: "Invalid --timeout: must be non-negative", code: 2 });
          else console.error(fmt.error("Invalid --timeout: must be non-negative"));
          return 2;
        }
        if (selector !== 'body' && selector !== 'html') {
          const check = await client.call('ASSERT_ELEMENT_STATE', { selector, condition: 'is_attached', tabId });
          if (!check || !check.passed) {
            throw new Error(`Element not found: ${selector}`);
          }
        }
        const res = await client.call('TYPE_TEXT', { selector, text, timeoutMs, tabId });
        if (isJson) fmt.printJson({ status: 'success', selector, text, result: res });
        else console.log(fmt.success(`Typed into '${selector}'`));
        return 0;
      }

      case 'fill': {
        const inputArg = args[0];
        if (!inputArg) {
          if (isJson) fmt.printJson({ error: "Missing required JSON argument or file path for fill", code: 2 });
          else console.error(fmt.error("Missing JSON argument or file path: devpilot fill <jsonFile|jsonString>"));
          return 2;
        }
        let actions;
        try {
          if (fs.existsSync(inputArg)) {
            actions = JSON.parse(fs.readFileSync(inputArg, 'utf8'));
          } else {
            actions = JSON.parse(inputArg);
          }
        } catch (e) {
          if (isJson) fmt.printJson({ error: `Invalid JSON payload: ${e.message}`, code: 2 });
          else console.error(fmt.error(`Invalid JSON payload: ${e.message}`));
          return 2;
        }

        const res = await client.call('BATCH_FILL_FORM', { actions, tabId });
        if (isJson) fmt.printJson(res);
        else console.log(fmt.success(`Batch filled ${res?.total || 0} fields (${res?.succeeded || 0} succeeded, ${res?.failed || 0} failed)`));
        return 0;
      }

      case 'combobox': {
        const triggerSelector = args[0];
        const optionText = args[1];
        if (!triggerSelector || !optionText) {
          if (isJson) fmt.printJson({ error: "Missing required arguments: <triggerSelector> <optionText>", code: 2 });
          else console.error(fmt.error("Usage: devpilot combobox <triggerSelector> <optionText>"));
          return 2;
        }
        const searchQuery = flags.query || flags.q;
        const res = await client.call('SMART_SELECT_COMBOBOX', { triggerSelector, optionText, searchQuery, tabId });
        if (isJson) fmt.printJson({ status: 'success', result: res });
        else console.log(fmt.success(`Selected '${optionText}' from '${triggerSelector}'`));
        return 0;
      }

      case 'upload': {
        const inputPath = args[0];
        if (!inputPath) {
          if (isJson) fmt.printJson({ error: "Missing required argument: <filePath>", code: 2 });
          else console.error(fmt.error("Usage: devpilot upload <filePath> [--selector <sel>]"));
          return 2;
        }
        const resolvedPath = path.resolve(process.cwd(), inputPath);
        if (!fs.existsSync(resolvedPath)) {
          if (isJson) fmt.printJson({ error: `File not found: ${resolvedPath}`, code: 1 });
          else console.error(fmt.error(`File not found: ${resolvedPath}`));
          return 1;
        }
        const fileBuffer = fs.readFileSync(resolvedPath);
        const base64 = fileBuffer.toString('base64');
        const fileName = path.basename(resolvedPath);
        const selector = flags.selector || flags.s || 'input[type="file"]';

        const res = await client.call('UPLOAD_FILE', { selector, base64, fileName, mimeType: 'application/octet-stream', tabId });
        if (isJson) fmt.printJson({ status: 'success', file: resolvedPath, result: res });
        else console.log(fmt.success(`Uploaded ${fileName} to '${selector}'`));
        return 0;
      }

      case 'screenshot': {
        const targetPath = flags.output || flags.o ? path.resolve(process.cwd(), flags.output || flags.o) : path.resolve(process.cwd(), '.devpilot-screenshot.png');
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const base64DataUrl = await client.call('CAPTURE_SCREENSHOT', { tabId });
        if (base64DataUrl && base64DataUrl.startsWith('data:image/png;base64,')) {
          const base64 = base64DataUrl.replace(/^data:image\/png;base64,/, '');
          fs.writeFileSync(targetPath, base64, 'base64');
          if (isJson) fmt.printJson({ status: 'success', filePath: targetPath, sizeBytes: Buffer.byteLength(base64, 'base64') });
          else console.log(fmt.success(`Screenshot saved to ${targetPath}`));
          return 0;
        } else {
          throw new Error("Failed to capture screenshot. The tab must be active and focused.");
        }
      }

      case 'download-html': {
        const selector = flags.selector || flags.s;
        const clean = Boolean(flags.clean || flags.c);
        const defaultName = selector ? 'downloaded-feature.html' : 'downloaded-page.html';
        const targetPath = flags.output || flags.o ? path.resolve(process.cwd(), flags.output || flags.o) : path.resolve(process.cwd(), defaultName);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const data = await client.call('DOWNLOAD_PAGE_HTML', { selector, clean, tabId });
        fs.writeFileSync(targetPath, data.html, 'utf8');
        const stats = fs.statSync(targetPath);

        const out = {
          status: 'success',
          filePath: targetPath,
          fileSizeKB: Math.round((stats.size / 1024) * 100) / 100,
          title: data.title,
          url: data.url,
          scopedSelector: data.selector || 'FULL_PAGE',
          characterCount: data.html.length
        };

        if (isJson) fmt.printJson(out);
        else console.log(fmt.success(`HTML saved to ${targetPath} (${out.fileSizeKB} KB, ${out.characterCount} chars)`));
        return 0;
      }

      case 'export-har': {
        const targetPath = flags.output || flags.o ? path.resolve(process.cwd(), flags.output || flags.o) : path.resolve(process.cwd(), 'network-traffic.har');
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const clearAfterExport = Boolean(flags.clear);
        const har = await client.call('EXPORT_HAR', { clearAfterExport, tabId });

        fs.writeFileSync(targetPath, JSON.stringify(har, null, 2), 'utf8');
        const stats = fs.statSync(targetPath);

        const out = {
          status: 'success',
          filePath: targetPath,
          totalEntries: har.log?.entries?.length || 0,
          fileSizeKB: Math.round((stats.size / 1024) * 100) / 100,
          harVersion: har.log?.version || '1.2'
        };

        if (isJson) fmt.printJson(out);
        else console.log(fmt.success(`HAR archive saved to ${targetPath} (${out.totalEntries} requests, ${out.fileSizeKB} KB)`));
        return 0;
      }

      case 'download-sources': {
        const targetDir = flags.output || flags.o ? path.resolve(process.cwd(), flags.output || flags.o) : path.resolve(process.cwd(), 'downloaded-sources');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const types = flags.types ? flags.types.split(',').map(s => s.trim()) : undefined;
        const selector = flags.selector || flags.s;
        const includeSourceMaps = flags['no-maps'] ? false : true;

        const data = await client.call('DOWNLOAD_SOURCES', { outputDir: targetDir, types, selector, includeSourceMaps, tabId }, 90000);

        const breakdown = { scripts: 0, styles: 0, sourcemaps: 0, images: 0, fonts: 0, other: 0 };
        let totalBytes = 0;

        if (Array.isArray(data.files)) {
          for (const f of data.files) {
            const fullPath = path.resolve(targetDir, f.relativePath);
            const subDir = path.dirname(fullPath);
            if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

            if (f.isBinary && f.base64) {
              fs.writeFileSync(fullPath, Buffer.from(f.base64, 'base64'));
              totalBytes += f.size || 0;
            } else if (f.content !== undefined) {
              fs.writeFileSync(fullPath, f.content, 'utf8');
              totalBytes += Buffer.byteLength(f.content, 'utf8');
            }

            const prefix = f.relativePath.split('/')[0];
            if (breakdown[prefix] !== undefined) breakdown[prefix]++;
            else breakdown.other++;
          }
        }

        const manifestPath = path.resolve(targetDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(data.manifest || [], null, 2), 'utf8');

        const out = {
          status: 'success',
          outputDir: targetDir,
          totalFiles: data.totalFiles || 0,
          totalSizeKB: Math.round((totalBytes / 1024) * 100) / 100,
          manifestPath,
          breakdown
        };

        if (isJson) fmt.printJson(out);
        else {
          console.log(fmt.success(`Downloaded ${out.totalFiles} source files to ${targetDir} (${out.totalSizeKB} KB)`));
          console.log(fmt.dim(`Breakdown: ${breakdown.scripts} JS, ${breakdown.styles} CSS, ${breakdown.sourcemaps} Maps, ${breakdown.images} Images, ${breakdown.fonts} Fonts`));
        }
        return 0;
      }

      case 'eval': {
        const script = args.join(' ');
        if (!script) {
          if (isJson) fmt.printJson({ error: "Missing required JavaScript script argument", code: 2 });
          else console.error(fmt.error("Usage: devpilot eval <javascript>"));
          return 2;
        }
        const res = await client.call('EXECUTE_SCRIPT', { script, tabId });
        if (isJson) fmt.printJson({ status: 'success', result: res });
        else console.log(typeof res === 'object' ? JSON.stringify(res, null, 2) : res);
        return 0;
      }

      case 'assert': {
        const selector = args[0];
        const condition = args[1];
        const expected = args.slice(2).join(' ') || undefined;

        if (!selector || !condition) {
          if (isJson) fmt.printJson({ error: "Usage: devpilot assert <selector> <condition> [expected]", code: 2 });
          else console.error(fmt.error("Usage: devpilot assert <selector> <condition> [expected]"));
          return 2;
        }

        const validConditions = ['is_visible', 'is_hidden', 'is_enabled', 'is_disabled', 'contains_text', 'has_value', 'has_attribute'];
        if (!validConditions.includes(condition)) {
          const err = `Invalid condition '${condition}'. Allowed: ${validConditions.join(', ')}`;
          if (isJson) fmt.printJson({ error: err, code: 2 });
          else console.error(fmt.error(err));
          return 2;
        }

        if (['contains_text', 'has_value', 'has_attribute'].includes(condition) && !expected) {
          const err = `Condition '${condition}' requires an expected value argument.`;
          if (isJson) fmt.printJson({ error: err, code: 2 });
          else console.error(fmt.error(err));
          return 2;
        }

        const res = await client.call('ASSERT_ELEMENT_STATE', { selector, condition, expected, tabId });
        if (isJson) fmt.printJson(res);
        else {
          if (res?.passed) {
            console.log(fmt.success(`ASSERTION PASSED: '${selector}' satisfies '${condition}'`));
          } else {
            console.error(fmt.error(`ASSERTION FAILED: '${selector}' did not satisfy '${condition}' (actual: '${res?.actual}')`));
          }
        }
        return res?.passed ? 0 : 1;
      }

      case 'network': {
        const limit = flags.limit || flags.n ? parseInt(flags.limit || flags.n, 10) : 50;
        const logs = await client.call('GET_NETWORK_LOGS');
        const sliced = Array.isArray(logs) ? logs.slice(-limit) : [];
        if (isJson) {
          fmt.printJson(sliced);
        } else {
          const rows = sliced.map(l => [l.method || 'GET', String(l.status || 0), l.url || '']);
          fmt.printTable(['METHOD', 'STATUS', 'URL'], rows);
        }
        return 0;
      }

      case 'console': {
        const limit = flags.limit || flags.n ? parseInt(flags.limit || flags.n, 10) : 50;
        const logs = await client.call('GET_CONSOLE_LOGS');
        const sliced = Array.isArray(logs) ? logs.slice(-limit) : [];
        if (isJson) {
          fmt.printJson(sliced);
        } else {
          const rows = sliced.map(l => [l.level || 'info', l.text || '']);
          fmt.printTable(['LEVEL', 'MESSAGE'], rows);
        }
        return 0;
      }

      case 'storage': {
        const storageType = args[0]?.toLowerCase();
        const operation = args[1]?.toLowerCase();
        const key = args[2];
        const val = args.slice(3).join(' ');

        if (!storageType || !operation) {
          if (isJson) fmt.printJson({ error: "Usage: devpilot storage <local|session|cookie> <get|get_all|set|remove|clear> [key] [val]", code: 2 });
          else console.error(fmt.error("Usage: devpilot storage <local|session|cookie> <get|get_all|set|remove|clear> [key] [val]"));
          return 2;
        }

        let res;
        if (storageType === 'cookie') {
          res = await client.call('MANAGE_COOKIES', { operation, name: key, value: val, tabId });
        } else {
          const stType = storageType.includes('sess') ? 'session' : 'local';
          if (operation === 'get_all') {
            const allStorage = await client.call('GET_STORAGE', { tabId });
            res = stType === 'session' ? (allStorage?.sessionStorage || {}) : (allStorage?.localStorage || {});
          } else {
            res = await client.call('MANAGE_STORAGE', { operation, key, value: val, storageType: stType, tabId });
          }
        }

        if (isJson) fmt.printJson(res);
        else console.log(typeof res === 'object' ? JSON.stringify(res, null, 2) : fmt.success(String(res)));
        return 0;
      }

      case 'record': {
        const action = args[0]?.toLowerCase() || 'status';
        const res = await client.call('RECORD_FLOW', { subAction: action, tabId });

        if (action === 'stop' && flags.output) {
          const target = path.resolve(process.cwd(), flags.output);
          fs.writeFileSync(target, res.testScript || '', 'utf8');
          if (isJson) fmt.printJson({ ...res, savedTo: target });
          else console.log(fmt.success(`Playwright test script saved to ${target}`));
          return 0;
        }

        if (isJson) fmt.printJson(res);
        else console.log(typeof res === 'object' ? JSON.stringify(res, null, 2) : res);
        return 0;
      }

      case 'audit': {
        const type = args[0]?.toLowerCase() || 'security';
        let res;
        if (type === 'a11y' || type === 'accessibility') {
          res = await client.call('RUN_ACCESSIBILITY_AUDIT', { tabId });
        } else {
          res = await client.call('RUN_SECURITY_AUDIT', { tabId });
        }
        if (typeof res === 'string') {
          try { res = JSON.parse(res); } catch (e) {}
        }
        if (isJson) fmt.printJson(res);
        else console.log(JSON.stringify(res, null, 2));
        return 0;
      }

      case 'inject-css': {
        const cssString = args.join(' ');
        if (!cssString) {
          if (isJson) fmt.printJson({ error: "Missing required argument: <cssString>", code: 2 });
          else console.error(fmt.error("Usage: devpilot inject-css <cssString>"));
          return 2;
        }
        const res = await client.call('INJECT_CSS', { cssString, tabId });
        if (isJson) fmt.printJson({ status: 'success', result: res });
        else console.log(fmt.success(res));
        return 0;
      }

      case 'debug-layout': {
        const res = await client.call('TOGGLE_LAYOUT_DEBUG', { tabId });
        if (isJson) fmt.printJson({ status: 'success', result: res });
        else console.log(fmt.info(res));
        return 0;
      }

      case 'unpack-sources':
      case 'reconstruct': {
        const inputTarget = args[0] || flags.input || flags.i || 'downloaded-sources';
        const outputTarget = flags.output || flags.o || 'reconstructed-codebase';
        const res = reconstructCodebaseFromDirectory(inputTarget, outputTarget);
        if (isJson) {
          fmt.printJson(res);
        } else {
          console.log(fmt.success(`Reconstructed ${res.totalFiles} source files to ${res.outputDirectory} (${res.totalSizeKB} KB)`));
          if (res.detectedTechStack?.length > 0) {
            console.log(fmt.cyan(`Detected Technologies: ${res.detectedTechStack.join(', ')}`));
          }
          if (res.extractedModulesCount > 0) {
            console.log(fmt.dim(`Extracted ${res.extractedModulesCount} unminified bundle modules into extracted-modules/`));
          }
          console.log(fmt.dim(`Manifest saved to ${res.manifestPath}`));
        }
        return 0;
      }

      case 'trace-action': {
        const selector = args[0] || flags.selector || flags.s;
        if (!selector) {
          if (isJson) fmt.printJson({ error: "Missing required argument: <selector>", code: 2 });
          else console.error(fmt.error("Missing required argument: <selector>\nUsage: devpilot trace-action <selector> [--action click|type] [--text <str>] [--wait <ms>]"));
          return 2;
        }
        const actionType = flags.action || 'click';
        const textVal = flags.text || '';
        const waitMs = flags.wait ? parseInt(flags.wait, 10) : (flags.timeout ? parseInt(flags.timeout, 10) : 1500);

        if (selector !== 'body' && selector !== 'html') {
          const check = await client.call('ASSERT_ELEMENT_STATE', { selector, condition: 'is_attached', tabId });
          if (!check || !check.passed) {
            throw new Error(`Element not found: ${selector}`);
          }
        }

        let res;
        try {
          res = await client.call('TRACE_ACTION', { selector, action: actionType, text: textVal, waitDurationMs: waitMs, tabId });
        } catch (e) {
          const beforeHar = await client.call('EXPORT_HAR', { tabId });
          const initialCount = beforeHar?.log?.entries?.length || 0;

          let actionResult;
          if (actionType === 'click') {
            actionResult = await client.call('CLICK_ELEMENT', { selector, timeoutMs: 3000, tabId });
          } else {
            actionResult = await client.call('TYPE_TEXT', { selector, text: textVal, timeoutMs: 3000, tabId });
          }

          await new Promise(r => setTimeout(r, waitMs));

          const afterHar = await client.call('EXPORT_HAR', { tabId });
          const allEntries = afterHar?.log?.entries || [];
          const newEntries = allEntries.slice(initialCount);

          res = {
            selector,
            action: actionType,
            actionResult,
            waitDurationMs: waitMs,
            triggeredRequestsCount: newEntries.length,
            triggeredRequests: newEntries.map(e => ({
              url: e.request?.url,
              method: e.request?.method || 'GET',
              status: e.response?.status || 200,
              statusText: e.response?.statusText || 'OK',
              mimeType: e.response?.content?.mimeType || '-',
              sizeBytes: e.response?.content?.size || 0,
              timeMs: e.time || 0,
              startedDateTime: e.startedDateTime
            }))
          };
        }

        if (isJson) {
          fmt.printJson(res);
        } else {
          console.log(fmt.success(`Action '${actionType}' triggered on '${selector}' (${res.triggeredRequestsCount} outgoing requests detected)`));
          if (res.triggeredRequests?.length > 0) {
            const rows = res.triggeredRequests.map(r => [
              r.method,
              String(r.status || 'pending'),
              r.mimeType || '-',
              r.url
            ]);
            fmt.printTable(['METHOD', 'STATUS', 'MIME TYPE', 'URL'], rows);
          } else {
            console.log(fmt.dim("No network requests were triggered during the observation window."));
          }
        }
        return 0;
      }

      case 'extract-endpoints': {
        const inputTarget = args[0] || flags.input || flags.i || 'downloaded-sources';
        const outputPath = flags.output || flags.o;
        const res = scanEndpoints(inputTarget);

        if (outputPath) {
          const resolvedOut = path.resolve(process.cwd(), outputPath);
          const dir = path.dirname(resolvedOut);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolvedOut, JSON.stringify(res.openApiSpec, null, 2), 'utf8');
        }

        if (isJson) {
          fmt.printJson({ ...res, savedSpecTo: outputPath ? path.resolve(process.cwd(), outputPath) : undefined });
        } else {
          console.log(fmt.success(`Discovered ${res.totalEndpoints} API endpoints from ${inputTarget}`));
          const rows = res.endpoints.slice(0, 30).map(e => [
            e.method,
            e.path,
            String(e.occurrences),
            e.sources.slice(0, 2).join(', ')
          ]);
          fmt.printTable(['METHOD', 'PATH', 'CALLS', 'SOURCES'], rows);
          if (outputPath) {
            console.log(fmt.cyan(`OpenAPI 3.0 specification saved to ${path.resolve(process.cwd(), outputPath)}`));
          }
        }
        return 0;
      }

      case 'export-rea': {
        const outputPath = flags.output || flags.o || 'xtradevpilot-rea-evidence.json';
        const tabInfo = await client.call('GET_TAB_INFO', { tabId });
        const harLog = await client.call('EXPORT_HAR', { tabId });
        const domSnapshot = await client.call('GET_CLEAN_DOM', { tabId });
        let storage = {};
        try { storage = await client.call('GET_STORAGE', { tabId }); } catch (e) {}
        let cookies = [];
        try { cookies = await client.call('MANAGE_COOKIES', { operation: 'get_all', tabId }); } catch (e) {}

        const evidence = buildReaEvidenceBundle({
          tabInfo,
          harLog,
          domSnapshot,
          storage,
          cookies
        });

        const saveRes = exportReaEvidenceToFile(evidence, outputPath);
        if (isJson) {
          fmt.printJson({ status: 'success', evidenceId: evidence.evidence_id, savedTo: saveRes.savedTo, sizeBytes: saveRes.sizeBytes });
        } else {
          console.log(fmt.success(`REA Evidence Bundle exported to ${saveRes.savedTo} (${Math.round(saveRes.sizeBytes / 1024 * 100) / 100} KB)`));
          console.log(fmt.dim(`Evidence ID: ${evidence.evidence_id}`));
        }
        return 0;
      }

      default: {
        const errMsg = `Unknown command: '${command}'. Run 'devpilot --help' for available commands.`;
        if (isJson) fmt.printJson({ error: errMsg, code: 2 });
        else console.error(fmt.error(errMsg));
        return 2;
      }
    }
  } catch (err) {
    if (isJson) fmt.printJson({ error: err.message, code: 1 });
    else console.error(fmt.error(`Execution failed: ${err.message}`));
    return 1;
  } finally {
    client.close();
  }
}
