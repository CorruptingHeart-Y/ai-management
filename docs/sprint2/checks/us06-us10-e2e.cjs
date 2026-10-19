'use strict';
// 跨故事联调：US06 创建（priority/dueDate）+ US07 迭代归属 + US05 状态更新 + US10 统计
// 文件名沿用 10-17 版本，内容在 10-19 扩展为三故事链路（23 项断言）。
// 使用临时数据文件，不写 data/db.json。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createApp } = require('../../../src/app');

const members = [
  { id: 1, name: '彭佳成', role: '产品与范围负责人' },
  { id: 2, name: '朱传玺', role: '技术与架构负责人' },
  { id: 3, name: '杨浩伟', role: '质量与风险负责人' },
  { id: 4, name: '何健翔', role: 'AI协调与记录负责人' },
];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's2-e2e-'));
const dataFile = path.join(dir, 'db.json');
fs.writeFileSync(
  dataFile,
  JSON.stringify(
    {
      members,
      tasks: [
        { id: 1, title: '查看项目成员', status: 'DONE', assigneeId: 1, priority: 'HIGH', dueDate: '2026-10-10', iterationId: null },
        { id: 2, title: '创建并分配任务', status: 'TODO', assigneeId: 2 },
      ],
      // US07：迭代集合必须能透传（TD-S2-01 关闭后的行为）
      iterations: [
        { id: 1, name: 'Sprint 1' },
        { id: 2, name: 'Sprint 2' },
      ],
    },
    null,
    2
  ) + '\n',
  'utf8'
);

const app = createApp({ dataFile });
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const checks = [];
  const check = (name, fn) => {
    try {
      fn();
      checks.push(`PASS  ${name}`);
    } catch (e) {
      checks.push(`FAIL  ${name} -> ${e.message}`);
      process.exitCode = 1;
    }
  };
  try {
    // 1) US06 字段已被 US10 识别
    let stats = await (await fetch(`${base}/api/stats`)).json();
    check('初始统计：总数 2', () => assert.equal(stats.total, 2));
    check('初始统计：HIGH 1 / MEDIUM 1（缺字段按 MEDIUM）', () => {
      assert.equal(stats.byPriority.HIGH, 1);
      assert.equal(stats.byPriority.MEDIUM, 1);
      assert.equal(stats.byPriority.LOW, 0);
    });
    check('初始统计：byStatus 之和等于 total', () => {
      assert.equal(stats.byStatus.TODO + stats.byStatus.DOING + stats.byStatus.DONE, stats.total);
    });

    // 2) US06 创建：带 priority=LOW、dueDate
    const created = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '联调任务', assigneeId: 4, priority: 'LOW', dueDate: '2026-11-01' }),
    });
    check('US06 创建返回 201', () => assert.equal(created.status, 201));
    const task = await created.json();
    check('US06 创建保留 priority=LOW 与 dueDate', () => {
      assert.equal(task.priority, 'LOW');
      assert.equal(task.dueDate, '2026-11-01');
    });

    // 3) 非法优先级必须被 US06 拒绝，且统计不得变化
    const bad = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '非法优先级', assigneeId: 1, priority: 'URGENT' }),
    });
    check('US06 非法优先级返回 400', () => assert.equal(bad.status, 400));
    let afterBad = await (await fetch(`${base}/api/stats`)).json();
    check('非法创建后统计总数仍为 3（未落库）', () => assert.equal(afterBad.total, 3));
    const afterBadList = await (await fetch(`${base}/api/tasks`)).json();
    check('非法请求没有留下任务', () => {
      assert.equal(afterBadList.length, 3);
      assert.equal(afterBadList.some((t) => t.title === '非法优先级'), false);
    });

    // 4) 创建后统计立即反映
    stats = await (await fetch(`${base}/api/stats`)).json();
    check('新建后统计总数 3', () => assert.equal(stats.total, 3));
    check('新建后 LOW 计数为 1', () => assert.equal(stats.byPriority.LOW, 1));
    check('新建后该负责人计数为 1', () => {
      const he = stats.byAssignee.find((r) => r.memberId === 4);
      assert.equal(he.count, 1);
    });

    // 5) US05 状态更新 -> US10 状态计数联动
    const patch = await fetch(`${base}/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    });
    check('US05 状态更新返回 200', () => assert.equal(patch.status, 200));
    stats = await (await fetch(`${base}/api/stats`)).json();
    check('状态改 DONE 后统计 DONE=2、TODO=1', () => {
      assert.equal(stats.byStatus.DONE, 2);
      assert.equal(stats.byStatus.TODO, 1);
    });

    // 6) US07 迭代：列表可读、可归属、非法引用被拒、统计按迭代分组
    const iterations = await (await fetch(`${base}/api/iterations`)).json();
    check('US07 迭代列表返回 2 条（TD-S2-01 已通）', () => {
      assert.equal(iterations.length, 2);
      assert.equal(iterations[1].name, 'Sprint 2');
    });

    const withIteration = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '归属 Sprint 2 的任务', assigneeId: 1, priority: 'HIGH', iterationId: 2 }),
    });
    check('US07 归属迭代创建返回 201', () => assert.equal(withIteration.status, 201));
    const iterationTask = await withIteration.json();
    check('US07 任务保留 iterationId=2', () => assert.equal(iterationTask.iterationId, 2));

    const badIteration = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '非法迭代', assigneeId: 1, iterationId: 99 }),
    });
    check('US07 不存在的迭代返回 400', () => assert.equal(badIteration.status, 400));
    const badIterationBody = await badIteration.json();
    check('US07 错误提示含“非法迭代”', () => assert.match(badIterationBody.error, /非法迭代/));

    stats = await (await fetch(`${base}/api/stats`)).json();
    check('US10 按迭代分组：Sprint 2 计 1、未分配计 3', () => {
      const sprint2 = stats.byIteration.find((r) => r.iterationId === 2);
      assert.equal(sprint2.name, 'Sprint 2', '迭代名必须来自迭代集合，而不是“未知迭代 #2”');
      assert.equal(sprint2.count, 1);
      const unassigned = stats.byIteration.find((r) => r.iterationId === null);
      assert.equal(unassigned.count, 3);
    });

    // 7) 统计只读：不修改数据文件
    const before = fs.readFileSync(dataFile, 'utf8');
    await fetch(`${base}/api/stats`);
    const after = fs.readFileSync(dataFile, 'utf8');
    check('调用统计不写数据文件', () => assert.equal(after, before));
    check('迭代集合在多次写入后仍然存在', () => {
      const saved = JSON.parse(after);
      assert.equal(Array.isArray(saved.iterations), true);
      assert.equal(saved.iterations.length, 2);
    });

    // 8) 页面可访问
    const page = await fetch(`${base}/stats.html`);
    check('/stats.html 返回 200', () => assert.equal(page.status, 200));
    const list = await (await fetch(`${base}/api/tasks`)).json();
    check('任务列表 4 条', () => assert.equal(list.length, 4));
  } catch (e) {
    checks.push(`FAIL  未预期异常 -> ${e.message}`);
    process.exitCode = 1;
  } finally {
    console.log(checks.join('\n'));
    console.log(`\n共 ${checks.filter((c) => c.startsWith('PASS')).length} 项通过，${checks.filter((c) => c.startsWith('FAIL')).length} 项失败`);
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
