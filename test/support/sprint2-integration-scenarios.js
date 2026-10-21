'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { makeTempDataFile, startServer } = require('../helpers');

function fixture(t) {
  return makeTempDataFile(t, {
    members: [{ id: 1, name: '跨故事QA', role: '回归测试' }], tasks: [],
    iterations: [{ id: 2, name: 'Sprint 2' }, { id: 3, name: 'Sprint 3' }],
  });
}
function send(baseUrl, route, body, method = 'POST') {
  return fetch(`${baseUrl}/api/${route}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
async function json(baseUrl, route) {
  const response = await fetch(`${baseUrl}/api/${route}`);
  assert.equal(response.status, 200, route);
  return response.json();
}
const create = (extra = {}) => ({ title: '跨故事任务', assigneeId: 1, ...extra });

async function attributeBoundaries(t) {
  const file = fixture(t);
  const { baseUrl } = await startServer(t, file);
  const legacy = await send(baseUrl, 'tasks', create());
  assert.equal(legacy.status, 201);
  const old = await legacy.json();
  assert.equal(old.priority, 'MEDIUM');
  assert.equal(old.dueDate, null);
  assert.equal(old.iterationId, null);
  // 枚举/真实闰日/两个迭代与未分配的组合，不重复原故事单字段测试。
  for (const [priority, dueDate, iterationId] of [
    ['HIGH', '2028-02-29', 2], ['LOW', '2026-12-31', 3], ['MEDIUM', null, null],
  ]) {
    const response = await send(baseUrl, 'tasks', create({ priority, dueDate, iterationId }));
    assert.equal(response.status, 201);
    const task = await response.json();
    assert.equal(task.priority, priority);
    assert.equal(task.dueDate, dueDate);
    assert.equal(task.iterationId, iterationId);
    assert.equal(task.assigneeId, 1);
  }
  const before = fs.readFileSync(file, 'utf8');
  const statsBefore = await json(baseUrl, 'stats');
  for (const fields of [
    { priority: 'URGENT', dueDate: '2028-02-29', iterationId: 2 },
    { priority: 'HIGH', dueDate: '2026-02-29', iterationId: 2 },
    { priority: 'HIGH', dueDate: '2026-12-31', iterationId: 999 },
    { priority: 'LOW', dueDate: '2026-12-31', iterationId: '2' },
    { priority: 'MEDIUM', dueDate: '2026-12-31', iterationId: '' },
  ]) {
    const response = await send(baseUrl, 'tasks', create(fields));
    assert.equal(response.status, 400, JSON.stringify(fields));
    assert.ok(typeof (await response.json()).error === 'string');
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.deepEqual(await json(baseUrl, 'stats'), statsBefore);
  }
}

async function stateStatistics(t) {
  const file = fixture(t);
  const { baseUrl } = await startServer(t, file);
  const ids = [];
  for (const fields of [
    { priority: 'HIGH', dueDate: '2028-02-29', iterationId: 2 },
    { priority: 'LOW', dueDate: null, iterationId: 3 }, {},
  ]) {
    const response = await send(baseUrl, 'tasks', create(fields));
    assert.equal(response.status, 201);
    ids.push((await response.json()).id);
  }
  const initial = await json(baseUrl, 'stats');
  async function verify() {
    const tasks = await json(baseUrl, 'tasks');
    const stats = await json(baseUrl, 'stats');
    assert.equal(stats.total, tasks.length);
    for (const status of ['TODO', 'DOING', 'DONE']) {
      assert.equal(stats.byStatus[status], tasks.filter(task => task.status === status).length);
    }
    for (const priority of ['HIGH', 'MEDIUM', 'LOW']) {
      assert.equal(stats.byPriority[priority], tasks.filter(task => task.priority === priority).length);
    }
    for (const group of stats.byIteration) {
      assert.equal(group.count, tasks.filter(task => task.iterationId === group.iterationId).length);
    }
    assert.deepEqual(stats.byPriority, initial.byPriority);
    assert.deepEqual(stats.byIteration, initial.byIteration);
    assert.deepEqual(stats.byAssignee, initial.byAssignee);
    assert.equal(Object.values(stats.byStatus).reduce((a, b) => a + b, 0), stats.total);
  }
  await verify();
  for (const status of ['DOING', 'DONE']) {
    const response = await send(baseUrl, `tasks/${ids[0]}/status`, { status }, 'PATCH');
    assert.equal(response.status, 200);
    await verify();
  }
}

async function persistence(t) {
  const file = fixture(t);
  const first = await startServer(t, file);
  const iterations = await json(first.baseUrl, 'iterations');
  const members = await json(first.baseUrl, 'members');
  const response = await send(first.baseUrl, 'tasks', create({
    description: '保留全部字段', priority: 'HIGH', dueDate: '2028-02-29', iterationId: 2,
  }));
  assert.equal(response.status, 201);
  const created = await response.json();
  const updated = await send(first.baseUrl, `tasks/${created.id}/status`, { status: 'DONE' }, 'PATCH');
  assert.equal(updated.status, 200);
  const expected = { ...created, status: 'DONE' };
  assert.deepEqual(await updated.json(), expected);
  first.close();
  const second = await startServer(t, file);
  assert.deepEqual(await json(second.baseUrl, 'tasks'), [expected]);
  assert.deepEqual(await json(second.baseUrl, 'iterations'), iterations);
  assert.deepEqual(await json(second.baseUrl, 'members'), members);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { members, tasks: [expected], iterations });
  const stats = await json(second.baseUrl, 'stats');
  assert.deepEqual(stats.byStatus, { TODO: 0, DOING: 0, DONE: 1 });
  assert.equal(stats.byIteration.find(group => group.iterationId === 2).name, 'Sprint 2');
  assert.equal(stats.byIteration.find(group => group.iterationId === 2).count, 1);
}

module.exports = { attributeBoundaries, stateStatistics, persistence };
