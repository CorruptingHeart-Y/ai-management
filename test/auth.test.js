'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { makeTempDataFile, startServer } = require('./helpers');

// 教学演示账号（明文密码仅用于测试与演示，见计划会纪要表 2；代码与 db.json 只存哈希）
const CREDENTIALS = { admin: 'admin123', pengjiacheng: 'member123' };

function post(baseUrl, route, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

test('US02 登录成功：正确凭证返回 200、token 与角色', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await post(baseUrl, '/api/auth/login', { username: 'admin', password: CREDENTIALS.admin });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.token, 'string');
  assert.ok(body.token.length >= 64);
  assert.equal(body.username, 'admin');
  assert.equal(body.role, 'admin');
});

test('US02 登录失败：错误密码返回 401 且不签发 token', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await post(baseUrl, '/api/auth/login', { username: 'admin', password: 'wrong-password' });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: '用户名或密码错误' });
});

test('US02 缺字段：空用户名或空密码返回 400', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  for (const body of [
    { username: '', password: 'x' },
    { username: '   ', password: 'x' },
    { username: 'admin', password: '' },
    {},
  ]) {
    const res = await post(baseUrl, '/api/auth/login', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('US02 会话：登录后 /me 返回当前用户，登出后失效', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const login = await post(baseUrl, '/api/auth/login', {
    username: 'pengjiacheng', password: CREDENTIALS.pengjiacheng,
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.username, 'pengjiacheng');
  assert.equal(meBody.role, 'member');
  assert.ok(!('passwordHash' in meBody), '不得泄露密码哈希');

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(logout.status, 200);

  const after = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(after.status, 401);
});

test('US02 无效 token：/me 与 /logout 返回 401', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: 'Bearer not-a-real-token' } });
  assert.equal(me.status, 401);
  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST', headers: { Authorization: 'Bearer not-a-real-token' },
  });
  assert.equal(logout.status, 401);
});

test('US02 惰性写入：登录后 users 落库且不含明文密码', async (t) => {
  const dataFile = makeTempDataFile(t, { members: [], tasks: [] });
  const { baseUrl } = await startServer(t, dataFile);

  const before = fs.readFileSync(dataFile, 'utf8');
  assert.ok(!before.includes('users'), '登录前默认结构不应含 users');

  const res = await post(baseUrl, '/api/auth/login', { username: 'admin', password: CREDENTIALS.admin });
  assert.equal(res.status, 200);

  const after = fs.readFileSync(dataFile, 'utf8');
  assert.ok(after.includes('users'), '登录后应惰性写入 users');
  assert.ok(!after.includes('admin123') && !after.includes('member123'), '不得写入明文密码');
});

test('US02 不破坏基线：登录前后既有 members/tasks 路由均免登录可访问', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const members = await fetch(`${baseUrl}/api/members`);
  assert.equal(members.status, 200);
  const tasks = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(tasks.status, 200);

  await post(baseUrl, '/api/auth/login', { username: 'admin', password: CREDENTIALS.admin });

  assert.equal((await fetch(`${baseUrl}/api/members`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/tasks`)).status, 200);
});
