'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { login, requestWithSession: request, seedData, makeTempDataFile, startServer, jsonOptions } = require('./helpers');

test('E2E production main journey: login/create/filter/overdue/status/stats/logout/restart', async t => {
  const file = makeTempDataFile(t, seedData());
  const { baseUrl: base, close } = await startServer(t, file);
  const before = fs.readFileSync(file, 'utf8');
  assert.equal((await request(base, '/api/tasks')).status, 401);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const { token, user } = await login(base);
  assert.equal(user.role, 'admin');
  assert.equal((await request(base, '/api/auth/me', {}, token)).body.username, user.username);
  // Extremely distant dates avoid midnight/timezone flakiness; exact day boundaries
  // are separately covered by the fixed-clock composition and filter tests.
  const one = await request(base, '/api/tasks', jsonOptions('POST', {
    title: 'E2E overdue', assigneeId: 2, priority: 'HIGH', dueDate: '2000-01-01', iterationId: 2,
  }), token);
  const two = await request(base, '/api/tasks', jsonOptions('POST', {
    title: 'E2E future', assigneeId: 1, priority: 'LOW', dueDate: '9999-12-31', iterationId: 3,
  }), token);
  assert.equal(one.status, 201); assert.equal(two.status, 201);
  const query = '/api/task-query?status=TODO&priority=HIGH&iterationId=2&assigneeId=2&q=overdue';
  const filtered = await request(base, query, {}, token);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.total, 2); assert.equal(filtered.body.matched, 1);
  assert.deepEqual(filtered.body.tasks.map(x => x.id), [one.body.id]);
  const overdue = await request(base, '/api/task-query?overdue=true', {}, token);
  assert.equal(overdue.status, 200);
  assert.deepEqual(overdue.body.tasks.map(x => x.id), [one.body.id]);
  for (const status of ['DOING', 'DONE']) {
    const changed = await request(base, `/api/tasks/${one.body.id}/status`, jsonOptions('PATCH', { status }), token);
    assert.equal(changed.status, 200); assert.equal(changed.body.status, status);
    const list = await request(base, '/api/tasks', {}, token);
    const stats = await request(base, '/api/stats', {}, token);
    assert.equal(list.status, 200); assert.equal(stats.status, 200);
    assert.equal(stats.body.total, list.body.length);
    for (const state of ['TODO', 'DOING', 'DONE']) assert.equal(stats.body.byStatus[state], list.body.filter(x => x.status === state).length);
  }
  const afterDone = await request(base, '/api/task-query?overdue=true', {}, token);
  assert.equal(afterDone.status, 200); assert.equal(afterDone.body.matched, 0);
  const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal((await request(base, '/api/auth/logout', jsonOptions('POST', {}), token)).status, 200);
  assert.equal((await request(base, '/api/tasks', {}, token)).status, 401);
  const restartToken = (await login(base)).token;
  await close();
  const second = await startServer(t, file);
  assert.equal((await request(second.baseUrl, '/api/tasks', {}, restartToken)).status, 401);
  const renewed = (await login(second.baseUrl)).token;
  const restored = await request(second.baseUrl, '/api/tasks', {}, renewed);
  assert.equal(restored.status, 200);
  assert.deepEqual(restored.body, persisted.tasks);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), persisted);
  const saved = restored.body.find(x => x.id === one.body.id);
  assert.equal(saved.status, 'DONE'); assert.equal(saved.assigneeId, 2);
  assert.equal(saved.priority, 'HIGH'); assert.equal(saved.dueDate, '2000-01-01'); assert.equal(saved.iterationId, 2);
});
