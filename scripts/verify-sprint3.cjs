'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseSummary, blockers, fields } = require('./lib/quality-policy.cjs');
const baseline = require('../docs/sprint3/protected-baseline.json');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const hash = text => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`Git metadata unavailable: ${args.join(' ')}`);
  return result.stdout.trim();
}
function discover(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? discover(file) : entry.isFile() && entry.name.endsWith('.test.js')
      ? [path.relative(root, file).split(path.sep).join('/')] : [];
  }).sort();
}
function run(label, files) {
  if (!files.length) throw new Error(`No files in ${label}`);
  console.log(`RUN ${label}: ${JSON.stringify(files)}`);
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  const summary = parseSummary(result.stdout || '');
  const errors = blockers(summary);
  if (result.error || result.status !== 0) errors.push(`runner exit=${result.status}: ${result.error?.message || ''}`);
  console.log(`SUMMARY ${label}: ${JSON.stringify(summary)}`);
  return { label, files, summary, errors };
}
try {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/verify-sprint3.cjs (no bypass flags)');
  console.log(JSON.stringify({ date: new Date().toISOString(), node: process.version,
    sha: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'),
    dirty: !!git('status', '--porcelain'), command: 'node scripts/verify-sprint3.cjs',
    scope: 'current checkout automated quality only; not human release acceptance' }));
  for (const [file, expected] of Object.entries(baseline.files)) {
    if (hash(fs.readFileSync(file, 'utf8')) !== expected) throw new Error(`Original test modified: ${file}`);
  }
  const integration = fs.readFileSync('test/sprint2-integration.test.js', 'utf8').replace(/\r\n/g, '\n');
  const prefix = integration.slice(0, integration.indexOf('// Sprint 3补齐'));
  if (hash(prefix) !== baseline.originalIntegrationPrefixHash) {
    throw new Error('Original five integration assertions modified');
  }
  const protectedFiles = Object.keys(baseline.files);
  const files = discover(path.join(root, 'test'));
  const results = [run('protected-original-seven', protectedFiles),
    run('additional-recursive-tests', files.filter(file => !protectedFiles.includes(file)))];
  if (results[0].summary.tests !== baseline.expectedOriginalCount) {
    results[0].errors.push(`Expected original ${baseline.expectedOriginalCount} tests`);
  }
  const totals = Object.fromEntries(fields.map(field => [field,
    results.reduce((sum, result) => sum + result.summary[field], 0)]));
  console.log(`TOTAL: ${JSON.stringify(totals)}`);
  const errors = results.flatMap(result => result.errors.map(error => `${result.label}: ${error}`));
  if (errors.length) throw new Error(errors.join('; '));
  console.log('AUTOMATED_QUALITY_GATE_PASS: human review, feature completeness and PO release acceptance remain separate.');
} catch (error) {
  console.error(`AUTOMATED_QUALITY_GATE_BLOCKED: ${error.message}`);
  process.exitCode = 1;
}
