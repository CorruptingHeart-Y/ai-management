'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeTempDataFile, startServer } = require('./helpers');

/**
 * 成员接口基础测试（支撑 US01，供 US04 复用为负责人来源）。
 */
test('成员列表可获取，预置成员数量与关键字段正确', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const res = await fetch(`${baseUrl}/api/members`);
  assert.equal(res.status, 200);

  const members = await res.json();
  assert.equal(members.length, 4);

  members.forEach((m) => {
    assert.equal(typeof m.id, 'number');
    assert.equal(typeof m.name, 'string');
    assert.equal(typeof m.role, 'string');
  });
});

test('成员 id 唯一', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const members = await (await fetch(`${baseUrl}/api/members`)).json();
  const ids = members.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('成员数据可供任务分配使用（存在可选的 id）', async (t) => {
  const dataFile = makeTempDataFile(t);
  const { baseUrl } = await startServer(t, dataFile);

  const members = await (await fetch(`${baseUrl}/api/members`)).json();
  assert.ok(members.length > 0);
  assert.ok(members.some((m) => m.id === 1));
});
