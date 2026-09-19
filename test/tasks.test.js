'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeTempDataFile, startServer } = require('./helpers');
const { createApp } = require('../src/app');

/**
 * US04 创建并分配任务 的核心测试。
 * 覆盖实验二要求.txt 第 8 条要求的五类场景。
 */

function postTask(baseUrl, body) {
  return fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('正常创建任务：返回 201，status 初始为 TODO，assigneeId 正确', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await postTask(baseUrl, {
    title: '实现登录页',
    description: '完成用户名密码表单',
    assigneeId: 2,
  });

  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.title, '实现登录页');
  assert.equal(task.description, '完成用户名密码表单');
  assert.equal(task.assigneeId, 2);
  assert.equal(task.status, 'TODO');
  assert.ok(task.id > 0);
});

test('空标题（含纯空白）创建失败，返回 400，且不落库', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  for (const title of ['', '   ']) {
    const res = await postTask(baseUrl, { title, assigneeId: 1 });
    assert.equal(res.status, 400);
  }

  const tasks = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(tasks.length, 0);
});

test('无效负责人创建失败，返回 400，且不落库', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await postTask(baseUrl, { title: '任务A', assigneeId: 999 });
  assert.equal(res.status, 400);

  const tasks = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(tasks.length, 0);
});

test('创建以后能够读取：任务列表包含新任务', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  await postTask(baseUrl, { title: '任务B', assigneeId: 3 });

  const tasks = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, '任务B');
  assert.equal(tasks[0].assigneeId, 3);
});

test('持久化：用同一数据文件重新创建 app 后任务仍存在', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl, close } = await startServer(t, dataFile);

  await postTask(baseUrl, { title: '任务C', assigneeId: 1 });
  close();

  // 等价于“刷新页面”：用同一份 dataFile 重新启动应用
  const second = await new Promise((resolve) => {
    const app = createApp({ dataFile });
    const server = app.listen(0, () => {
      const { port } = server.address();
      t.after(() => server.close());
      resolve(`http://127.0.0.1:${port}`);
    });
  });

  const tasks = await (await fetch(`${second}/api/tasks`)).json();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, '任务C');
  assert.equal(tasks[0].status, 'TODO');
});
