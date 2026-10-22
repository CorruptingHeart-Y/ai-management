'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, request, login, data, makeTempDataFile } = require('./support/permission-helpers');
const { createDb } = require('../src/db');
const createSession = require('../public/session');

test('TD06: malformed root/collections/task fields are rejected without changing one byte', async t => {
  const { base, file } = await start(t);
  const token = await login(base);
  const seed = data();
  const invalid = [null, [], {}, { ...seed, tasks: { sentinel: 'retain' } },
    { ...seed, tasks: [null] }, { ...seed, tasks: [seed.tasks[0], seed.tasks[0]] },
    { ...seed, users: {} }, { ...seed, iterations: {} }];
  for (const field of [{ id: 0 }, { id: '1' }, { title: ' ' }, { status: 'BLOCKED' },
    { priority: 'URGENT' }, { dueDate: '2026-02-30' }, { assigneeId: 0 },
    { description: {} }, { iterationId: '2' }, { createdAt: 'not a date' }]) {
    invalid.push({ ...seed, tasks: [{ ...seed.tasks[0], ...field }] });
  }
  for (const sample of invalid) {
    const raw = JSON.stringify(sample);
    fs.writeFileSync(file, raw);
    for (const [route, method, body] of [
      ['/tasks', 'GET'], ['/task-query', 'GET'], ['/stats', 'GET'],
      ['/tasks', 'POST', { title: 'must not overwrite', assigneeId: 1 }],
      ['/tasks/1/status', 'PATCH', { status: 'DONE' }],
    ]) {
      const response = await request(base, route, token, method, body);
      assert.equal(response.status, 500, `${route}: ${raw}`);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.equal(typeof (await response.json()).error, 'string');
      assert.equal(fs.readFileSync(file, 'utf8'), raw);
    }
    assert.throws(() => createDb(file).writeData(seed));
    assert.equal(fs.readFileSync(file, 'utf8'), raw);
  }
});

test('TD06: orphan references remain inspectable but block all persistence', async t => {
  for (const field of [{ assigneeId: 999 }, { iterationId: 999 }]) {
    const seed = data(); seed.tasks[0] = { ...seed.tasks[0], ...field };
    const { base, file } = await start(t, makeTempDataFile(t, seed));
    const token = await login(base);
    const before = fs.readFileSync(file, 'utf8');
    assert.equal((await request(base, '/stats', token)).status, 200);
    for (const [route, body] of [
      ['/tasks/1/status', { status: 'DONE' }], ['/users/2/role', { role: 'admin' }],
    ]) assert.equal((await request(base, route, token, 'PATCH', body)).status, 500);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
  }
});

for (const stage of ['open', 'partial-write', 'fsync', 'rename']) {
  test(`TD02: ${stage} failure on create/status/login preserves source and removes temporary file`, async t => {
    for (const action of ['create', 'status', 'login']) {
      const seed = data(); if (action === 'login') delete seed.users;
      const { base, file } = await start(t, makeTempDataFile(t, seed));
      const token = action === 'login' ? undefined : await login(base);
      const before = fs.readFileSync(file, 'utf8');
      const method = stage === 'open' ? 'openSync' : stage === 'partial-write' ? 'writeFileSync' : stage === 'fsync' ? 'fsyncSync' : 'renameSync';
      const original = fs[method];
      const mock = t.mock.method(fs, method, function (target, ...args) {
        const ours = method === 'openSync' ? typeof target === 'string' && target.startsWith(`${file}.write-`)
          : method === 'renameSync' ? args[0] === file : typeof target === 'number';
        if (ours) {
          if (stage === 'partial-write') original.call(this, target, '{truncated');
          throw Object.assign(new Error('private path must not escape'), { code: 'EIO' });
        }
        return original.call(this, target, ...args);
      });
      try {
        const response = action === 'login'
          ? await request(base, '/auth/login', null, 'POST', { username: 'admin', password: 'admin123' })
          : await request(base, action === 'create' ? '/tasks' : '/tasks/1/status', token,
            action === 'create' ? 'POST' : 'PATCH', action === 'create' ? { title: 'atomic create', assigneeId: 1 } : { status: 'DONE' });
        assert.equal(response.status, 500);
        const body = await response.json();
        assert.equal(body.token, undefined);
        assert.ok(!JSON.stringify(body).includes('private path'));
        assert.equal(fs.readFileSync(file, 'utf8'), before);
        assert.deepEqual(fs.readdirSync(path.dirname(file)), ['db.json']);
      } finally { mock.mock.restore(); }
    }
  });
}

test('TD06: read EIO rejects reads and writes without exposing paths or changing the source', async t => {
  const { base, file } = await start(t); const token = await login(base);
  const read = fs.readFileSync; const before = read(file, 'utf8');
  const mock = t.mock.method(fs, 'readFileSync', function (target, ...args) {
    if (target === file) throw Object.assign(new Error('private disk path'), { code: 'EIO' });
    return read.call(this, target, ...args);
  });
  try {
    for (const [route, method, body] of [['/tasks', 'GET'], ['/task-query', 'GET'],
      ['/tasks', 'POST', { title: 'rejected', assigneeId: 1 }], ['/tasks/1/status', 'PATCH', { status: 'DONE' }]]) {
      const response = await request(base, route, token, method, body);
      assert.equal(response.status, 500);
      assert.ok(!JSON.stringify(await response.json()).includes('private disk path'));
      assert.equal(read(file, 'utf8'), before);
    }
  } finally { mock.mock.restore(); }
});

test('TD02/06: legacy fields and unknown extensions survive successful task writes', async t => {
  const { base, file } = await start(t);
  const token = await login(base);
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal((await request(base, '/tasks', token, 'POST', { title: 'legacy request', assigneeId: 1 })).status, 201);
  assert.equal((await request(base, '/tasks/1/status', token, 'PATCH', { status: 'DONE' })).status, 200);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['members', 'iterations', 'users', 'extension']) assert.deepEqual(after[key], before[key]);
});

test('US05: member changes status with validation; all other member writes stay forbidden', async t => {
  const { base, file } = await start(t);
  const token = await login(base, 'yanghaowei');
  const before = fs.readFileSync(file, 'utf8');
  assert.equal((await request(base, '/tasks/1/status', token, 'PATCH', { status: 'BLOCKED' })).status, 400);
  assert.equal((await request(base, '/tasks/999/status', token, 'PATCH', { status: 'DONE' })).status, 404);
  for (const [route, method] of [['/tasks', 'POST'], ['/tasks/1', 'PATCH'],
    ['/tasks/1/status/extra', 'PATCH'], ['/users/2/role', 'PATCH'], ['/iterations', 'POST']]) {
    assert.equal((await request(base, route, token, method, { role: 'admin', status: 'DONE' }, { 'X-Role': 'admin' })).status, 403);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  for (const status of ['DOING', 'DONE']) {
    assert.equal((await request(base, '/tasks/1/status', token, 'PATCH', { status })).status, 200);
    const stats = await (await request(base, '/stats', token)).json();
    assert.equal(stats.byStatus[status], 1);
  }
});

test('US05 UI capabilities distinguish status update from administrator writes', () => {
  const storage = new Map();
  const session = createSession({ localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, addEventListener() {} });
  assert.equal(session.canUpdateStatus(), false);
  session.setSession('member-token', { id: 3, username: 'member', role: 'member' });
  assert.equal(session.canWrite(), false); assert.equal(session.canUpdateStatus(), true);
  session.setSession(null, null); assert.equal(session.canUpdateStatus(), false);
});

test('US11/12: production factory mounts real protected filters without a test hook', async t => {
  const { base } = await start(t);
  assert.equal((await request(base, '/task-query')).status, 401);
  const member = await login(base, 'pengjiacheng');
  const response = await request(base, '/task-query?status=TODO', member);
  assert.equal(response.status, 200); assert.equal((await response.json()).matched, 1);
  const page = await (await fetch(`${base}/`)).text();
  assert.match(page, /href="task-filters.html"/);
});

test('UI: concurrent expired requests both remain 401 instead of becoming network errors', async () => {
  const storage = new Map(); const finish = [];
  const session = createSession({ location: { href: 'http://localhost/', origin: 'http://localhost' },
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    addEventListener() {}, fetch: () => new Promise(resolve => finish.push(resolve)) });
  session.setSession('expired', { id: 3, username: 'member', role: 'member' });
  const one = session.fetch('/api/members'), two = session.fetch('/api/iterations');
  finish[0](Response.json({ error: 'expired' }, { status: 401 }));
  finish[1](Response.json({ error: 'expired' }, { status: 401 }));
  const responses = await Promise.all([one, two]);
  assert.deepEqual(responses.map(x => x.status), [401, 401]);
  assert.equal(session.token(), undefined);
});
