'use strict';

// Isolated localhost preview only. Production mounting stays with the shared-file owner.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { createDb, SEED_MEMBERS } = require('../src/db');
const { mountTaskFilters } = require('../src/features/task-filters');
const { localDate } = require('../src/domain/task-filter');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-management-filter-preview-'));
const dataFile = path.join(root, 'db.json');
const date = new Date();
const day = (offset) => {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12);
  return localDate(value);
};
const iterations = [{ id: 1, name: 'Sprint 1' }, { id: 2, name: 'Sprint 2' }, { id: 3, name: 'Sprint 3' }];
const samples = [
  ['完成迭代归属验收', '核对任务归属与刷新后的数据一致性。', 1, 'DOING', 'HIGH', -2, 2],
  ['任务筛选与逾期提醒', '组合状态、负责人和优先级核对查询结果。', 1, 'DOING', 'HIGH', 0, 3],
  ['登录会话联调', '确认登录、登出和会话失效链路。', 2, 'TODO', 'HIGH', 1, 3],
  ['发布就绪检查', '整理端到端测试与发布证据。', 4, 'TODO', 'MEDIUM', -1, 3],
  ['Sprint 1 成员列表', '旧功能回归已完成。', 1, 'DONE', 'MEDIUM', -10, 1],
  ['基础权限复核', '检查成员角色和越权请求。', 3, 'TODO', 'HIGH', 2, 3],
  ['项目价值兑现说明', '对照已交付的故事和发布边界。', 1, 'TODO', 'LOW', null, null],
  ['补充异常路径测试', '失败后重试，保留原始数据。', 4, 'DOING', 'MEDIUM', -3, 2],
];
const tasks = samples.map(([title, description, assigneeId, status, priority, due, iterationId], index) => ({
  id: index + 1, title, description, assigneeId, status, priority,
  dueDate: due === null ? null : day(due), iterationId, createdAt: date.toISOString(),
}));
fs.writeFileSync(dataFile, JSON.stringify({ members: SEED_MEMBERS, iterations, tasks }, null, 2));
const app = createApp({ dataFile });
mountTaskFilters(app, createDb(dataFile), (req, res, next) => next());
const port = process.env.PORT === undefined ? 3107 : Number(process.env.PORT);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({
    url: `http://127.0.0.1:${server.address().port}/task-filters.html`,
    mode: 'LOCAL_PREVIEW_ONLY_NO_AUTH', dataFile,
    note: 'Temporary demo data; production files unchanged. Not a release or permission acceptance.',
  }));
});
server.on('error', (error) => { fs.rmSync(root, { recursive: true, force: true }); throw error; });
function stop() {
  server.close(() => { fs.rmSync(root, { recursive: true, force: true }); process.exit(0); });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
