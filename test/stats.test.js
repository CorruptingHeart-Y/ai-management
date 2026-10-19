'use strict';

/**
 * US10 状态统计测试。
 *
 * 分两层：
 *   1. 领域函数 buildStats 的纯逻辑（口径、容错、排序）；
 *   2. GET /api/stats 的真实 HTTP 行为（临时数据文件，不碰 data/db.json）。
 *
 * 之所以要单独测领域函数：统计涉及“缺失字段怎么算”，这类规则用 HTTP 测不直观，
 * 一旦以后接上 US06/US07 的新字段，改口径时只需看这一组断言。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildStats } = require('../src/domain/stats');
const { makeTempDataFile, startServer } = require('./helpers');

const MEMBERS = [
  { id: 1, name: '彭佳成', role: '产品与范围负责人' },
  { id: 2, name: '朱传玺', role: '技术与架构负责人' },
  { id: 3, name: '杨浩伟', role: '质量与风险负责人' },
  { id: 4, name: '何健翔', role: 'AI协调与记录负责人' },
];

/** 写一个内容非法的数据文件，用于验证 500 分支。 */
function makeBrokenDataFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-mgmt-bad-'));
  const dataFile = path.join(dir, 'db.json');
  fs.writeFileSync(dataFile, '{ this is not json', 'utf8');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dataFile;
}

test('US10 空数据：总数为 0，各组计数为 0，不报错', () => {
  const stats = buildStats({ members: MEMBERS, tasks: [] });
  assert.equal(stats.total, 0);
  assert.deepEqual(stats.byStatus, { TODO: 0, DOING: 0, DONE: 0 });
  assert.deepEqual(stats.byPriority, { HIGH: 0, MEDIUM: 0, LOW: 0 });
  assert.equal(stats.byAssignee.length, MEMBERS.length);
  assert.ok(stats.byAssignee.every((row) => row.count === 0));
  assert.deepEqual(stats.byIteration, [{ iterationId: null, name: '未分配', count: 0 }]);
});

test('US10 按状态计数：三项之和等于总数', () => {
  const tasks = [
    { id: 1, status: 'TODO', assigneeId: 1 },
    { id: 2, status: 'DOING', assigneeId: 2 },
    { id: 3, status: 'DONE', assigneeId: 3 },
    { id: 4, status: 'TODO', assigneeId: 4 },
  ];
  const stats = buildStats({ members: MEMBERS, tasks });
  assert.equal(stats.total, 4);
  assert.deepEqual(stats.byStatus, { TODO: 2, DOING: 1, DONE: 1 });
  const sum = stats.byStatus.TODO + stats.byStatus.DOING + stats.byStatus.DONE;
  assert.equal(sum, stats.total);
});

test('US10 缺失字段容错：Sprint 1 旧任务按 TODO / MEDIUM / 未分配 计', () => {
  const tasks = [{ id: 1, title: '旧任务', assigneeId: 1 }]; // 无 status/priority/iterationId
  const stats = buildStats({ members: MEMBERS, tasks });
  assert.deepEqual(stats.byStatus, { TODO: 1, DOING: 0, DONE: 0 });
  assert.equal(stats.byPriority.MEDIUM, 1);
  assert.equal(stats.byIteration[0].name, '未分配');
  assert.equal(stats.byIteration[0].count, 1);
});

test('US10 非法值容错：未知状态/优先级不丢任务，未知迭代单独成组', () => {
  const tasks = [
    { id: 1, status: 'BLOCKED', priority: 'URGENT', assigneeId: 1, iterationId: 99 },
  ];
  const stats = buildStats({ members: MEMBERS, tasks });
  assert.equal(stats.total, 1);
  assert.deepEqual(stats.byStatus, { TODO: 1, DOING: 0, DONE: 0 });
  assert.equal(stats.byPriority.MEDIUM, 1);
  const unknown = stats.byIteration.find((row) => row.iterationId === 99);
  assert.ok(unknown, '未知迭代必须单独成组，不能被静默丢弃');
  assert.equal(unknown.name, '未知迭代 #99');
  assert.equal(unknown.count, 1);
});

test('US10 按优先级计数：三个档位分别统计', () => {
  const tasks = [
    { id: 1, status: 'TODO', priority: 'HIGH', assigneeId: 1 },
    { id: 2, status: 'TODO', priority: 'MEDIUM', assigneeId: 1 },
    { id: 3, status: 'DONE', priority: 'LOW', assigneeId: 2 },
    { id: 4, status: 'DOING', assigneeId: 2 }, // 缺省 → MEDIUM
  ];
  const stats = buildStats({ members: MEMBERS, tasks });
  assert.deepEqual(stats.byPriority, { HIGH: 1, MEDIUM: 2, LOW: 1 });
});

test('US10 按负责人计数：含 0 任务成员，未知负责人单独成组', () => {
  const tasks = [
    { id: 1, status: 'TODO', assigneeId: 1 },
    { id: 2, status: 'DONE', assigneeId: 1 },
    { id: 3, status: 'DOING', assigneeId: 99 }, // 负责人不存在
  ];
  const stats = buildStats({ members: MEMBERS, tasks });
  const cheng = stats.byAssignee.find((row) => row.memberId === 1);
  assert.equal(cheng.count, 2);
  const nobody = stats.byAssignee.find((row) => row.memberId === 3);
  assert.equal(nobody.count, 0, '没任务的成员也要出现，count 为 0');
  const unknown = stats.byAssignee.find((row) => row.memberId === 99);
  assert.equal(unknown.name, '未知成员 #99');
  assert.equal(unknown.count, 1);
});

test('US10 按迭代计数：未分配排第一，迭代名称来自 iterations', () => {
  const iterations = [
    { id: 7, name: 'Sprint 2' },
    { id: 8, name: 'Sprint 3' },
  ];
  const tasks = [
    { id: 1, status: 'TODO', assigneeId: 1, iterationId: 7 },
    { id: 2, status: 'DONE', assigneeId: 2, iterationId: 7 },
    { id: 3, status: 'TODO', assigneeId: 3, iterationId: null },
  ];
  const stats = buildStats({ members: MEMBERS, tasks, iterations });
  assert.equal(stats.byIteration[0].name, '未分配');
  assert.equal(stats.byIteration[0].count, 1);
  const sprint2 = stats.byIteration.find((row) => row.iterationId === 7);
  assert.equal(sprint2.name, 'Sprint 2');
  assert.equal(sprint2.count, 2);
  const sprint3 = stats.byIteration.find((row) => row.iterationId === 8);
  assert.equal(sprint3.count, 0, '没有任务的迭代也要出现，便于看出空闲迭代');
});

test('US10 字符串 id 归一化：assigneeId="2" 不应产生未知成员', () => {
  const tasks = [{ id: 1, status: 'TODO', assigneeId: '2' }];
  const stats = buildStats({ members: MEMBERS, tasks });
  const zhu = stats.byAssignee.find((row) => row.memberId === 2);
  assert.equal(zhu.count, 1);
  assert.equal(stats.byAssignee.some((row) => String(row.name).startsWith('未知成员')), false);
});

test('US10 纯函数：不修改传入的数据对象', () => {
  const data = {
    members: MEMBERS,
    tasks: [{ id: 1, status: 'TODO', assigneeId: 1, iterationId: 7 }],
    iterations: [{ id: 7, name: 'Sprint 2' }],
  };
  const snapshot = JSON.stringify(data);
  buildStats(data);
  assert.equal(JSON.stringify(data), snapshot);
});

test('GET /api/stats：返回统计结构，且 byStatus 之和等于 total', async (t) => {
  const dataFile = makeTempDataFile(t, {
    members: MEMBERS,
    tasks: [
      { id: 1, title: 'A', status: 'TODO', assigneeId: 1 },
      { id: 2, title: 'B', status: 'DOING', assigneeId: 2 },
      { id: 3, title: 'C', status: 'DONE', assigneeId: 2 },
    ],
  });
  const { baseUrl } = await startServer(t, dataFile);

  const res = await fetch(`${baseUrl}/api/stats`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');

  const body = await res.json();
  assert.equal(body.total, 3);
  assert.equal(body.byStatus.TODO + body.byStatus.DOING + body.byStatus.DONE, body.total);
  assert.equal(body.byAssignee.length, MEMBERS.length);
  assert.equal(body.byIteration[0].name, '未分配');
  assert.equal(body.byIteration[0].count, 3, 'Sprint 1 数据没有迭代字段，应全部落在未分配');
});

test('GET /api/stats：空任务库返回 200 与全 0，不返回 500', async (t) => {
  const dataFile = makeTempDataFile(t, { members: MEMBERS, tasks: [] });
  const { baseUrl } = await startServer(t, dataFile);

  const res = await fetch(`${baseUrl}/api/stats`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 0);
  assert.deepEqual(body.byStatus, { TODO: 0, DOING: 0, DONE: 0 });
});

test('GET /api/stats：数据文件损坏返回 500 与可读提示', async (t) => {
  const dataFile = makeBrokenDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await fetch(`${baseUrl}/api/stats`);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(body.error, /无法读取/);
});
