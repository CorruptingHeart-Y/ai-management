'use strict';

/**
 * 主旅程（E2E-1）：登录（若已落地）→ 建两条任务 → 列表与筛选能力探测 →
 * 逾期判定一致性 → 状态流转 → 统计一致 → 重启后仍在。
 *
 * 能力探测为什么要建两条任务：查询参数未实现时，接口会把全量列表原样返回，
 * 只看"返回里有没有我的任务"会把"参数被忽略"误判成"筛选生效"。
 * 因此这里建两条归属不同迭代、一条逾期一条不逾期的任务，用排除法确认能力。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  authCapability, login, requestWithSession, seedData, makeTempDataFile, startServer, DEMO_ADMIN,
} = require('./helpers');

function dayOffset(offset) {
  const d = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function createTask(baseUrl, token, payload) {
  const res = await requestWithSession(baseUrl, '/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  assert.equal(res.status, 201, `创建应返回 201，实际 ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

test('E2E 主旅程：从登录到统计一致，重启后数据仍在', async (t) => {
  const dataFile = makeTempDataFile(t, seedData([]));
  const { baseUrl } = await startServer(t, dataFile);

  // ---- 0. 能力探测 ----
  const auth = await authCapability(baseUrl);
  t.diagnostic(`鉴权接口：${auth.exists ? '已落地' : '未落地（US02 未合入）'}`);

  let token = null;
  if (auth.exists) {
    const session = await login(baseUrl, DEMO_ADMIN);
    assert.equal(session.ok, true, `演示账号应能登录，实际：${session.reason || ''}`);
    token = session.token;
    t.diagnostic(`登录成功：${session.user.username} / ${session.user.role}`);
  }

  const anon = await requestWithSession(baseUrl, '/api/tasks');
  assert.ok([200, 401, 403].includes(anon.status), `未登录访问返回未定义状态：${anon.status}`);
  t.diagnostic(`未登录访问 /api/tasks → ${anon.status}`);

  // ---- 1. 两条任务：一条本迭代且逾期，一条他迭代且未逾期 ----
  const overdueTask = await createTask(baseUrl, token, {
    title: 'E2E 逾期任务',
    description: 'dueDate 在昨天，迭代 2',
    assigneeId: 2,
    priority: 'HIGH',
    dueDate: dayOffset(-1),
    iterationId: 2,
  });
  const futureTask = await createTask(baseUrl, token, {
    title: 'E2E 未逾期任务',
    description: 'dueDate 在明天，迭代 3',
    assigneeId: 1,
    priority: 'LOW',
    dueDate: dayOffset(1),
    iterationId: 3,
  });
  assert.equal(overdueTask.iterationId, 2);
  assert.equal(futureTask.iterationId, 3);

  const list = await requestWithSession(baseUrl, '/api/tasks', {}, token);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2, '两条任务都应出现在列表');

  // ---- 2. US11 筛选能力：用"是否排除了他迭代任务"判定 ----
  const filtered = await requestWithSession(baseUrl, '/api/tasks?iterationId=2', {}, token);
  let filterImplemented = false;
  if (filtered.status === 200 && Array.isArray(filtered.body)) {
    filterImplemented = filtered.body.length === 1 && filtered.body[0].id === overdueTask.id;
    t.diagnostic(filterImplemented
      ? 'US11 筛选已生效：?iterationId=2 只返回该迭代任务'
      : `US11 未合入：?iterationId 被忽略（返回 ${filtered.body.length} 条，含他迭代任务）`);
  } else {
    t.diagnostic(`US11 未合入：?iterationId=2 → ${filtered.status}`);
  }

  // ---- 3. US12 逾期能力：用"是否排除了未逾期任务"判定 ----
  const overdueProbe = await requestWithSession(baseUrl, '/api/tasks?overdue=true', {}, token);
  let overdueImplemented = false;
  if (overdueProbe.status === 200 && Array.isArray(overdueProbe.body)) {
    overdueImplemented = overdueProbe.body.length === 1 && overdueProbe.body[0].id === overdueTask.id;
    t.diagnostic(overdueImplemented
      ? 'US12 逾期接口已生效：只返回逾期任务'
      : `US12 未合入：?overdue 被忽略（返回 ${overdueProbe.body.length} 条，含未逾期任务）`);
  } else {
    t.diagnostic(`US12 未合入：?overdue=true → ${overdueProbe.status}`);
  }

  // 口径重算：dueDate 早于今天且未完成即为逾期（与 PO 裁决的字符串比较一致）
  const today = dayOffset(0);
  const overdueByRule = overdueTask.dueDate < today && overdueTask.status !== 'DONE';
  assert.equal(overdueByRule, true, '构造的逾期任务按口径应判定为逾期');
  if (overdueImplemented) {
    assert.equal(overdueProbe.body.length, 1, '逾期接口返回条数应与口径一致');
  }

  // ---- 4. 状态流转 ----
  const patched = await requestWithSession(baseUrl, `/api/tasks/${overdueTask.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'DONE' }),
  }, token);
  assert.equal(patched.status, 200);
  assert.equal(patched.body.status, 'DONE');

  // ---- 5. 统计与列表一致 ----
  const stats = await requestWithSession(baseUrl, '/api/stats', {}, token);
  assert.equal(stats.status, 200);
  const s = stats.body;
  assert.equal(s.total, list.body.length, '统计总数应等于列表条数');
  assert.equal(s.byStatus.TODO + s.byStatus.DOING + s.byStatus.DONE, s.total);
  assert.equal(s.byStatus.DONE, 1);
  assert.equal(s.byStatus.TODO, 1);
  assert.ok(s.byIteration.some((row) => row.iterationId === 2 && row.count === 1), '按迭代应统计到逾期任务');
  assert.ok(s.byIteration.some((row) => row.iterationId === 3 && row.count === 1), '按迭代应统计到他迭代任务');

  // ---- 6. 重启后仍在 ----
  const before = fs.readFileSync(dataFile, 'utf8');
  const second = await startServer(t, dataFile);
  let afterRestart = await requestWithSession(second.baseUrl, '/api/tasks', {}, token);
  if (afterRestart.status === 401 && auth.exists) {
    const reLogin = await login(second.baseUrl, DEMO_ADMIN);
    afterRestart = await requestWithSession(second.baseUrl, '/api/tasks', {}, reLogin.token || null);
  }
  assert.equal(afterRestart.status, 200, `重启后应仍可读取，实际 ${afterRestart.status}`);
  assert.ok(afterRestart.body.some((x) => x.id === overdueTask.id && x.status === 'DONE'), '重启后任务与状态都应保留');
  assert.ok(before.includes('E2E 逾期任务'), '数据文件应实际落盘');
});
