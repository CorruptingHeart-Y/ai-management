'use strict';
// Static material/config inventory only. Runtime counts come from npm test.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
process.chdir(root);
const exists = file => fs.existsSync(path.join(root, file));
function discover(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? discover(file) : entry.isFile() && entry.name.endsWith('.test.js')
      ? [path.relative(root, file).split(path.sep).join('/')] : [];
  }).sort();
}
const required = ['server.js', 'src/app.js', 'src/db.js', 'src/features/task-filters.js',
  'package.json', 'README.md', 'data/db.json', 'scripts/verify-sprint3.cjs',
  'scripts/lib/quality-policy.cjs', '.github/workflows/quality.yml',
  'test/e2e/main-journey.test.js', 'test/e2e/exception-journey.test.js',
  'docs/sprint3/release-readiness.md', 'docs/sprint3/release-notes.md', 'docs/sprint3/user-guide.md',
  'docs/sprint3/review-log.md', 'docs/sprint3/technical-debt-disposition.md'];
const problems = [];
const missing = required.filter(file => !exists(file));
if (missing.length) problems.push(`Missing files: ${missing.join(', ')}`);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tests = discover(path.join(root, 'test'));
const e2e = tests.filter(file => file.startsWith('test/e2e/'));
if (pkg.scripts?.test !== 'node scripts/verify-sprint3.cjs') problems.push('npm test must use the recursive quality gate');
if (e2e.length < 2) problems.push('Both strict E2E journeys are required');
const gate = exists('scripts/verify-sprint3.cjs') ? fs.readFileSync('scripts/verify-sprint3.cjs', 'utf8') : '';
if (!gate.includes("discover(path.join(root, 'test'))")) problems.push('Recursive discovery configuration is missing');
const notes = exists('docs/sprint3/release-notes.md') ? fs.readFileSync('docs/sprint3/release-notes.md', 'utf8') : '';
for (const word of ['已知限制', '回滚', '尚未发布']) if (!notes.includes(word)) problems.push(`Release boundary missing: ${word}`);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
if (git.status !== 0) problems.push('Git SHA unavailable');
const output = { checkedAt: new Date().toISOString(), sha: git.status === 0 ? git.stdout.trim() : null,
  command: 'node docs/sprint3/checks/release-check.cjs',
  scope: 'STATIC_INVENTORY_ONLY', requiredFiles: required.length, missing,
  tests: { discoveredFiles: tests.length, files: tests, e2e, recursivelyIncludedByConfiguration: !problems.length,
    executed: false, runtimeTodo: null, runtimeSkipped: null, runtimeCountsSource: 'npm test actual TAP totals; no static regex inference' },
  materialCheck: problems.length ? 'BLOCKED' : 'PASS',
  releaseDecision: 'HUMAN_APPROVAL_REQUIRED', problems };
console.log(JSON.stringify(output, null, 2));
if (problems.length) process.exitCode = 1;
