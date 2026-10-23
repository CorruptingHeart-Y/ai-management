'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
process.chdir(path.resolve(__dirname, '..'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const real = path.resolve('data/db.json'), before = hash(real), checks = [];
const child = spawn(process.execPath, ['scripts/start-demo.cjs'], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
async function main() {
  let meta;
  try {
    const base = await new Promise((resolve, reject) => {
      let output = '', errors = '';
      const timeout = setTimeout(() => reject(Error('Demo startup timeout')), 15000);
      const fail = error => { clearTimeout(timeout); reject(error); };
      child.once('error', fail);
      child.once('exit', code => fail(Error(`Demo exited ${code}: ${errors}`)));
      child.stderr.on('data', part => { errors = (errors + part).slice(-1500); });
      child.stdout.on('data', part => {
        output += part;
        const line = output.split('\n').find(x => x.startsWith('{'));
        if (line) meta = JSON.parse(line);
        const match = /http:\/\/localhost:(\d+)/.exec(output);
        if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
      });
    });
    function check(name, actual, expected) {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      checks.push({ name, actual, expected, pass });
      if (!pass) throw Error(name);
    }
    async function request(route, token, method = 'GET', body) {
      const response = await fetch(`${base}/api${route}`, { method, signal: AbortSignal.timeout(10000),
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    }
    check('anonymous access blocked', (await request('/tasks')).status, 401);
    const login = username => request('/auth/login', null, 'POST', {
      username, password: username === 'admin' ? 'admin123' : 'member123',
    });
    const admin = await login('admin'), member = await login('pengjiacheng');
    check('admin login', admin.status, 200); check('member login', member.status, 200);
    const a = admin.body.token, m = member.body.token;
    check('four members', (await request('/members', a)).body.length, 4);
    check('three iterations', (await request('/iterations', a)).body.length, 3);
    check('empty fresh demo', (await request('/tasks', a)).body.length, 0);
    const first = await request('/tasks', a, 'POST', { title: 'overdue smoke', assigneeId: 2, priority: 'HIGH', dueDate: '2000-01-01', iterationId: 2 });
    check('create overdue', first.status, 201);
    check('create future', (await request('/tasks', a, 'POST', { title: 'future smoke', assigneeId: 1, priority: 'LOW', dueDate: '9999-12-31', iterationId: 3 })).status, 201);
    check('combined filters', (await request('/task-query?status=TODO&priority=HIGH&iterationId=2&assigneeId=2&q=overdue', m)).body.matched, 1);
    check('overdue result', (await request('/task-query?overdue=true', m)).body.matched, 1);
    const snapshot = hash(meta.dataFile);
    check('member create blocked', (await request('/tasks', m, 'POST', { title: 'denied', assigneeId: 1 })).status, 403);
    check('denied request preserves bytes', hash(meta.dataFile), snapshot);
    check('member status allowed', (await request(`/tasks/${first.body.id}/status`, m, 'PATCH', { status: 'DONE' })).status, 200);
    check('done excluded', (await request('/task-query?overdue=true', m)).body.matched, 0);
    const stats = (await request('/stats', a)).body;
    check('statistics consistent', [stats.total, stats.byStatus.TODO, stats.byStatus.DOING, stats.byStatus.DONE], [2, 1, 0, 1]);
    check('real data unchanged', hash(real), before);
    check('reset option rejected', spawnSync(process.execPath, ['scripts/start-demo.cjs', '--reset'], { encoding: 'utf8' }).status, 2);
    console.log(JSON.stringify({ executedAt: new Date().toISOString(), command: 'node scripts/check-demo.cjs',
      scope: 'disposable demo HTTP smoke; not manual/browser approval', metadata: meta, passed: checks.length, checks }, null, 2));
  } finally {
    if (child.exitCode === null && child.signalCode === null) await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(Error('Demo did not stop')); }, 5000);
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
      if (child.connected) child.send({ command: 'stop-demo' }); else child.kill();
    });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
