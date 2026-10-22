'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { makeTempDataFile, startServer } = require('./helpers');

function request(baseUrl, route, method, body) {
  return fetch(`${baseUrl}${route}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('S2集成：旧创建请求经过完整状态链、重启后保留成员分配和所有任务', async (t) => {
  const file = makeTempDataFile(t);
  const first = await startServer(t, file);
  const members = await (await fetch(`${first.baseUrl}/api/members`)).json();
  const created = [];
  for (const member of members) {
    const response = await request(first.baseUrl, '/api/tasks', 'POST', {
      title: `legacy-${member.id}`, assigneeId: member.id,
    });
    assert.equal(response.status, 201);
    const task = await response.json();
    assert.equal(task.status, 'TODO');
    for (const status of ['DOING', 'DONE']) {
      const updated = await request(first.baseUrl, `/api/tasks/${task.id}/status`, 'PATCH', { status });
      assert.equal(updated.status, 200);
      Object.assign(task, await updated.json());
      assert.equal(task.status, status);
      assert.equal(task.assigneeId, member.id);
    }
    created.push(task);
  }
  first.close();
  const second = await startServer(t, file);
  assert.deepEqual(await (await fetch(`${second.baseUrl}/api/tasks`)).json(), created);
  assert.deepEqual(await (await fetch(`${second.baseUrl}/api/members`)).json(), members);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).tasks, created);
});

for (const [method, route, body] of [
  ['POST', '/api/tasks', { title: 'must not overwrite', assigneeId: 1 }],
  ['PATCH', '/api/tasks/1/status', { status: 'DONE' }],
]) {
  test(`S2异常：损坏JSON时${method}返回失败并逐字保留原文件`, async (t) => {
    const file = makeTempDataFile(t);
    const original = '{"tasks": BROKEN';
    fs.writeFileSync(file, original);
    const { baseUrl } = await startServer(t, file);
    assert.equal((await request(baseUrl, route, method, body)).status, 500);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  });
}

for (const method of ['POST', 'PATCH']) {
  test(`S2异常：${method}注入写入前EIO时不报成功、不改变原文件`, async (t) => {
    const file = makeTempDataFile(t, {
      members: [{ id: 1, name: '集成测试', role: 'QA' }],
      tasks: [{ id: 1, title: 'existing', assigneeId: 1, status: 'TODO' }],
    });
    const before = fs.readFileSync(file, 'utf8');
    const { baseUrl } = await startServer(t, file);
    const write = fs.writeFileSync;
    t.mock.method(fs, 'writeFileSync', function (target, ...args) {
      // Atomic storage writes a descriptor for its temporary sibling file.
      if (target === file || typeof target === 'number') throw Object.assign(new Error('injected write-before EIO'), { code: 'EIO' });
      return write.call(this, target, ...args);
    });
    const route = method === 'POST' ? '/api/tasks' : '/api/tasks/1/status';
    const body = method === 'POST' ? { title: 'new', assigneeId: 1 } : { status: 'DONE' };
    assert.equal((await request(baseUrl, route, method, body)).status, 500);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
  });
}

// Sprint 3补齐原三项无断言TODO；上方五项原有测试断言全文保持不变。
const scenarios = require('./support/sprint2-integration-scenarios');
test('S2补齐：优先级、截止时间、迭代ID边界组合与失败不落库', scenarios.attributeBoundaries);
test('S2补齐：含属性和迭代任务TODO→DOING→DONE与统计逐项一致', scenarios.stateStatistics);
test('S2补齐：新增字段、迭代集合经创建/状态更新/重启后完整保留', scenarios.persistence);
