'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readSourceContext } = require('../scripts/lib/source-context.cjs');

function archive(t, sha) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-management-version-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (sha !== undefined) fs.writeFileSync(path.join(root, 'SOURCE_VERSION.json'),
    JSON.stringify({ format: 'ai-management-git-archive-v1', sha }));
  return root;
}
const noGit = () => ({ status: 128, stdout: '' });

test('archive metadata: project Git wins over an unexpanded archive template', t => {
  const root = archive(t, '$Format:%H$');
  const git = args => ({ status: 0, stdout: args.includes('--show-toplevel') ? root
    : args.includes('HEAD') ? 'a'.repeat(40) : args.includes('--show-current') ? 'integration/sprint3' : '' });
  assert.deepEqual(readSourceContext(root, git), { sha: 'a'.repeat(40), branch: 'integration/sprint3', dirty: false, versionSource: 'git' });
});

test('archive metadata: missing or unexpanded version cannot silently fabricate a SHA', t => {
  assert.throws(() => readSourceContext(archive(t), noGit), /No project Git/);
  assert.throws(() => readSourceContext(archive(t, '$Format:%H$'), noGit), /Invalid archive/);
});

test('archive metadata: exported SHA is accepted with unknown branch/dirty, not claimed clean', t => {
  const root = archive(t, 'b'.repeat(40));
  const source = readSourceContext(root, noGit);
  assert.equal(source.sha, 'b'.repeat(40));
  assert.equal(source.versionSource, 'git-archive-manifest');
  assert.equal(source.branch, null); assert.equal(source.dirty, null);
  assert.match(source.sourceIntegrity, /all runtime tests/);
});

test('archive metadata: an unrelated parent repository cannot identify the archive version', t => {
  const root = archive(t, 'c'.repeat(40));
  const source = readSourceContext(root, () => ({ status: 0, stdout: path.dirname(root) }));
  assert.equal(source.sha, 'c'.repeat(40));
  assert.equal(source.versionSource, 'git-archive-manifest');
});
