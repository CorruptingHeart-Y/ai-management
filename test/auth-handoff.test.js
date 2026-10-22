'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { makeTempDataFile, startServer } = require('./helpers');

// 仅测试使用的教学演示凭证；生产源码和持久数据不得保存明文。
const admin = { username: 'admin', password: 'admin123' };
function post(baseUrl, route, body, token) {
  return fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
function me(baseUrl, token) {
  return fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
}
async function login(baseUrl, credentials = admin) {
  const response = await post(baseUrl, '/api/auth/login', credentials);
  assert.equal(response.status, 200);
  return response.json();
}

test('US02交接：四个预置账号角色准确，响应不泄露哈希，登出仅撤销当前会话', async (t) => {
  const { baseUrl } = await startServer(t, makeTempDataFile(t));
  const sessions = [];
  for (const username of ['admin', 'pengjiacheng', 'yanghaowei', 'hejianxiang']) {
    const role = username === 'admin' ? 'admin' : 'member';
    const session = await login(baseUrl, { username, password: role === 'admin' ? admin.password : 'member123' });
    assert.deepEqual(Object.keys(session).sort(), ['id', 'role', 'token', 'username']);
    assert.equal(session.username, username);
    assert.equal(session.role, role);
    const response = await me(baseUrl, session.token);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: session.id, username, role });
    sessions.push(session);
  }
  assert.equal(new Set(sessions.map(s => s.token)).size, sessions.length);
  assert.equal((await post(baseUrl, '/api/auth/logout', {}, sessions[0].token)).status, 200);
  assert.equal((await me(baseUrl, sessions[0].token)).status, 401);
  for (const session of sessions.slice(1)) assert.equal((await me(baseUrl, session.token)).status, 200);
});

test('US02交接：应用重启使旧token失效，账号哈希保留且可重新登录', async (t) => {
  const file = makeTempDataFile(t);
  const first = await startServer(t, file);
  const old = await login(first.baseUrl);
  const before = fs.readFileSync(file, 'utf8');
  first.close();
  const second = await startServer(t, file);
  assert.equal((await me(second.baseUrl, old.token)).status, 401);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const fresh = await login(second.baseUrl);
  assert.notEqual(fresh.token, old.token);
  assert.equal((await me(second.baseUrl, fresh.token)).status, 200);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('US02交接：登录后创建与更新任务不丢users/iterations，四条业务读取路由仍免登录', async (t) => {
  const file = makeTempDataFile(t, {
    members: [{ id: 1, name: '交接验证', role: 'QA' }], tasks: [], iterations: [{ id: 9, name: '交接迭代' }],
  });
  const { baseUrl } = await startServer(t, file);
  const session = await login(baseUrl);
  const initial = JSON.parse(fs.readFileSync(file, 'utf8'));
  const created = await post(baseUrl, '/api/tasks', { title: '会话持久化联调', assigneeId: 1, iterationId: 9 });
  assert.equal(created.status, 201);
  const task = await created.json();
  const updated = await fetch(`${baseUrl}/api/tasks/${task.id}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'DONE' }),
  });
  assert.equal(updated.status, 200);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(after.users, initial.users);
  assert.deepEqual(after.iterations, initial.iterations);
  assert.deepEqual(after.members, initial.members);
  assert.equal(after.tasks[0].status, 'DONE');
  assert.equal(after.tasks[0].iterationId, 9);
  assert.equal((await me(baseUrl, session.token)).status, 200);
  for (const route of ['members', 'tasks', 'stats', 'iterations']) {
    assert.equal((await fetch(`${baseUrl}/api/${route}`)).status, 200, route);
  }
});

test('US02异常：损坏JSON使登录/会话读取返回JSON错误，原文件逐字保留', async (t) => {
  const file = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, file);
  const session = await login(baseUrl);
  const broken = '{"users": BROKEN';
  fs.writeFileSync(file, broken);
  const failed = await post(baseUrl, '/api/auth/login', admin);
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: '登录暂时无法处理，请稍后重试' });
  const current = await me(baseUrl, session.token);
  assert.equal(current.status, 500);
  assert.deepEqual(await current.json(), { error: '会话暂时无法读取，请稍后重试' });
  assert.equal(fs.readFileSync(file, 'utf8'), broken);
});

test('US02异常：首次账号写入前EIO时不签发token、不改变文件，恢复后可登录', async (t) => {
  const file = makeTempDataFile(t, { members: [], tasks: [] });
  const before = fs.readFileSync(file, 'utf8');
  const { baseUrl } = await startServer(t, file);
  const write = fs.writeFileSync;
  const mock = t.mock.method(fs, 'writeFileSync', function (target, ...args) {
    if (target === file) throw Object.assign(new Error('injected auth write-before EIO'), { code: 'EIO' });
    return write.call(this, target, ...args);
  });
  const response = await post(baseUrl, '/api/auth/login', admin);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: '登录暂时无法处理，请稍后重试' });
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  mock.mock.restore();
  const session = await login(baseUrl);
  assert.equal((await me(baseUrl, session.token)).status, 200);
});
