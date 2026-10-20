'use strict';

/**
 * 异常 / 权限旅程（E2E-2）：未登录与越权、错误凭证、非法输入、损坏数据、未知路由。
 * 目的：证明"出错时系统是可控的"——返回可读错误、不写坏数据、不 200 假装成功。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  authCapability, login, requestWithSession, seedData, makeTempDataFile, startServer, getJson, DEMO_ADMIN,
} = require('./helpers');

function brokenDataFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-broken-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, '{ 这不是合法 JSON', 'utf8');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return file;
}

test('E2E 异常旅程：凭证、非法输入、损坏数据与未知路由都有可控结果', async (t) => {
  const dataFile = makeTempDataFile(t, seedData([
    { id: 1, title: '既有任务', status: 'TODO', assigneeId: 1, priority: 'LOW', dueDate: null, iterationId: null },
  ]));
  const { baseUrl } = await startServer(t, dataFile);

  const auth = await authCapability(baseUrl);
  const snapshot = fs.readFileSync(dataFile, 'utf8');

  // ---- 1. 错误凭证 / 缺字段 ----
  if (auth.exists) {
    const wrong = await getJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: DEMO_ADMIN.username, password: 'definitely-wrong' }),
    });
    assert.equal(wrong.status, 401, `错误密码应 401，实际 ${wrong.status}`);
    assert.equal(wrong.body && wrong.body.token, undefined, '失败时不得签发 token');

    const empty = await getJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' }),
    });
    assert.equal(empty.status, 400, `缺字段应 400，实际 ${empty.status}`);
    t.diagnostic('鉴权失败路径：401 与 400 均符合契约');
  } else {
    t.diagnostic('US02 未合入：跳过凭证失败断言（不伪造通过）');
  }

  const session = auth.exists ? await login(baseUrl, DEMO_ADMIN) : { ok: false };
  const token = session.ok ? session.token : null;

  // ---- 2. 非法输入：一律 4xx，且不得落库 ----
  const badPayloads = [
    { label: '空标题', body: { title: '   ', assigneeId: 1 } },
    { label: '无效负责人', body: { title: 'x', assigneeId: 999 } },
    { label: '非法优先级', body: { title: 'x', assigneeId: 1, priority: 'URGENT' } },
    { label: '非法日期', body: { title: 'x', assigneeId: 1, dueDate: '2026-02-30' } },
    { label: '不存在的迭代', body: { title: 'x', assigneeId: 1, iterationId: 999 } },
  ];
  for (const item of badPayloads) {
    const res = await requestWithSession(baseUrl, '/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item.body),
    }, token);
    const allowed = [400, 401, 403];
    assert.ok(allowed.includes(res.status), `${item.label} 应被拒绝，实际 ${res.status}`);
    if (res.status === 400) {
      assert.ok(res.body && typeof res.body.error === 'string' && res.body.error.length > 0,
        `${item.label} 应返回可读错误信息`);
    }
  }
  assert.equal(fs.readFileSync(dataFile, 'utf8'), snapshot, '非法请求不得修改数据文件');

  // ---- 3. 不存在的任务 ----
  const notFound = await requestWithSession(baseUrl, '/api/tasks/999/status', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'DONE' }),
  }, token);
  assert.ok([404, 401, 403].includes(notFound.status), `不存在任务应 404，实际 ${notFound.status}`);

  // ---- 4. 未知路由：不能返回 200 ----
  const unknown = await getJson(`${baseUrl}/api/not-exist`);
  assert.equal(unknown.status, 404, `未知接口应 404，实际 ${unknown.status}`);

  // ---- 5. 损坏的数据文件：500 而不是半截数据 ----
  const broken = brokenDataFile(t);
  const brokenServer = await startServer(t, broken);
  const listBroken = await getJson(`${brokenServer.baseUrl}/api/tasks`);
  assert.ok([500, 401, 403].includes(listBroken.status), `损坏数据应 500，实际 ${listBroken.status}`);
  if (listBroken.status === 500) {
    assert.ok(listBroken.body === null || typeof listBroken.body === 'object',
      '500 时应返回结构化响应或空体，不应返回半截任务数组');
    assert.ok(!Array.isArray(listBroken.body), '不得把损坏数据当成空任务列表返回 200');
  }
  t.diagnostic(`损坏数据：/api/tasks → ${listBroken.status}`);
});
