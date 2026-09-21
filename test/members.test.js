'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempDataFile, startServer } = require('./helpers');
const { validateMembers } = require('../src/domain/member');

// 实验一《第7组-项目规划方案》“四加N团队规划 / 人类成员分工”。
const EXPECTED_MEMBERS = [
  { id: 1, name: '彭佳成', role: '产品与范围负责人' },
  { id: 2, name: '朱传玺', role: '技术与架构负责人' },
  { id: 3, name: '杨浩伟', role: '质量与风险负责人' },
  { id: 4, name: '何健翔', role: 'AI协调与记录负责人' },
];

function postTask(baseUrl, body) {
  return fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function readData(dataFile) {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

test('US01 默认初始化：准确返回实验一的四名成员及分工', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await fetch(`${baseUrl}/api/members`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.headers.get('cache-control'), 'no-store');

  const members = await res.json();
  assert.deepEqual(members, EXPECTED_MEMBERS);
  assert.deepEqual(readData(dataFile), { members: EXPECTED_MEMBERS, tasks: [] });
  assert.equal(new Set(members.map((member) => member.id)).size, members.length);
  for (const member of members) {
    assert.ok(Number.isSafeInteger(member.id) && member.id > 0);
    assert.ok(typeof member.name === 'string' && member.name.trim().length > 0);
    assert.ok(typeof member.role === 'string' && member.role.trim().length > 0);
  }
});

test('US01 提交的预置数据与默认初始化一致', async (t) => {
  // 仓库数据只读；HTTP 服务始终使用测试自己的临时文件。
  const fixturePath = path.join(__dirname, '..', 'data', 'db.json');
  const fixtureBefore = fs.readFileSync(fixturePath, 'utf8');
  const fixture = JSON.parse(fixtureBefore);
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const members = await (await fetch(`${baseUrl}/api/members`)).json();
  assert.deepEqual(fixture.members, EXPECTED_MEMBERS);
  assert.deepEqual(members, fixture.members);
  assert.equal(fs.readFileSync(fixturePath, 'utf8'), fixtureBefore);
});

test('US01 唯一数据源：返回注入数据文件中的成员，并读取后续变更', async (t) => {
  const customMembers = [
    { id: 21, name: '测试成员甲', role: '需求验收' },
    { id: 37, name: '测试成员乙', role: '接口联调' },
  ];
  const dataFile = makeTempDataFile(t, { members: customMembers, tasks: [] });
  const { baseUrl } = await startServer(t, dataFile);

  const first = await fetch(`${baseUrl}/api/members`);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), customMembers);

  const updatedMembers = [{ id: 56, name: '更新后的成员', role: '数据维护' }];
  fs.writeFileSync(dataFile, JSON.stringify({ members: updatedMembers, tasks: [] }), 'utf8');
  const second = await fetch(`${baseUrl}/api/members`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await second.json(), updatedMembers);
});

test('US01 空成员列表：返回空数组且不重新填入预置成员', async (t) => {
  const dataFile = makeTempDataFile(t, { members: [], tasks: [] });
  const before = fs.readFileSync(dataFile, 'utf8');
  const { baseUrl } = await startServer(t, dataFile);

  const res = await fetch(`${baseUrl}/api/members`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), before);
});

test('US01 与 US04 联调：列表中的每名成员均可分配任务并持久读取', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);
  const members = await (await fetch(`${baseUrl}/api/members`)).json();
  assert.deepEqual(members, EXPECTED_MEMBERS);

  const createdTasks = [];
  for (const member of members) {
    const res = await postTask(baseUrl, {
      title: `由${member.name}验收成员功能`,
      assigneeId: member.id,
    });
    assert.equal(res.status, 201);
    const task = await res.json();
    assert.equal(task.assigneeId, member.id);
    assert.equal(task.status, 'TODO');
    createdTasks.push(task);
  }

  const tasksRes = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(tasksRes.status, 200);
  assert.deepEqual(await tasksRes.json(), createdTasks);
  assert.deepEqual(readData(dataFile), { members, tasks: createdTasks });
});

test('US01 与 US04 共用数据文件：自定义成员可分配，已不存在的种子成员被拒绝', async (t) => {
  const customMembers = [{ id: 28, name: '接口测试成员', role: '联调验收' }];
  const dataFile = makeTempDataFile(t, { members: customMembers, tasks: [] });
  const { baseUrl } = await startServer(t, dataFile);
  const members = await (await fetch(`${baseUrl}/api/members`)).json();

  const accepted = await postTask(baseUrl, { title: '自定义成员任务', assigneeId: members[0].id });
  assert.equal(accepted.status, 201);
  const createdTask = await accepted.json();
  assert.equal(createdTask.assigneeId, 28);
  const before = fs.readFileSync(dataFile, 'utf8');

  for (const assigneeId of [1, 999]) {
    const rejected = await postTask(baseUrl, { title: '未知负责人任务', assigneeId });
    assert.equal(rejected.status, 400);
    assert.deepEqual(await rejected.json(), { error: '负责人无效：成员不存在' });
  }

  assert.equal(fs.readFileSync(dataFile, 'utf8'), before);
  const tasks = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.deepEqual(tasks, [createdTask]);
  assert.deepEqual(readData(dataFile).members, customMembers);
});

test('US01 只读约定：重复获取成员不改变已有成员、任务及文件内容', async (t) => {
  const existingTask = {
    id: 8,
    title: '保留已有任务',
    description: '读取成员不应写入数据',
    assigneeId: 2,
    status: 'DOING',
    createdAt: '2026-09-20T00:00:00.000Z',
  };
  const initial = { members: EXPECTED_MEMBERS, tasks: [existingTask] };
  const dataFile = makeTempDataFile(t, initial);
  const before = fs.readFileSync(dataFile, 'utf8');
  const { baseUrl } = await startServer(t, dataFile);

  for (let index = 0; index < 3; index += 1) {
    const res = await fetch(`${baseUrl}/api/members`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), EXPECTED_MEMBERS);
  }

  assert.equal(fs.readFileSync(dataFile, 'utf8'), before);
  assert.deepEqual(readData(dataFile), initial);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/tasks`)).json(), [existingTask]);
});

test('US01 成员契约：允许有效列表与空列表，拒绝不合法字段和重复 id', () => {
  assert.equal(validateMembers(EXPECTED_MEMBERS), true);
  assert.equal(validateMembers([]), true);
  assert.equal(validateMembers([{ id: 73, name: '测试成员', role: '测试分工' }]), true);

  const invalidLists = [null, undefined, {}, 'members', [null], [[]]];
  const validMember = EXPECTED_MEMBERS[0];
  for (const id of [0, -1, 1.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    invalidLists.push([{ ...validMember, id }]);
  }
  for (const name of ['', '   ', '\t\n', null, undefined, 123]) {
    invalidLists.push([{ ...validMember, name }]);
  }
  for (const role of ['', '   ', '\t\n', null, undefined, 123]) {
    invalidLists.push([{ ...validMember, role }]);
  }
  invalidLists.push([
    validMember,
    { id: validMember.id, name: '重复编号成员', role: '测试' },
  ]);

  for (const members of invalidLists) {
    assert.equal(validateMembers(members), false, `应拒绝非法成员数据：${JSON.stringify(members)}`);
  }
});

test('US01 非法成员数据：返回明确 JSON 错误，保留原始数据供修复', async (t) => {
  const invalidCases = [
    { label: '重复 id', members: [EXPECTED_MEMBERS[0], { id: 1, name: '重复编号', role: '测试' }] },
    { label: '空成员条目', members: [null] },
    { label: '非法 id', members: [{ ...EXPECTED_MEMBERS[0], id: 0 }] },
    { label: '空白姓名', members: [{ ...EXPECTED_MEMBERS[0], name: '   ' }] },
    { label: '缺少分工', members: [{ id: 1, name: '测试成员' }] },
  ];

  for (const { label, members } of invalidCases) {
    await t.test(label, async (subtest) => {
      const dataFile = makeTempDataFile(subtest, { members, tasks: [] });
      const before = fs.readFileSync(dataFile, 'utf8');
      const { baseUrl } = await startServer(subtest, dataFile);

      const res = await fetch(`${baseUrl}/api/members`);
      assert.equal(res.status, 500);
      assert.match(res.headers.get('content-type'), /application\/json/);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await res.json(), { error: '成员数据格式错误，请检查项目数据文件' });
      assert.equal(fs.readFileSync(dataFile, 'utf8'), before);
    });
  }
});

test('US01 数据读取失败：损坏 JSON 返回可理解的错误且不覆盖源文件', async (t) => {
  const dataFile = makeTempDataFile(t);
  const brokenJson = '{ "members": [invalid json';
  fs.writeFileSync(dataFile, brokenJson, 'utf8');
  const { baseUrl } = await startServer(t, dataFile);

  const res = await fetch(`${baseUrl}/api/members`);
  assert.equal(res.status, 500);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { error: '成员列表暂时无法读取，请稍后重试' });
  assert.equal(fs.readFileSync(dataFile, 'utf8'), brokenJson);
});
