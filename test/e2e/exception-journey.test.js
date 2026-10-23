'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { login, requestWithSession: request, seedData, makeTempDataFile, startServer, jsonOptions, DEMO_MEMBER } = require('./helpers');

test('E2E production permission journey: strict 401/403/400/404/500 and no corruption', async t => {
  const file = makeTempDataFile(t, seedData([{ id: 1, title: 'existing', status: 'TODO', assigneeId: 1 }]));
  const { baseUrl: base } = await startServer(t, file);
  const before = fs.readFileSync(file, 'utf8');
  for (const route of ['/api/tasks', '/api/task-query', '/api/stats', '/api/users', '/api/not-exist']) {
    assert.equal((await request(base, route)).status, 401, route);
    assert.equal((await request(base, route, {}, 'forged')).status, 401, route);
  }
  const wrong = await request(base, '/api/auth/login', jsonOptions('POST', { username: 'admin', password: 'definitely-wrong' }));
  assert.equal(wrong.status, 401); assert.equal(wrong.body.token, undefined);
  assert.equal((await request(base, '/api/auth/login', jsonOptions('POST', {}))).status, 400);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const admin = (await login(base)).token;
  const member = (await login(base, DEMO_MEMBER)).token;
  for (const route of ['/api/tasks', '/api/task-query', '/api/stats']) assert.equal((await request(base, route, {}, member)).status, 200);
  assert.equal((await request(base, '/api/users', {}, member)).status, 403);
  for (const [route, method, body] of [
    ['/api/tasks', 'POST', { title: 'denied', assigneeId: 1, role: 'admin' }],
    ['/api/users/2/role', 'PATCH', { role: 'admin' }],
  ]) {
    const options = jsonOptions(method, body); options.headers['X-Role'] = 'admin';
    assert.equal((await request(base, route, options, member)).status, 403);
  }
  for (const body of [{ title: ' ', assigneeId: 1 }, { title: 'bad', assigneeId: 999 },
    { title: 'bad', assigneeId: 1, priority: 'URGENT' }, { title: 'bad', assigneeId: 1, dueDate: '2026-02-30' },
    { title: 'bad', assigneeId: 1, iterationId: 999 }]) {
    const response = await request(base, '/api/tasks', jsonOptions('POST', body), admin);
    assert.equal(response.status, 400); assert.equal(typeof response.body.error, 'string');
  }
  assert.equal((await request(base, '/api/task-query?priority=INVALID', {}, member)).status, 400);
  assert.equal((await request(base, '/api/tasks/999/status', jsonOptions('PATCH', { status: 'DONE' }), member)).status, 404);
  assert.equal((await request(base, '/api/not-exist', {}, admin)).status, 404);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const changed = await request(base, '/api/tasks/1/status', jsonOptions('PATCH', { status: 'DOING' }), member);
  assert.equal(changed.status, 200); assert.equal(changed.body.status, 'DOING');
  assert.equal((await request(base, '/api/users/2/role', jsonOptions('PATCH', { role: 'admin' }), admin)).status, 200);
  assert.equal((await request(base, '/api/task-query', {}, member)).status, 401);
  for (const raw of ['{"tasks": BROKEN', JSON.stringify({ ...seedData(), tasks: { sentinel: 'retain' } })]) {
    fs.writeFileSync(file, raw);
    for (const [route, options] of [['/api/tasks', {}], ['/api/task-query', {}],
      ['/api/tasks', jsonOptions('POST', { title: 'must not overwrite', assigneeId: 1 })]]) {
      const response = await request(base, route, options, admin);
      assert.equal(response.status, 500); assert.equal(typeof response.body.error, 'string');
      assert.equal(fs.readFileSync(file, 'utf8'), raw);
    }
  }
});
