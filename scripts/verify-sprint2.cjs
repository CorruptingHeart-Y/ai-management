'use strict';
// 独立质量入口；package.json 仍由朱传玺统一修改。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const preparation = process.argv.includes('--baseline-only');
if (process.argv.slice(2).some(arg => arg !== '--baseline-only')) {
  console.error('Usage: node scripts/verify-sprint2.cjs [--baseline-only]');
  process.exit(2);
}
const baseline = require('../docs/sprint2/baseline-test-hashes.json');
const stories = ['test/task-attrs.test.js', 'test/iterations.test.js', 'test/stats.test.js'];
const integration = 'test/sprint2-integration.test.js';
const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();
console.log(JSON.stringify({ date: new Date().toISOString(), branch: git('branch', '--show-current'),
  sha: git('rev-parse', 'HEAD'), dirty: !!git('status', '--porcelain'),
  command: ['node', 'scripts/verify-sprint2.cjs', ...process.argv.slice(2)],
  mode: preparation ? 'PREPARATION_ONLY' : 'AUTOMATED_INTEGRATION_GATE' }));
for (const [file, expected] of Object.entries(baseline.files)) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const actual = crypto.createHash('sha256').update(text).digest('hex');
  if (actual !== expected) {
    console.error(`BLOCKED: Sprint 1 original test changed: ${file}`);
    process.exit(1);
  }
}
const missing = stories.filter(file => !fs.existsSync(file));
if (!preparation && missing.length) {
  console.error(`BLOCKED: missing story tests: ${missing.join(', ')}`);
  process.exit(1);
}
function run(files) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { encoding: 'utf8' });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error || result.status !== 0) process.exit(result.status || 1);
  const summary = {};
  for (const field of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const match = result.stdout.match(new RegExp(`^# ${field} (\\d+)$`, 'm'));
    if (!match) throw new Error(`Missing TAP summary: ${field}`);
    summary[field] = Number(match[1]);
  }
  return summary;
}
const old = run(Object.keys(baseline.files));
if (old.tests !== 35 || old.pass !== 35 || old.todo || old.skipped) {
  console.error('BLOCKED: original 35-test baseline incomplete');
  process.exit(1);
}
const added = run([...(!preparation ? stories : []), integration]);
if (!preparation && (added.todo || added.skipped || added.cancelled)) {
  console.error('BLOCKED: pending/skipped new integration coverage');
  process.exit(1);
}
console.log(JSON.stringify({ baseline: old, additional: added, missingStoryFiles: missing }));
console.log(preparation ? 'PREPARATION_ONLY: no Sprint 2 acceptance claimed.'
  : 'AUTOMATED_GATE_PASS: human diff review, browser acceptance and PO approval remain separate.');
