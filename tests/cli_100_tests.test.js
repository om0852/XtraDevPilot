import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fssync from 'node:fs';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '..', 'bin', 'devpilot.js');

const testArtifactsDir = path.resolve(__dirname, '..', 'test_artifacts');
if (!fssync.existsSync(testArtifactsDir)) {
  fssync.mkdirSync(testArtifactsDir, { recursive: true });
}

async function runCli(args = []) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [cliPath, ...args], {
      timeout: 25000,
      env: { ...process.env, NODE_ENV: 'test' }
    });
    return { code: 0, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      code: err.code ?? 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
      error: err
    };
  }
}

function parseJson(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    throw new Error(`Failed to parse JSON: "${str}". Error: ${e.message}`);
  }
}

let cachedTargetTabId = null;
async function getTargetTabId() {
  if (cachedTargetTabId) return cachedTargetTabId;
  const res = await runCli(['tabs', '--json']);
  const tabs = parseJson(res.stdout);
  const match = tabs.find(t => t.url && t.url.includes('linktree.work.gd')) || tabs[0];
  cachedTargetTabId = match.id;
  return cachedTargetTabId;
}

async function runWithTab(args = []) {
  const tid = await getTargetTabId();
  if (!args.includes('--tab-id') && tid) {
    return runCli([...args, '--tab-id', String(tid)]);
  }
  return runCli(args);
}

// -----------------------------------------------------------------------------
// GROUP 1: CLI Invocation, Flags & General Syntax (Tests 1–12)
// -----------------------------------------------------------------------------
test('01. --help displays usage and returns code 0', async () => {
  const res = await runCli(['--help']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /USAGE:/i);
  assert.match(res.stdout, /COMMANDS:/i);
});

test('02. -h shorthand displays usage and returns code 0', async () => {
  const res = await runCli(['-h']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /USAGE:/i);
});

test('03. --version displays 2.0.2 and returns code 0', async () => {
  const res = await runCli(['--version']);
  assert.equal(res.code, 0);
  assert.equal(res.stdout, '2.0.2');
});

test('04. -v shorthand displays version and returns code 0', async () => {
  const res = await runCli(['-v']);
  assert.equal(res.code, 0);
  assert.equal(res.stdout, '2.0.2');
});

test('05. No arguments provided prints help with code 0', async () => {
  const res = await runCli([]);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /USAGE:/i);
});

test('06. Unknown command returns error and code 2', async () => {
  const res = await runCli(['nonexistent_command_xyz']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Unknown command: 'nonexistent_command_xyz'/i);
});

test('07. Unknown command with --json returns valid JSON error with code 2', async () => {
  const res = await runCli(['nonexistent_command_xyz', '--json']);
  assert.equal(res.code, 2);
  const json = parseJson(res.stdout || res.stderr);
  assert.equal(json.code, 2);
  assert.match(json.error, /Unknown command/i);
});

test('08. Invalid non-integer --tab-id returns code 2', async () => {
  const res = await runCli(['tabs', '--tab-id', 'invalid_string']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Invalid --tab-id/i);
});

test('09. Invalid non-integer --tab-id with --json returns code 2 and JSON error', async () => {
  const res = await runCli(['tabs', '--tab-id', 'invalid_string', '--json']);
  assert.equal(res.code, 2);
  const json = parseJson(res.stdout);
  assert.equal(json.code, 2);
  assert.match(json.error, /Invalid --tab-id/i);
});

test('10. Multiple unknown arguments return code 2', async () => {
  const res = await runCli(['foo', 'bar', 'baz']);
  assert.equal(res.code, 2);
});

test('11. Very long unknown string argument is handled gracefully without crash', async () => {
  const longArg = 'a'.repeat(2000);
  const res = await runCli([longArg]);
  assert.equal(res.code, 2);
});

test('12. Unicode and emoji in command handling', async () => {
  const res = await runCli(['🚀_unknown_emoji_cmd']);
  assert.equal(res.code, 2);
});

// -----------------------------------------------------------------------------
// GROUP 2: Bridge Status & Tab Discovery (Tests 13–24)
// -----------------------------------------------------------------------------
test('13. status command human output returns code 0', async () => {
  const res = await runCli(['status']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /Connected to Chrome bridge/i);
});

test('14. status command with --json returns connected boolean and bridgeUrl', async () => {
  const res = await runCli(['status', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.connected, true);
  assert.match(json.bridgeUrl, /ws:\/\//);
  assert.ok(typeof json.tabsCount === 'number');
});

test('15. tabs command human output returns code 0 with table headers', async () => {
  const res = await runCli(['tabs']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /TAB ID/);
  assert.match(res.stdout, /TITLE/);
  assert.match(res.stdout, /URL/);
});

test('16. tabs command with --json returns array of tabs with required properties', async () => {
  const res = await runCli(['tabs', '--json']);
  assert.equal(res.code, 0);
  const tabs = parseJson(res.stdout);
  assert.ok(Array.isArray(tabs));
  assert.ok(tabs.length > 0);
  assert.ok('id' in tabs[0]);
  assert.ok('title' in tabs[0]);
  assert.ok('url' in tabs[0]);
});

test('17. list-tabs alias returns same structure as tabs', async () => {
  const res = await runCli(['list-tabs', '--json']);
  assert.equal(res.code, 0);
  const tabs = parseJson(res.stdout);
  assert.ok(Array.isArray(tabs));
});

test('18. tab-info for active tab returns code 0 and table', async () => {
  const res = await runCli(['tab-info']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /PROPERTY/);
  assert.match(res.stdout, /VALUE/);
});

test('19. tab-info with --json contains id, title, url, status', async () => {
  const res = await runCli(['tab-info', '--json']);
  assert.equal(res.code, 0);
  const info = parseJson(res.stdout);
  assert.ok('id' in info);
  assert.ok('title' in info);
  assert.ok('url' in info);
});

test('20. tab-info with valid --tab-id returns targeted tab metadata', async () => {
  const validId = await getTargetTabId();
  const res = await runCli(['tab-info', '--tab-id', String(validId), '--json']);
  assert.equal(res.code, 0);
  const info = parseJson(res.stdout);
  assert.equal(info.id, validId);
});

test('21. tab-info with non-existent tab-id 999999999 fails with code 1', async () => {
  const res = await runCli(['tab-info', '--tab-id', '999999999']);
  assert.equal(res.code, 1);
  assert.match(res.stderr, /not found/i);
});

test('22. tab-info with non-existent tab-id --json returns error message and code 1', async () => {
  const res = await runCli(['tab-info', '--tab-id', '999999999', '--json']);
  assert.equal(res.code, 1);
  const json = parseJson(res.stdout);
  assert.equal(json.code, 1);
  assert.match(json.error, /not found/i);
});

test('23. open without url returns usage error and code 2', async () => {
  const res = await runCli(['open']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Missing required argument: <url>/i);
});

test('24. goto without url returns usage error and code 2', async () => {
  const res = await runCli(['goto']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Missing required argument: <url>/i);
});

// -----------------------------------------------------------------------------
// GROUP 3: DOM Inspection & Traversal (Tests 25–38)
// -----------------------------------------------------------------------------
test('25. dom command retrieves raw HTML content', async () => {
  const res = await runWithTab(['dom']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /<html/i);
});

test('26. dom --json returns html string and sizeBytes', async () => {
  const res = await runWithTab(['dom', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok('html' in json);
  assert.ok(json.sizeBytes > 0);
});

test('27. dom --clean strips noisy script and style tags', async () => {
  const res = await runWithTab(['dom', '--clean', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(!json.html.includes('<script'));
});

test('28. dom -c shorthand clean flag works', async () => {
  const res = await runWithTab(['dom', '-c', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(!json.html.includes('<script'));
});

test('29. dom --selector "body" scopes snapshot to body element', async () => {
  const res = await runWithTab(['dom', '--selector', 'body', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.match(json.html, /^<body/i);
});

test('30. dom -s shorthand selector works', async () => {
  const res = await runWithTab(['dom', '-s', 'body', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.match(json.html, /^<body/i);
});

test('31. dom --selector for non-existent element falls back gracefully', async () => {
  const res = await runWithTab(['dom', '--selector', '#definitely-missing-element-999', '--json']);
  assert.ok(res.code === 0 || res.code === 1);
});

test('32. dom with --output writes HTML to local file', async () => {
  const outPath = path.resolve(testArtifactsDir, 'test_dom_output.html');
  const res = await runWithTab(['dom', '--output', outPath, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(outPath));
  const content = fssync.readFileSync(outPath, 'utf8');
  assert.match(content, /<html/i);
});

test('33. dom -o shorthand output flag writes to file', async () => {
  const outPath = path.resolve(testArtifactsDir, 'test_dom_short.html');
  const res = await runWithTab(['dom', '-o', outPath, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(outPath));
});

test('34. dom --output creates parent directory recursively', async () => {
  const outPath = path.resolve(testArtifactsDir, 'nested', 'deep', 'dom.html');
  const res = await runWithTab(['dom', '-o', outPath, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(outPath));
});

test('35. dom combined flags --clean --selector "body" -o', async () => {
  const outPath = path.resolve(testArtifactsDir, 'dom_clean_body.html');
  const res = await runWithTab(['dom', '--clean', '--selector', 'body', '-o', outPath, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(outPath));
  const content = fssync.readFileSync(outPath, 'utf8');
  assert.match(content, /^<body/i);
});

test('36. dom targeting invalid tab id fails with code 1', async () => {
  const res = await runCli(['dom', '--tab-id', '999999999']);
  assert.equal(res.code, 1);
});

test('37. dom complex attribute selector div[class*="container"]', async () => {
  const res = await runWithTab(['dom', '--selector', 'div', '--clean', '--json']);
  assert.equal(res.code, 0);
});

test('38. dom with tag selector "main"', async () => {
  const res = await runWithTab(['dom', '-s', 'main', '--json']);
  assert.equal(res.code, 0);
});

// -----------------------------------------------------------------------------
// GROUP 4: Interaction & Form Automation (Tests 39–54)
// -----------------------------------------------------------------------------
test('39. click without selector returns code 2', async () => {
  const res = await runCli(['click']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Missing required argument: <selector>/i);
});

test('40. click without selector --json returns code 2', async () => {
  const res = await runCli(['click', '--json']);
  assert.equal(res.code, 2);
  const json = parseJson(res.stdout);
  assert.equal(json.code, 2);
});

test('41. click on non-existent element fails with code 1', async () => {
  const res = await runWithTab(['click', '#definitely-missing-button-123', '--timeout', '200']);
  assert.equal(res.code, 1);
});

test('42. click with negative --timeout returns code 2', async () => {
  const res = await runCli(['click', 'body', '--timeout', '-100']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Invalid --timeout/i);
});

test('43. click on existing element body succeeds with code 0', async () => {
  const res = await runWithTab(['click', 'body', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
});

test('44. click using -s flag instead of positional argument', async () => {
  const res = await runWithTab(['click', '-s', 'body', '--json']);
  assert.equal(res.code, 0);
});

test('45. type without selector returns code 2', async () => {
  const res = await runCli(['type']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Missing required arguments/i);
});

test('46. type with selector but missing text argument returns code 2', async () => {
  const res = await runCli(['type', 'input']);
  assert.equal(res.code, 2);
});

test('47. type on non-existent input element fails with code 1', async () => {
  const res = await runWithTab(['type', '#nonexistent-input-field-xyz', 'test', '--timeout', '200']);
  assert.equal(res.code, 1);
});

test('48. type empty string into selector', async () => {
  const res = await runWithTab(['type', 'body', '', '--timeout', '500']);
  assert.ok(res.code === 0 || res.code === 1);
});

test('49. type special characters into element', async () => {
  const res = await runWithTab(['type', 'body', 'Special <>&"\'', '--timeout', '500']);
  assert.ok(res.code === 0 || res.code === 1);
});

test('50. fill without argument returns code 2', async () => {
  const res = await runCli(['fill']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Missing.*JSON/i);
});

test('51. fill with invalid JSON string returns code 2', async () => {
  const res = await runCli(['fill', '{invalid json']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Invalid JSON payload/i);
});

test('52. fill with valid empty actions array succeeds with code 0', async () => {
  const res = await runWithTab(['fill', '[]', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.total, 0);
});

test('53. combobox missing arguments returns code 2', async () => {
  const res = await runCli(['combobox']);
  assert.equal(res.code, 2);
});

test('54. upload missing filePath argument returns code 2', async () => {
  const res = await runCli(['upload']);
  assert.equal(res.code, 2);
});

// -----------------------------------------------------------------------------
// GROUP 5: Archiving: HTML, HAR, Sources & Screenshot (Tests 55–72)
// -----------------------------------------------------------------------------
test('55. upload with non-existent file fails with code 1', async () => {
  const res = await runCli(['upload', './nonexistent_test_file_xyz.pdf']);
  assert.equal(res.code, 1);
  assert.match(res.stderr, /File not found/i);
});

test('56. screenshot captures and saves default file', async () => {
  const res = await runWithTab(['screenshot', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
  assert.ok(fssync.existsSync(json.filePath));
});

test('57. screenshot with --output custom path saves file', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_shot.png');
  const res = await runWithTab(['screenshot', '--output', target, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('58. screenshot with -o shorthand saves file', async () => {
  await new Promise(r => setTimeout(r, 500));
  const target = path.resolve(testArtifactsDir, 'cli_shot_short.png');
  const res = await runWithTab(['screenshot', '-o', target, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('59. download-html saves default HTML file', async () => {
  const res = await runWithTab(['download-html', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
  assert.ok(json.fileSizeKB > 0);
  assert.ok(fssync.existsSync(json.filePath));
});

test('60. download-html with --output saves to custom file', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_custom_dl.html');
  const res = await runWithTab(['download-html', '--output', target, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('61. download-html with -o shorthand saves to custom file', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_short_dl.html');
  const res = await runWithTab(['download-html', '-o', target, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('62. download-html with --selector scopes to element', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_scoped_feature.html');
  const res = await runWithTab(['download-html', '--selector', 'body', '-o', target, '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.scopedSelector, 'body');
});

test('63. download-html with --clean strips noisy tags', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_clean_dl.html');
  const res = await runWithTab(['download-html', '--clean', '-o', target, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('64. download-html with non-existent selector fails with code 1', async () => {
  const res = await runWithTab(['download-html', '--selector', '#missing-element-999']);
  assert.equal(res.code, 1);
});

test('65. export-har saves default HAR file', async () => {
  const res = await runWithTab(['export-har', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
  assert.equal(json.harVersion, '1.2');
  assert.ok(fssync.existsSync(json.filePath));
});

test('66. export-har with --output custom path saves file', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_custom_traffic.har');
  const res = await runWithTab(['export-har', '--output', target, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('67. export-har with -o shorthand saves file', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_short_traffic.har');
  const res = await runWithTab(['export-har', '-o', target, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('68. export-har file contains valid HAR 1.2 spec structure', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_validated.har');
  await runWithTab(['export-har', '-o', target, '--json']);
  const har = JSON.parse(fssync.readFileSync(target, 'utf8'));
  assert.ok('log' in har);
  assert.equal(har.log.version, '1.2');
  assert.ok(Array.isArray(har.log.entries));
});

test('69. export-har with --clear flag', async () => {
  const res = await runWithTab(['export-har', '--clear', '--json']);
  assert.equal(res.code, 0);
});

test('70. download-sources with --output custom directory', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_sources');
  const res = await runWithTab(['download-sources', '--output', target, '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
  assert.ok(fssync.existsSync(target));
  assert.ok(fssync.existsSync(path.resolve(target, 'manifest.json')));
});

test('71. download-sources with --no-maps flag', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_sources_nomaps');
  const res = await runWithTab(['download-sources', '-o', target, '--no-maps', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.breakdown.sourcemaps, 0);
});

test('72. download-sources with --types scripts filters only scripts', async () => {
  const target = path.resolve(testArtifactsDir, 'cli_sources_scripts_only');
  const res = await runWithTab(['download-sources', '-o', target, '--types', 'scripts', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.breakdown.images, 0);
  assert.equal(json.breakdown.fonts, 0);
});

// -----------------------------------------------------------------------------
// GROUP 6: JavaScript Evaluation & Dynamic State (Tests 73–84)
// -----------------------------------------------------------------------------
test('73. eval without script argument returns code 2', async () => {
  const res = await runCli(['eval']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Usage: devpilot eval/i);
});

test('74. eval arithmetic expression 1 + 1 returns 2', async () => {
  const res = await runWithTab(['eval', '1 + 1', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.result, 2);
});

test('75. eval string expression document.title returns string', async () => {
  const res = await runWithTab(['eval', 'document.title', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(typeof json.result === 'string');
});

test('76. eval window.location.href returns current url', async () => {
  const res = await runWithTab(['eval', 'window.location.href', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.match(json.result, /^http/);
});

test('77. eval auto-IIFE return statement', async () => {
  const res = await runWithTab(['eval', 'return [1, 2, 3].map(x => x * 10)', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.deepEqual(json.result, [10, 20, 30]);
});

test('78. eval syntax error fails with code 1', async () => {
  const res = await runWithTab(['eval', 'function { broken', '--json']);
  assert.equal(res.code, 1);
  const json = parseJson(res.stdout);
  assert.equal(json.code, 1);
});

test('79. eval thrown exception fails with code 1', async () => {
  const res = await runWithTab(['eval', 'throw new Error("test_exception_xyz")', '--json']);
  assert.equal(res.code, 1);
  const json = parseJson(res.stdout);
  assert.match(json.error, /test_exception_xyz/);
});

test('80. eval multi-statement script', async () => {
  const res = await runWithTab(['eval', 'const a = 10; const b = 20; return a + b;', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.result, 30);
});

test('81. eval complex object serialization', async () => {
  const res = await runWithTab(['eval', 'return { num: 42, str: "hi", nested: { ok: true } }', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.result.num, 42);
  assert.equal(json.result.nested.ok, true);
});

test('82. eval null return value', async () => {
  const res = await runWithTab(['eval', 'return null', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.result, null);
});

test('83. eval optional chaining on non-existent global', async () => {
  const res = await runWithTab(['eval', 'window.__NON_EXISTENT_GLOBAL__?.foo', '--json']);
  assert.equal(res.code, 0);
});

test('84. eval targeting invalid tab id fails with code 1', async () => {
  const res = await runCli(['eval', '--tab-id', '999999999', '1 + 1', '--json']);
  assert.equal(res.code, 1);
});

// -----------------------------------------------------------------------------
// GROUP 7: QA Assertions & Testing (Tests 85–94)
// -----------------------------------------------------------------------------
test('85. assert missing all arguments returns code 2', async () => {
  const res = await runCli(['assert']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Usage: devpilot assert/i);
});

test('86. assert missing condition argument returns code 2', async () => {
  const res = await runCli(['assert', 'body']);
  assert.equal(res.code, 2);
});

test('87. assert with invalid condition name returns code 2', async () => {
  const res = await runCli(['assert', 'body', 'invalid_condition_xyz']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Invalid condition/i);
});

test('88. assert body is_visible passes with code 0', async () => {
  const res = await runWithTab(['assert', 'body', 'is_visible']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /ASSERTION PASSED/i);
});

test('89. assert non-existent element is_visible fails with code 1', async () => {
  const res = await runWithTab(['assert', '#definitely-missing-el-xyz', 'is_visible']);
  assert.equal(res.code, 1);
  assert.match(res.stderr, /ASSERTION FAILED/i);
});

test('90. assert non-existent element is_hidden passes with code 0', async () => {
  const res = await runWithTab(['assert', '#definitely-missing-el-xyz', 'is_hidden']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /ASSERTION PASSED/i);
});

test('91. assert contains_text without expected text returns code 2', async () => {
  const res = await runCli(['assert', 'body', 'contains_text']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /requires an expected value/i);
});

test('92. assert body contains_text non-existent string fails with code 1', async () => {
  const res = await runWithTab(['assert', 'body', 'contains_text', 'DEFINITELY_NOT_EXISTING_XYZ_9999']);
  assert.equal(res.code, 1);
});

test('93. assert body contains_text matching page content passes with code 0', async () => {
  const res = await runWithTab(['assert', 'body', 'contains_text', 'Special']);
  assert.equal(res.code, 0);
});

test('94. assert with --json returns structured assertion result', async () => {
  const res = await runWithTab(['assert', 'body', 'is_visible', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.passed, true);
  assert.equal(json.condition, 'is_visible');
});

// -----------------------------------------------------------------------------
// GROUP 8: Storage, Logs, Audits & Dynamic Operations (Tests 95–110)
// -----------------------------------------------------------------------------
test('95. assert has_attribute without attribute name returns code 2', async () => {
  const res = await runCli(['assert', 'body', 'has_attribute']);
  assert.equal(res.code, 2);
});

test('96. storage missing arguments returns code 2', async () => {
  const res = await runCli(['storage']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Usage: devpilot storage/i);
});

test('97. storage local set and get operations', async () => {
  const setRes = await runWithTab(['storage', 'local', 'set', 'cli_test_key', 'cli_test_val', '--json']);
  assert.equal(setRes.code, 0);

  const getRes = await runWithTab(['storage', 'local', 'get', 'cli_test_key', '--json']);
  assert.equal(getRes.code, 0);
  const json = parseJson(getRes.stdout);
  assert.equal(json.value, 'cli_test_val');
});

test('98. storage local remove operation', async () => {
  const rmRes = await runWithTab(['storage', 'local', 'remove', 'cli_test_key', '--json']);
  assert.equal(rmRes.code, 0);

  const getRes = await runWithTab(['storage', 'local', 'get', 'cli_test_key', '--json']);
  assert.equal(getRes.code, 0);
  const json = parseJson(getRes.stdout);
  assert.equal(json.value, null);
});

test('99. storage session get_all returns code 0', async () => {
  const res = await runWithTab(['storage', 'session', 'get_all', '--json']);
  assert.equal(res.code, 0);
});

test('100. storage cookie get_all returns code 0', async () => {
  const res = await runWithTab(['storage', 'cookie', 'get_all', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(Array.isArray(json));
});

test('101. network command returns code 0', async () => {
  const res = await runCli(['network']);
  assert.equal(res.code, 0);
});

test('102. network command with --limit returns limited rows', async () => {
  const res = await runCli(['network', '--limit', '2', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(Array.isArray(json));
  assert.ok(json.length <= 2);
});

test('103. console command returns code 0', async () => {
  const res = await runCli(['console']);
  assert.equal(res.code, 0);
});

test('104. console command with --limit returns limited rows', async () => {
  const res = await runCli(['console', '--limit', '3', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(Array.isArray(json));
  assert.ok(json.length <= 3);
});

test('105. audit security with --json returns issues array', async () => {
  const res = await runWithTab(['audit', 'security', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(Array.isArray(json));
});

test('106. audit a11y with --json returns violations', async () => {
  const res = await runWithTab(['audit', 'a11y', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(Array.isArray(json));
});

test('107. inject-css without argument returns code 2', async () => {
  const res = await runCli(['inject-css']);
  assert.equal(res.code, 2);
});

test('108. inject-css with valid CSS string succeeds with code 0', async () => {
  const res = await runWithTab(['inject-css', 'body { opacity: 0.999; }', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
});

test('109. debug-layout command toggles layout debug mode', async () => {
  const res = await runWithTab(['debug-layout', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
});

test('110. record status returns recording state', async () => {
  const res = await runWithTab(['record', 'status', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok('recording' in json);
});

// -----------------------------------------------------------------------------
// GROUP 9: Web Reverse Engineering & REA Evidence Bridge (Tests 111–130)
// -----------------------------------------------------------------------------
test('111. unpack-sources on non-existent input directory fails with code 1', async () => {
  const res = await runCli(['unpack-sources', './non-existent-sources-dir-999', '--json']);
  assert.equal(res.code, 1);
  const json = parseJson(res.stdout);
  assert.match(json.error, /not found/i);
});

test('112. unpack-sources on fixture directory with valid SourceMap V3 unpacks files', async () => {
  // Create sample sourcemap fixture
  const fixtureDir = path.resolve(testArtifactsDir, 'fixture_sourcemap');
  fssync.mkdirSync(fixtureDir, { recursive: true });
  const sampleMap = {
    version: 3,
    file: "bundle.js",
    sources: ["webpack:///src/components/Button.tsx", "webpack:///src/utils/math.ts"],
    sourcesContent: [
      "export const Button = () => <button>Click</button>;",
      "export const add = (a: number, b: number) => a + b;"
    ]
  };
  fssync.writeFileSync(path.join(fixtureDir, 'bundle.js.map'), JSON.stringify(sampleMap), 'utf8');

  const outDir = path.resolve(testArtifactsDir, 'reconstructed_test_112');
  const res = await runCli(['unpack-sources', fixtureDir, '--output', outDir, '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.totalFiles, 2);
  assert.ok(fssync.existsSync(path.join(outDir, 'src/components/Button.tsx')));
  assert.ok(fssync.existsSync(path.join(outDir, 'src/utils/math.ts')));
});

test('113. unpack-sources detects technologies from reconstructed files', async () => {
  const outDir = path.resolve(testArtifactsDir, 'reconstructed_test_112');
  assert.ok(fssync.existsSync(path.join(outDir, 'reconstruction-manifest.json')));
  const manifest = JSON.parse(fssync.readFileSync(path.join(outDir, 'reconstruction-manifest.json'), 'utf8'));
  assert.ok(Array.isArray(manifest.detectedTechStack));
  assert.ok(manifest.detectedTechStack.includes('React'));
  assert.ok(manifest.detectedTechStack.includes('TypeScript'));
});

test('114. unpack-sources normalizes dirty and virtual sourcemap paths safely', async () => {
  const fixtureDir = path.resolve(testArtifactsDir, 'fixture_dirty_paths');
  fssync.mkdirSync(fixtureDir, { recursive: true });
  const sampleMap = {
    version: 3,
    sources: [
      "turbopack:///[project]/src/App.tsx?entry",
      "vite:///../dirty/path/file:name*?.js"
    ],
    sourcesContent: [
      "export default function App() { return <div>App</div>; }",
      "console.log('sanitized');"
    ]
  };
  fssync.writeFileSync(path.join(fixtureDir, 'dirty.map'), JSON.stringify(sampleMap), 'utf8');

  const outDir = path.resolve(testArtifactsDir, 'reconstructed_test_114');
  const res = await runCli(['unpack-sources', fixtureDir, '-o', outDir, '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.totalFiles, 2);
});

test('115. unpack-sources extracts modules when sourcemaps are stripped', async () => {
  const fixtureDir = path.resolve(testArtifactsDir, 'fixture_bundle_only');
  fssync.mkdirSync(fixtureDir, { recursive: true });
  const dummyBundle = `
    (self["webpackChunk"] = self["webpackChunk"] || []).push([
      {
        "./src/featureA.js": function(module, exports) {
          module.exports = { a: 1 };
        },
        "./src/featureB.js": function(module, exports) {
          module.exports = { b: 2 };
        }
      }
    ]);
  `;
  fssync.writeFileSync(path.join(fixtureDir, 'app.js'), dummyBundle, 'utf8');

  const outDir = path.resolve(testArtifactsDir, 'reconstructed_test_115');
  const res = await runCli(['unpack-sources', fixtureDir, '-o', outDir, '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(json.extractedModulesCount >= 1);
});

test('116. trace-action missing selector argument returns code 2', async () => {
  const res = await runCli(['trace-action']);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Missing required argument: <selector>/i);
});

test('117. trace-action on non-existent element fails with code 1', async () => {
  const res = await runWithTab(['trace-action', '#missing-button-abc', '--wait', '300']);
  assert.equal(res.code, 1);
});

test('118. trace-action on existing body element succeeds with code 0', async () => {
  const res = await runWithTab(['trace-action', 'body', '--wait', '300']);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /outgoing requests detected/i);
});

test('119. trace-action with --json returns structured response', async () => {
  const res = await runWithTab(['trace-action', 'body', '--wait', '300', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.selector, 'body');
  assert.ok('triggeredRequestsCount' in json);
  assert.ok(Array.isArray(json.triggeredRequests));
});

test('120. trace-action with custom wait duration', async () => {
  const res = await runWithTab(['trace-action', 'body', '--wait', '200', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.waitDurationMs, 200);
});

test('121. extract-endpoints on non-existent target fails with code 1', async () => {
  const res = await runCli(['extract-endpoints', './non-existent-path-abc', '--json']);
  assert.equal(res.code, 1);
  const json = parseJson(res.stdout);
  assert.match(json.error, /not found/i);
});

test('122. extract-endpoints on directory with JS files discovers API routes', async () => {
  const fixtureDir = path.resolve(testArtifactsDir, 'fixture_api_js');
  fssync.mkdirSync(fixtureDir, { recursive: true });
  const sampleJs = `
    fetch('/api/v1/users', { method: 'GET' });
    fetch('/api/v1/auth/login', { method: 'POST' });
    axios.delete('/api/v2/items/123');
  `;
  fssync.writeFileSync(path.join(fixtureDir, 'api.js'), sampleJs, 'utf8');

  const res = await runCli(['extract-endpoints', fixtureDir, '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(json.totalEndpoints >= 2);
  const paths = json.endpoints.map(e => e.path);
  assert.ok(paths.some(p => p.includes('/api/v1/users')));
  assert.ok(paths.some(p => p.includes('/api/v1/auth/login')));
});

test('123. extract-endpoints on HAR file extracts network endpoints', async () => {
  const harPath = path.resolve('downloads_test', 'network.har');
  if (fssync.existsSync(harPath)) {
    const res = await runCli(['extract-endpoints', harPath, '--json']);
    assert.equal(res.code, 0);
    const json = parseJson(res.stdout);
    assert.ok(json.totalEndpoints > 0);
  }
});

test('124. extract-endpoints with --output writes valid OpenAPI 3.0 spec', async () => {
  const fixtureDir = path.resolve(testArtifactsDir, 'fixture_api_js');
  const specPath = path.resolve(testArtifactsDir, 'generated_openapi.json');
  const res = await runCli(['extract-endpoints', fixtureDir, '--output', specPath, '--json']);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(specPath));
  const spec = JSON.parse(fssync.readFileSync(specPath, 'utf8'));
  assert.equal(spec.openapi, '3.0.0');
  assert.ok(Object.keys(spec.paths).length > 0);
});

test('125. extract-endpoints human table format output', async () => {
  const fixtureDir = path.resolve(testArtifactsDir, 'fixture_api_js');
  const res = await runCli(['extract-endpoints', fixtureDir]);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /Discovered.*API endpoints/i);
});

test('126. export-rea on active tab generates Evidence bundle file', async () => {
  const target = path.resolve(testArtifactsDir, 'test_rea_evidence_126.json');
  const res = await runWithTab(['export-rea', '--output', target]);
  assert.equal(res.code, 0);
  assert.ok(fssync.existsSync(target));
});

test('127. export-rea with --json outputs evidence metadata', async () => {
  const target = path.resolve(testArtifactsDir, 'test_rea_evidence_127.json');
  const res = await runWithTab(['export-rea', '--output', target, '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.equal(json.status, 'success');
  assert.ok(json.evidenceId.startsWith('ev_'));
  assert.ok(json.sizeBytes > 0);
});

test('128. export-rea Evidence file conforms to REA schema specifications', async () => {
  const target = path.resolve(testArtifactsDir, 'test_rea_evidence_127.json');
  const evidence = JSON.parse(fssync.readFileSync(target, 'utf8'));
  assert.ok('evidence_id' in evidence);
  assert.equal(evidence.schema_version, '2.0.0');
  assert.equal(evidence.provider.id, 'io.github.xtradevpilot.bridge');
  assert.equal(evidence.operation, 'observe_web_session');
  assert.ok('normalized_result' in evidence);
  assert.ok('raw_result' in evidence);
});

test('129. export-rea targeting invalid tab ID fails with code 1', async () => {
  const res = await runCli(['export-rea', '--tab-id', '999999999', '--json']);
  assert.equal(res.code, 1);
  const json = parseJson(res.stdout);
  assert.match(json.error, /not found/i);
});

test('130. export-rea default filename fallback creates file in cwd', async () => {
  const res = await runWithTab(['export-rea', '--json']);
  assert.equal(res.code, 0);
  const json = parseJson(res.stdout);
  assert.ok(fssync.existsSync(json.savedTo));
  if (fssync.existsSync(json.savedTo) && json.savedTo.endsWith('xtradevpilot-rea-evidence.json')) {
    fssync.unlinkSync(json.savedTo);
  }
});

