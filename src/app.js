'use strict';

const path = require('node:path');
const express = require('express');

const { createDb } = require('./db');
const { createMembersRouter } = require('./routes/members');
const { createTasksRouter } = require('./routes/tasks');
const { createStatsRouter } = require('./routes/stats');
const { createIterationsRouter } = require('./routes/iterations');
const { createAuthRouter } = require('./routes/auth');

/**
 * 创建 Express 应用。
 *
 * 抽出工厂函数的目的：测试时可以用临时 dataFile 创建独立实例，
 * 避免读写真实的 data/db.json。
 *
 * @param {object} [options]
 * @param {string} [options.dataFile] 数据文件路径，默认 data/db.json
 */
function createApp({ dataFile } = {}) {
  const app = express();
  const db = createDb(dataFile || path.join(__dirname, '..', 'data', 'db.json'));

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/members', createMembersRouter(db));
  app.use('/api/tasks', createTasksRouter(db));
  app.use('/api/stats', createStatsRouter(db));
  // US07：迭代路由由共享应用入口挂载（PO 指定 src/app.js 出口为何健翔）
  app.use('/api/iterations', createIterationsRouter(db));
  // US02：登录会话（token 存内存 Map，每个 app 实例独立，重启失效）
  const tokenStore = new Map();
  app.use('/api/auth', createAuthRouter(db, tokenStore));

  return app;
}

module.exports = { createApp };
