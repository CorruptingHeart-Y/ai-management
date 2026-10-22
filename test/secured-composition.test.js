'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { start, request, login, data, makeTempDataFile } = require('./support/permission-helpers');
const { mountTaskFilters } = require('../src/features/task-filters');
const options = { mountReadFeatures(app, db, readAccess) {
  mountTaskFilters(app, db, readAccess, { clock: () => new Date(2026, 9, 22, 12) });
} };

test('secured composition: create/filter/status/stats/restart preserve assignment and iteration', async t => {
  const { base, file } = await start(t, undefined, options);
  const token = await login(base);
  const created = await request(base, '/tasks', token, 'POST', {
    title: 'cross module overdue', assigneeId: 1, priority: 'HIGH', dueDate: '2026-10-21', iterationId: 2,
  });
  assert.equal(created.status, 201);
  const task = await created.json();
  const route = '/task-query?priority=HIGH&iterationId=2&assigneeId=1&overdue=true';
  let result = await (await request(base, route, token)).json();
  assert.deepEqual(result.tasks.map(x => x.id), [task.id]);
  for (const status of ['DOING', 'DONE']) {
    assert.equal((await request(base, `/tasks/${task.id}/status`, token, 'PATCH', { status })).status, 200);
    const stats = await (await request(base, '/stats', token)).json();
    const tasks = await (await request(base, '/tasks', token)).json();
    assert.equal(stats.total, tasks.length);
    for (const value of ['TODO', 'DOING', 'DONE']) {
      assert.equal(stats.byStatus[value], tasks.filter(x => x.status === value).length);
    }
  }
  result = await (await request(base, route, token)).json();
  assert.equal(result.matched, 0);
  const restarted = await start(t, file, options);
  assert.equal((await request(restarted.base, '/tasks', token)).status, 401);
  const nextToken = await login(restarted.base);
  const saved = (await (await request(restarted.base, '/tasks', nextToken)).json()).find(x => x.id === task.id);
  assert.equal(saved.status, 'DONE');
  assert.equal(saved.assigneeId, 1);
  assert.equal(saved.iterationId, 2);
  assert.equal(saved.priority, 'HIGH');
  assert.equal(saved.dueDate, '2026-10-21');
});

test('secured composition: query enforces real sessions and role revocation; rejected requests do not write', async t => {
  const { base, file } = await start(t, undefined, options);
  const admin = await login(base);
  const member = await login(base, 'pengjiacheng');
  const before = fs.readFileSync(file, 'utf8');
  for (const token of [null, 'invented']) assert.equal((await request(base, '/task-query', token)).status, 401);
  assert.equal((await request(base, '/task-query', member)).status, 200);
  assert.equal((await request(base, '/tasks', member, 'POST', { title: 'forged admin', assigneeId: 1 }, { 'X-Role': 'admin' })).status, 403);
  assert.equal((await request(base, '/users', member)).status, 403);
  assert.equal((await request(base, '/task-query?priority=INVALID', admin)).status, 400);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal((await request(base, '/users/2/role', admin, 'PATCH', { role: 'admin' })).status, 200);
  assert.equal((await request(base, '/task-query', member)).status, 401);
  const renewed = await login(base, 'pengjiacheng');
  assert.equal((await request(base, '/task-query', renewed)).status, 200);
});

test('secured composition: overdue excludes today, future, undated, and DONE tasks', async t => {
  const seed = data();
  seed.tasks = [
    ['2026-10-21', 'TODO'], ['2026-10-21', 'DOING'], ['2026-10-21', 'DONE'],
    ['2026-10-22', 'TODO'], ['2026-10-23', 'TODO'], [null, 'TODO'],
  ].map(([dueDate, status], index) => ({ id: index + 1, title: `boundary ${index}`, assigneeId: 1, dueDate, status }));
  const { base } = await start(t, makeTempDataFile(t, seed), options);
  const token = await login(base);
  const response = await request(base, '/task-query?overdue=true', token);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).tasks.map(x => x.id), [1, 2]);
});
