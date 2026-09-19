'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { makeTempDataFile, startServer } = require('./helpers');

test('状态可以从 TODO 更新为 DOING', async (t) => {
  const dataFile = makeTempDataFile(t, {
    members: [{ id: 1, name: '成员A', role: '开发' }],
    tasks: [{ id: 1, title: '任务A', description: '', assigneeId: 1, status: 'TODO' }],
  });
  const { baseUrl } = await startServer(t, dataFile);

  const response = await fetch(`${baseUrl}/api/tasks/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DOING' }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'DOING');
});

test('状态可以从 DOING 更新为 DONE 且刷新后仍保留', async (t) => {
  const dataFile = makeTempDataFile(t, {
    members: [{ id: 1, name: '成员A', role: '开发' }],
    tasks: [{ id: 1, title: '任务A', description: '', assigneeId: 1, status: 'DOING' }],
  });
  const { baseUrl, close } = await startServer(t, dataFile);

  const response = await fetch(`${baseUrl}/api/tasks/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DONE' }),
  });
  assert.equal(response.status, 200);
  close();

  const second = await startServer(t, dataFile);
  const tasks = await (await fetch(`${second.baseUrl}/api/tasks`)).json();
  assert.equal(tasks[0].status, 'DONE');
});

test('非法状态返回 400 且不修改任务', async (t) => {
  const dataFile = makeTempDataFile(t, {
    members: [{ id: 1, name: '成员A', role: '开发' }],
    tasks: [{ id: 1, title: '任务A', description: '', assigneeId: 1, status: 'TODO' }],
  });
  const { baseUrl } = await startServer(t, dataFile);

  const response = await fetch(`${baseUrl}/api/tasks/1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'INVALID' }),
  });
  assert.equal(response.status, 400);
  const tasks = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(tasks[0].status, 'TODO');
});

test('不存在的任务返回 404', async (t) => {
  const dataFile = makeTempDataFile(t, { members: [], tasks: [] });
  const { baseUrl } = await startServer(t, dataFile);

  const response = await fetch(`${baseUrl}/api/tasks/999/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DONE' }),
  });
  assert.equal(response.status, 404);
});
