'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const createSession = require('../public/session');
function setup(fetchImpl = async () => Response.json({ ok: true })) {
  const storage = new Map(); const events = {};
  const env = { location: { href: 'http://localhost/index.html', origin: 'http://localhost' },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: fetchImpl, addEventListener: (name, callback) => { events[name] = callback; } };
  return { session: createSession(env), storage, events };
}
const admin = { id: 1, username: 'admin', role: 'admin' };
test('US03前端会话：统一Bearer请求，只有当前管理员显示写操作', async () => {
  let header;
  const { session } = setup(async (url, options) => { header = options.headers.get('Authorization'); return Response.json({ ok: true }); });
  assert.equal(session.canWrite(), false);
  session.setSession('opaque-token', admin);
  await session.fetch('/api/tasks');
  assert.equal(header, 'Bearer opaque-token'); assert.equal(session.canWrite(), true);
  session.setSession('other-token', { ...admin, role: 'member' }); assert.equal(session.canWrite(), false);
});
test('US03前端会话：401清除会话，403保留会话且不假装登出', async () => {
  let status = 403;
  const { session } = setup(async () => Response.json({ error: 'denied' }, { status }));
  session.setSession('token', admin);
  assert.equal((await session.fetch('/api/users')).status, 403); assert.equal(session.token(), 'token');
  status = 401;
  const response = await session.fetch('/api/users');
  assert.equal(response.status, 401); assert.equal(session.token(), null); assert.equal(session.user(), null);
  assert.deepEqual(await response.json(), { error: 'denied' });
});
test('US03前端会话：不向外站或非API请求发送凭证', async () => {
  let called = false;
  const { session } = setup(async () => { called = true; return Response.json({}); });
  session.setSession('token', admin);
  await assert.rejects(session.fetch('https://other.example/api/tasks'), /同源API/);
  await assert.rejects(session.fetch('/index.html'), /同源API/);
  assert.equal(called, false);
});
test('US03前端会话：旧账号延迟401不得清除新账号会话', async () => {
  let finish;
  const { session } = setup(() => new Promise(resolve => { finish = resolve; }));
  session.setSession('old', admin);
  const pending = session.fetch('/api/tasks');
  session.setSession('new', { id: 3, username: 'new', role: 'member' });
  finish(Response.json({ error: 'old token' }, { status: 401 }));
  await assert.rejects(pending, /登录状态已变化/); assert.equal(session.token(), 'new');
});
test('US03前端会话：解析期间换账号也拒绝旧数据，跨标签事件清空权限缓存', async () => {
  let finish;
  const response = Response.json({});
  response.json = () => new Promise(resolve => { finish = resolve; });
  const { session, storage, events } = setup(async () => response);
  session.setSession('old', admin);
  const body = (await session.fetch('/api/tasks')).json();
  session.setSession('new', { ...admin, role: 'member' }); finish({ private: 'old data' });
  await assert.rejects(body, /登录状态已变化/);
  storage.set('ai-mgmt-token', 'other-tab-token'); events.storage({ key: 'ai-mgmt-token' });
  assert.equal(session.user(), null); assert.equal(session.canWrite(), false);
});
test('US03前端会话：网络失败不伪装会话失效', async () => {
  const { session } = setup(async () => { throw new Error('network down'); });
  session.setSession('token', admin);
  await assert.rejects(session.fetch('/api/tasks'), /network down/);
  assert.equal(session.token(), 'token');
});
