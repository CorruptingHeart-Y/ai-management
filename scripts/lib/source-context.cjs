'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function readSourceContext(root, runGit = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' })) {
  const top = runGit(['rev-parse', '--show-toplevel']);
  if (!top.error && top.status === 0 && path.resolve(top.stdout.trim()) === path.resolve(root)) {
    const read = args => {
      const result = runGit(args);
      if (result.error || result.status !== 0) throw new Error('Git metadata unavailable in the project checkout');
      return result.stdout.trim();
    };
    return { sha: read(['rev-parse', 'HEAD']), branch: read(['branch', '--show-current']),
      dirty: !!read(['status', '--porcelain']), versionSource: 'git' };
  }
  // Only a git-archive substituted manifest is a usable version anchor. It is
  // metadata, never proof of review or a bypass for hashes/tests/TODO policy.
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, 'SOURCE_VERSION.json'), 'utf8')); }
  catch { throw new Error('No project Git metadata or exported SOURCE_VERSION.json'); }
  if (manifest.format !== 'ai-management-git-archive-v1' || !/^[a-f0-9]{40}$/.test(manifest.sha)) {
    throw new Error('Invalid archive version; export this commit with git archive');
  }
  return { sha: manifest.sha, branch: null, dirty: null, versionSource: 'git-archive-manifest',
    sourceIntegrity: 'Archive metadata only; original hashes and all runtime tests are still required' };
}
module.exports = { readSourceContext };
