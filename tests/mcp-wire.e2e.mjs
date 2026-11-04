// End-to-end wire test for the local xtradevpilot MCP server (2.7.0).
// Spawns the real server on a spare bridge port, plays the Chrome extension over
// WebSocket, drives the server over MCP stdio, and asserts on what the extension
// actually receives. The real extension never dials this port, so it's isolated.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run: npm run test:wire   (needs `npm install`; uses a spare port, no browser needed)
const ROOT = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 42899;
const require = createRequire(path.join(ROOT, 'package.json'));
const WebSocket = require('ws');

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = spawn(process.execPath, [path.join(ROOT, 'mcp-server', 'index.js')], {
  cwd: ROOT, env: { ...process.env, XTRADEVPILOT_PORT: String(PORT) }, stdio: ['pipe', 'pipe', 'pipe']
});
let stderr = '';
srv.stderr.on('data', (d) => { stderr += d; });

// --- MCP stdio client ---
let buf = '';
const waiters = new Map();
srv.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { const m = JSON.parse(line); if (m.id != null && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } } catch (e) {}
  }
});
let rpcId = 100;
function rpc(method, params) {
  const id = rpcId++;
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((res, rej) => { waiters.set(id, res); setTimeout(() => rej(new Error('rpc timeout ' + method)), 8000); });
}
const callTool = (name, args) => rpc('tools/call', { name, arguments: args });

// --- fake extension ---
const received = [];
let replyError = null;            // set to make the fake extension fail the next command
async function connectFakeExtension() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
      await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
      ws.send(JSON.stringify({ role: 'extension', sessionId: 'wire-test', meta: { userAgent: 'harness' } }));
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (!msg.id || !msg.action) return;
        received.push(msg);
        if (replyError) { const e = replyError; replyError = null; ws.send(JSON.stringify({ id: msg.id, error: e })); }
        else ws.send(JSON.stringify({ id: msg.id, result: { ok: true } }));
      });
      return ws;
    } catch (e) { await sleep(200); }
  }
  throw new Error('fake extension could not connect');
}

const lastOf = (action) => [...received].reverse().find((m) => m.action === action);
const textOf = (r) => (r && r.result && r.result.content && r.result.content[0] && r.result.content[0].text) || '';

try {
  const ws = await connectFakeExtension();
  await sleep(150);
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'wire-test', version: '1' } });
  check('initialize', init.result && init.result.serverInfo, init.result && init.result.serverInfo);
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // Schema
  const list = await rpc('tools/list', {});
  const tools = Object.fromEntries((list.result.tools || []).map((t) => [t.name, t]));
  const props = (n) => Object.keys((tools[n] && tools[n].inputSchema && tools[n].inputSchema.properties) || {});
  check('schema mouse_action has trusted/focusTab/stepDelayMs', ['trusted', 'focusTab', 'stepDelayMs'].every((k) => props('mouse_action').includes(k)), props('mouse_action'));
  check('schema click_element has trusted/focusTab', ['trusted', 'focusTab'].every((k) => props('click_element').includes(k)), props('click_element'));
  check('schema press_key has metaKey/trusted/focusTab', ['metaKey', 'trusted', 'focusTab'].every((k) => props('press_key').includes(k)), props('press_key'));
  check('schema type_text has trusted/append/focusTab', ['trusted', 'append', 'focusTab'].every((k) => props('type_text').includes(k)), props('type_text'));
  check('schema open_tab has background', props('open_tab').includes('background'), props('open_tab'));

  // THE transport bug: the sub-action must survive the trip
  await callTool('mouse_action', { action: 'click', x: 10, y: 20, trusted: true, focusTab: true });
  let m = lastOf('MOUSE_ACTION');
  check('mouse_action: command name kept', m && m.action === 'MOUSE_ACTION', m);
  check('mouse_action: sub-action delivered as subAction=click', m && m.subAction === 'click', m && m.subAction);
  check('mouse_action: x/trusted/focusTab passed', m && m.x === 10 && m.trusted === true && m.focusTab === true, m);

  await callTool('mouse_action', { action: 'dblclick', x: 1, y: 2 });
  check('mouse_action: dblclick delivered', lastOf('MOUSE_ACTION').subAction === 'dblclick', lastOf('MOUSE_ACTION').subAction);

  await callTool('trace_action_network', { selector: '#q', action: 'type', text: 'hi' });
  m = lastOf('TRACE_ACTION');
  check('trace_action_network: subAction=type delivered', m && m.subAction === 'type' && m.text === 'hi', m);

  await callTool('press_key', { key: 'r', metaKey: true, trusted: false, focusTab: true });
  m = lastOf('PRESS_KEY');
  check('press_key: key/metaKey/trusted/focusTab passed', m && m.key === 'r' && m.metaKey === true && m.trusted === false && m.focusTab === true, m);

  await callTool('type_text', { selector: '#x', text: 'hey', trusted: true, append: true, focusTab: true });
  m = lastOf('TYPE_TEXT');
  check('type_text: trusted/append/focusTab passed', m && m.trusted === true && m.append === true && m.focusTab === true, m);

  await callTool('click_element', { selector: '#b', trusted: false });
  m = lastOf('CLICK_ELEMENT');
  check('click_element: trusted=false passed', m && m.trusted === false, m);

  await callTool('open_tab', { url: 'https://example.com', background: true });
  m = lastOf('OPEN_TAB');
  check('open_tab: background passed', m && m.background === true, m);

  // A command with no `action` arg must not grow a subAction key
  await callTool('get_tab_info', {});
  m = lastOf('GET_TAB_INFO');
  check('no stray subAction on commands without one', m && !('subAction' in m), m);

  // --- power-up tools -------------------------------------------------------
  check('schema has click_text / press_keys / touch_action / drop_files', ['click_text', 'press_keys', 'touch_action', 'drop_files'].every((n) => tools[n]), Object.keys(tools).filter((n) => /text|keys|touch|drop/.test(n)));
  const maEnum = (tools.mouse_action.inputSchema.properties.action || {}).enum || [];
  check('mouse_action enum has tripleclick/hover/longpress/path', ['tripleclick', 'hover', 'longpress', 'path'].every((a) => maEnum.includes(a)), maEnum);
  check('mouse_action has points/holdMs/dwellMs/autoScroll/modifiers', ['points', 'holdMs', 'dwellMs', 'autoScroll', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey'].every((k) => props('mouse_action').includes(k)), props('mouse_action'));
  check('type_text has keystrokes/delayMs', ['keystrokes', 'delayMs'].every((k) => props('type_text').includes(k)), props('type_text'));
  check('click_element has clicks/button/modifiers', ['clicks', 'button', 'shiftKey', 'ctrlKey'].every((k) => props('click_element').includes(k)), props('click_element'));

  await callTool('click_text', { text: 'Sign in' });
  check('click_text -> CLICK_ELEMENT selector text=Sign in', lastOf('CLICK_ELEMENT').selector === 'text=Sign in', lastOf('CLICK_ELEMENT').selector);
  await callTool('click_text', { text: 'Save', contains: true, nth: 1, within: 'iframe#ed', ctrlKey: true, clicks: 2 });
  m = lastOf('CLICK_ELEMENT');
  check('click_text contains/nth/within/modifiers/clicks', m.selector === 'iframe#ed >>> text*=Save >> nth=1' && m.ctrlKey === true && m.clicks === 2, m);

  await callTool('press_keys', { keys: ['Ctrl+A', 'Delete'], delayMs: 10 });
  m = lastOf('PRESS_KEYS');
  check('press_keys passes keys array + delayMs', Array.isArray(m.keys) && m.keys.join('|') === 'Ctrl+A|Delete' && m.delayMs === 10, m);

  await callTool('mouse_action', { action: 'path', points: [[1, 2], [3, 4], [5, 6]], smooth: false, shiftKey: true });
  m = lastOf('MOUSE_ACTION');
  check('mouse_action path: subAction/points/smooth/shiftKey', m.subAction === 'path' && m.points.length === 3 && m.smooth === false && m.shiftKey === true, m);
  await callTool('mouse_action', { action: 'longpress', x: 5, y: 5, holdMs: 900 });
  check('mouse_action longpress holdMs', lastOf('MOUSE_ACTION').subAction === 'longpress' && lastOf('MOUSE_ACTION').holdMs === 900, lastOf('MOUSE_ACTION'));

  await callTool('type_text', { selector: '#c', text: 'abc', keystrokes: true, delayMs: 5 });
  m = lastOf('TYPE_TEXT');
  check('type_text keystrokes/delayMs passed', m.keystrokes === true && m.delayMs === 5, m);

  await callTool('touch_action', { action: 'pinch', x: 100, y: 120, scale: 0.5 });
  m = lastOf('TOUCH_ACTION');
  check('touch_action pinch: subAction/scale', m.subAction === 'pinch' && m.scale === 0.5 && m.x === 100, m);

  const tmp = path.join(os.tmpdir(), `xdp-drop-${Date.now()}.txt`);
  fs.writeFileSync(tmp, 'hello drop');
  await callTool('drop_files', { filePaths: [tmp], selector: '#zone' });
  m = lastOf('DROP_FILES');
  const f0 = m && m.files && m.files[0];
  check('drop_files reads file -> name/mime/base64', f0 && f0.name === path.basename(tmp) && f0.mimeType === 'text/plain' && Buffer.from(f0.base64, 'base64').toString() === 'hello drop' && m.selector === '#zone', f0 && { name: f0.name, mimeType: f0.mimeType });
  fs.unlinkSync(tmp);
  const before = received.length;
  const missing = await callTool('drop_files', { filePaths: ['C:/definitely/not/here.png'] });
  check('drop_files missing file errors before reaching the extension', received.length === before && /File not found/.test(textOf(missing)), textOf(missing).slice(0, 120));

  // Structured error mapping for the new hidden-tab failure
  replyError = 'Tab is hidden: Chrome only delivers real drag input to a visible tab. Bring the tab to front or pass focusTab:true.';
  const errRes = await callTool('mouse_action', { action: 'drag', x: 1, y: 1, endX: 5, endY: 5 });
  const t = textOf(errRes);
  check('hidden-tab error maps to TAB_HIDDEN', /"code":\s*"TAB_HIDDEN"/.test(t), t.slice(0, 160));

  ws.close();
} catch (e) {
  check('harness ran without exceptions', false, String(e && e.stack || e));
} finally {
  srv.kill();
}

const pass = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + JSON.stringify(r.detail)}`);
console.log(`\n${pass}/${results.length} passed`);
if (pass !== results.length) { console.log('--- server stderr ---\n' + stderr.slice(-1500)); process.exit(1); }
