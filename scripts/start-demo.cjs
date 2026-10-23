'use strict';
// New isolated dataset on every invocation; never reset or reuse real data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { SEED_MEMBERS } = require('../src/db');
const { SEED_USERS } = require('../src/domain/user');
if (process.argv.length !== 2) {
  console.error('Usage: node scripts/start-demo.cjs (no reset or file override options)');
  process.exit(2);
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-management-demo-'));
const file = path.join(directory, 'demo-db.json');
fs.writeFileSync(file, JSON.stringify({ members: SEED_MEMBERS, users: SEED_USERS,
  iterations: [{ id: 1, name: 'Sprint 1' }, { id: 2, name: 'Sprint 2' }, { id: 3, name: 'Sprint 3' }], tasks: [] }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const child = spawn(process.execPath, ['server.js'], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DATA_FILE: file },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
console.log(JSON.stringify({ scope: 'ISOLATED_DEMO_NOT_PRODUCTION', dataFile: file,
  realDataUnchanged: true, persistence: 'temporary directory retained after stop; no reset of existing files' }));
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 0 : (code || 0);
  if (process.connected) process.disconnect();
});
process.on('message', message => { if (message?.command === 'stop-demo') child.kill(); });
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
