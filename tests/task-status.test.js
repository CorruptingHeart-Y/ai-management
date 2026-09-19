// US05 更新任务状态 测试
// 覆盖：TODO→DOING、DOING→DONE、非法状态失败、修改后重新读取仍为最新状态。

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const {
  updateTaskStatus,
  isValidStatus,
  VALID_STATUSES,
} = require('../src/domain/task');
const { TaskStore } = require('../src/store/taskStore');
const { createApp } = require('../src/app');

describe('US05 领域逻辑：更新任务状态', () => {
  const baseTask = {
    id: '1',
    title: '测试任务',
    description: '描述',
    assigneeId: '1',
    status: 'TODO',
  };

  test('状态能从 TODO 改成 DOING', () => {
    const updated = updateTaskStatus(baseTask, 'DOING');
    expect(updated.status).toBe('DOING');
    // 不修改原对象
    expect(baseTask.status).toBe('TODO');
  });

  test('状态能从 DOING 改成 DONE', () => {
    const updated = updateTaskStatus({ ...baseTask, status: 'DOING' }, 'DONE');
    expect(updated.status).toBe('DONE');
  });

  test('非法状态修改失败（抛出异常）', () => {
    expect(() => updateTaskStatus(baseTask, 'ABC')).toThrow();
    expect(() => updateTaskStatus(baseTask, 'FINISHEDDDD')).toThrow();
  });

  test('合法状态仅包含 TODO / DOING / DONE', () => {
    expect(VALID_STATUSES).toEqual(['TODO', 'DOING', 'DONE']);
    expect(isValidStatus('TODO')).toBe(true);
    expect(isValidStatus('DOING')).toBe(true);
    expect(isValidStatus('DONE')).toBe(true);
    expect(isValidStatus('ABC')).toBe(false);
  });
});

describe('US05 接口与持久化：PATCH /api/tasks/:id/status', () => {
  let store;
  let app;
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `tasks-${Date.now()}-${Math.random()}.json`);
    fs.writeFileSync(
      tmpFile,
      JSON.stringify([
        { id: '1', title: '任务A', description: '', assigneeId: '1', status: 'TODO' },
        { id: '2', title: '任务B', description: '', assigneeId: '2', status: 'DOING' },
      ])
    );
    store = new TaskStore(tmpFile);
    app = createApp(store);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('修改状态成功并返回最新状态', async () => {
    const res = await request(app)
      .patch('/api/tasks/1/status')
      .send({ status: 'DOING' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DOING');
  });

  test('非法状态返回 400 且不修改数据', async () => {
    const res = await request(app)
      .patch('/api/tasks/1/status')
      .send({ status: 'ABC' });
    expect(res.status).toBe(400);

    const reloaded = store.load();
    expect(reloaded.find((t) => t.id === '1').status).toBe('TODO');
  });

  test('不存在的任务返回 404', async () => {
    const res = await request(app)
      .patch('/api/tasks/999/status')
      .send({ status: 'DONE' });
    expect(res.status).toBe(404);
  });

  test('修改后重新读取仍为最新状态（持久化）', async () => {
    await request(app).patch('/api/tasks/2/status').send({ status: 'DONE' });

    // 用一个全新 store 重新从文件读取，模拟“刷新页面”
    const reloaded = new TaskStore(tmpFile).load();
    expect(reloaded.find((t) => t.id === '2').status).toBe('DONE');
  });

  test('GET /api/tasks 返回任务列表', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
