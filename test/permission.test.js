'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { start, data, request, login, makeTempDataFile } = require('./support/permission-helpers');

test('US03真实入口：所有业务API对未登录/伪造token返回401且不写数据', async t => {
  const { file, base } = await start(t);
  const before = fs.readFileSync(file, 'utf8');
  for (const token of [null, 'forged-token']) for (const [route, method, body] of [
    ['/members', 'GET'], ['/tasks', 'GET'], ['/stats', 'GET'], ['/iterations', 'GET'],
    ['/users', 'GET'], ['/task-query', 'GET'], ['/unknown', 'GET'],
    ['/tasks', 'POST', { title: '拒绝', assigneeId: 1 }],
    ['/tasks/1/status', 'PATCH', { status: 'DONE' }], ['/users/2/role', 'PATCH', { role: 'admin' }],
  ]) {
    const response = await request(base, route, token, method, body);
    assert.equal(response.status, 401, route);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(typeof (await response.json()).error, 'string');
  }
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('US03成员：允许读取与US05状态更新，拒绝创建和角色管理，包括伪造role头', async t => {
  const { file, base } = await start(t);
  const token = await login(base, 'yanghaowei');
  const before = fs.readFileSync(file, 'utf8');
  for (const route of ['/members', '/tasks', '/stats', '/iterations']) assert.equal((await request(base, route, token)).status, 200);
  for (const [route, method, body] of [
    ['/users', 'GET'], ['/tasks', 'POST', { title: '拒绝', assigneeId: 1, role: 'admin' }],
    ['/users/3/role', 'PATCH', { role: 'admin' }],
  ]) {
    assert.equal((await request(base, route, token, method, body, { 'X-Role': 'admin' })).status, 403);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const changed = await request(base, '/tasks/1/status', token, 'PATCH', { status: 'DOING' });
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).status, 'DOING');
});

test('US03管理员：创建任务/改状态成功，账号列表只返回公开字段', async t => {
  const { base } = await start(t);
  const token = await login(base);
  const created = await request(base, '/tasks', token, 'POST', { title: '管理任务', assigneeId: 1, priority: 'HIGH', iterationId: 2 });
  assert.equal(created.status, 201);
  const task = await created.json();
  assert.equal((await request(base, `/tasks/${task.id}/status`, token, 'PATCH', { status: 'DONE' })).status, 200);
  const response = await request(base, '/users', token);
  assert.equal(response.status, 200);
  for (const user of await response.json()) assert.deepEqual(Object.keys(user).sort(), ['id', 'role', 'username']);
});

test('US03角色校验：非法角色/编号/额外字段400，未知账号404，失败逐字不落库', async t => {
  const { file, base } = await start(t);
  const token = await login(base);
  const before = fs.readFileSync(file, 'utf8');
  for (const [id, body, status] of [
    ['2', { role: 'root' }, 400], ['2', {}, 400], ['2', { role: 'admin', id: 1 }, 400],
    ['0', { role: 'admin' }, 400], ['02', { role: 'admin' }, 400],
    ['9007199254740992', { role: 'admin' }, 400], ['999', { role: 'admin' }, 404],
  ]) assert.equal((await request(base, `/users/${id}/role`, token, 'PATCH', body)).status, status);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('US03最后管理员保护与幂等更新：409不落库，同角色不撤销会话', async t => {
  const { file, base } = await start(t);
  const token = await login(base);
  const before = fs.readFileSync(file, 'utf8');
  assert.equal((await request(base, '/users/1/role', token, 'PATCH', { role: 'member' })).status, 409);
  const noop = await request(base, '/users/1/role', token, 'PATCH', { role: 'admin' });
  assert.equal(noop.status, 200); assert.equal((await noop.json()).sessionsRevoked, false);
  assert.equal((await request(base, '/users', token)).status, 200);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('US03升降级：撤销目标账号所有旧token，其他会话不受影响，重登采用新角色', async t => {
  const { base } = await start(t);
  const admin = await login(base), one = await login(base, 'pengjiacheng'), two = await login(base, 'pengjiacheng');
  const other = await login(base, 'hejianxiang');
  assert.equal((await request(base, '/users/2/role', admin, 'PATCH', { role: 'admin' })).status, 200);
  for (const token of [one, two]) assert.equal((await request(base, '/tasks', token)).status, 401);
  assert.equal((await request(base, '/tasks', other)).status, 200);
  const promoted = await login(base, 'pengjiacheng');
  assert.equal((await request(base, '/users', promoted)).status, 200);
  assert.equal((await request(base, '/users/2/role', admin, 'PATCH', { role: 'member' })).status, 200);
  assert.equal((await request(base, '/users', promoted)).status, 401);
  const downgraded = await login(base, 'pengjiacheng');
  assert.equal((await request(base, '/users', downgraded)).status, 403);
});

test('US03自降级：存在其他管理员才允许，成功后自己的会话立即失效', async t => {
  const { base } = await start(t); const token = await login(base);
  await request(base, '/users/2/role', token, 'PATCH', { role: 'admin' });
  assert.equal((await request(base, '/users/1/role', token, 'PATCH', { role: 'member' })).status, 200);
  assert.equal((await request(base, '/tasks', token)).status, 401);
  assert.equal((await request(base, '/users', await login(base))).status, 403);
});

test('US03角色持久化：保留原任务/成员/迭代/未知扩展，重启后旧会话失效且新角色保留', async t => {
  const first = await start(t); const token = await login(first.base);
  const before = JSON.parse(fs.readFileSync(first.file, 'utf8'));
  assert.equal((await request(first.base, '/users/2/role', token, 'PATCH', { role: 'admin' })).status, 200);
  const after = JSON.parse(fs.readFileSync(first.file, 'utf8'));
  for (const field of ['members', 'tasks', 'iterations', 'extension']) assert.deepEqual(after[field], before[field]);
  for (let i = 0; i < after.users.length; i++) assert.deepEqual(after.users[i], { ...before.users[i], role: i === 1 ? 'admin' : before.users[i].role });
  first.close(); const second = await start(t, first.file);
  assert.equal((await request(second.base, '/tasks', token)).status, 401);
  assert.equal((await request(second.base, '/users', await login(second.base, 'pengjiacheng'))).status, 200);
});

test('US03异常：损坏JSON或非法账号角色返回500，不把异常数据当管理员', async t => {
  const { file, base } = await start(t); const token = await login(base);
  for (const malformed of ['{"users": BROKEN', JSON.stringify({ ...data(), users: [{ ...data().users[0], role: 'root' }] })]) {
    fs.writeFileSync(file, malformed);
    const response = await request(base, '/tasks', token);
    assert.equal(response.status, 500); assert.equal(typeof (await response.json()).error, 'string');
    assert.equal(fs.readFileSync(file, 'utf8'), malformed);
  }
});

test('US03异常：角色更新拒绝畸形tasks集合，不静默覆盖异常原文件', async t => {
  const { file, base } = await start(t); const token = await login(base);
  const raw = JSON.stringify({ ...data(), tasks: { opaque: 'must retain' } });
  fs.writeFileSync(file, raw);
  assert.equal((await request(base, '/users/2/role', token, 'PATCH', { role: 'admin' })).status, 500);
  assert.equal(fs.readFileSync(file, 'utf8'), raw);
});

test('US03异常：原子替换前EIO不改原文、不撤会话，并清除临时文件', async t => {
  const { file, base } = await start(t); const token = await login(base); const member = await login(base, 'pengjiacheng');
  const before = fs.readFileSync(file, 'utf8');
  const rename = fs.renameSync;
  const mocked = t.mock.method(fs, 'renameSync', function (from, to) {
    if (to === file) throw Object.assign(new Error('injected role rename EIO'), { code: 'EIO' });
    return rename.call(this, from, to);
  });
  assert.equal((await request(base, '/users/2/role', token, 'PATCH', { role: 'admin' })).status, 500);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['db.json']);
  assert.equal((await request(base, '/tasks', member)).status, 200);
  mocked.mock.restore();
});

test('US03扩展挂载：后注册查询路由也受同一会话与读策略保护', async t => {
  const { base } = await start(t, undefined, { mountReadFeatures(app, db, readAccess) {
    app.get('/api/task-query', readAccess, (req, res) => res.json({ count: db.readData().tasks.length }));
  } });
  assert.equal((await request(base, '/task-query')).status, 401);
  for (const username of ['admin', 'yanghaowei']) {
    const response = await request(base, '/task-query', await login(base, username));
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { count: 1 });
  }
});

test('US03生产启动：server.js始终鉴权，即使设置关闭鉴权环境变量也不能绕过', async t => {
  const file = makeTempDataFile(t, data());
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '0', DATA_FILE: file, NODE_ENV: 'test', AUTH_DISABLED: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); child.kill(); }));
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', chunk => {
      const match = /http:\/\/localhost:(\d+)/.exec(chunk.toString());
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  assert.equal((await request(base, '/tasks')).status, 401);
  assert.equal((await request(base, '/users', await login(base))).status, 200);
});
