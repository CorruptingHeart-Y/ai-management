'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeTempDataFile, startServer } = require('./helpers');

/**
 * US06 任务优先级与截止时间 的核心测试。
 * 覆盖默认优先级、自定义优先级、非法优先级、合法/非法截止时间、持久化六类场景。
 */

function postTask(baseUrl, body) {
  return fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('不传优先级时默认创建为 MEDIUM，且截止时间为空', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await postTask(baseUrl, { title: '任务A', assigneeId: 1 });
  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.priority, 'MEDIUM');
  assert.equal(task.dueDate, null);
});

test('自定义优先级 HIGH 能正确落库', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await postTask(baseUrl, { title: '任务B', assigneeId: 1, priority: 'HIGH' });
  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.priority, 'HIGH');
});

test('非法优先级返回 400 且不落库', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await postTask(baseUrl, { title: '任务C', assigneeId: 1, priority: 'URGENT' });
  assert.equal(res.status, 400);

  const tasks = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(tasks.length, 0);
});

test('合法截止时间能正确落库', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await postTask(baseUrl, { title: '任务D', assigneeId: 1, dueDate: '2026-10-20' });
  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.dueDate, '2026-10-20');
});

test('非法截止时间返回 400 且不落库', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  for (const dueDate of ['2026-02-31', 'not-a-date', '2026/10/20']) {
    const res = await postTask(baseUrl, { title: '任务E', assigneeId: 1, dueDate });
    assert.equal(res.status, 400, `dueDate=${dueDate} 应返回 400`);
  }

  const tasks = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(tasks.length, 0);
});

test('优先级与截止时间在持久化后仍保留', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl, close } = await startServer(t, dataFile);

  await postTask(baseUrl, { title: '任务F', assigneeId: 1, priority: 'LOW', dueDate: '2026-12-31' });
  close();

  const second = await startServer(t, dataFile);
  const tasks = await (await fetch(`${second.baseUrl}/api/tasks`)).json();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].priority, 'LOW');
  assert.equal(tasks[0].dueDate, '2026-12-31');
});
