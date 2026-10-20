import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '..', 'bin', 'devpilot.js');

async function runCli(args = []) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [cliPath, ...args], {
      timeout: 10000,
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

test('init-skill CLI command suite', async (t) => {
  await t.test('1. init-skill appears in global help', async () => {
    const res = await runCli(['--help']);
    assert.equal(res.code, 0);
    assert.match(res.stdout, /init-skill/);
  });

  await t.test('2. init-skill --target cursor --json outputs created file', async () => {
    const res = await runCli(['init-skill', '--target', 'cursor', '--json']);
    assert.equal(res.code, 0);
    const data = JSON.parse(res.stdout);
    assert.equal(data.status, 'success');
    assert.equal(data.target, 'cursor');
    assert.ok(Array.isArray(data.createdFiles));
    assert.ok(data.createdFiles.some(p => p.includes('xtradevpilot.mdc')));
  });

  await t.test('3. init-skill --target antigravity --json outputs created SKILL.md', async () => {
    const res = await runCli(['init-skill', '--target', 'antigravity', '--json']);
    assert.equal(res.code, 0);
    const data = JSON.parse(res.stdout);
    assert.equal(data.status, 'success');
    assert.equal(data.target, 'antigravity');
    assert.ok(data.createdFiles.some(p => p.includes('SKILL.md')));
  });

  await t.test('4. init-skill --target all --json creates both artifacts', async () => {
    const res = await runCli(['init-skill', '--target', 'all', '--json']);
    assert.equal(res.code, 0);
    const data = JSON.parse(res.stdout);
    assert.equal(data.status, 'success');
    assert.ok(data.createdFiles.length >= 2);
  });

  await t.test('5. generated SKILL.md contains all 10 superpowers, not just REA', async () => {
    const skillPath = path.resolve(__dirname, '..', '.agents', 'skills', 'xtradevpilot', 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), 'SKILL.md must exist in .agents/skills/xtradevpilot/');
    const content = fs.readFileSync(skillPath, 'utf8');

    // Verify key directives beyond reverse engineering:
    assert.match(content, /get_clean_dom_snapshot/i);
    assert.match(content, /batch_fill_form/i);
    assert.match(content, /smart_select_combobox/i);
    assert.match(content, /upload_file/i);
    assert.match(content, /execute_script/i);
    assert.match(content, /toggle_layout_debug_mode/i);
    assert.match(content, /assert_element_state/i);
    assert.match(content, /record_user_flow/i);
    assert.match(content, /mock_network_response/i);
    assert.match(content, /extract_structured_data/i);
  });
});
