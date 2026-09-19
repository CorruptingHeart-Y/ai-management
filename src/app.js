'use strict';

const path = require('node:path');
const express = require('express');

const { createDb } = require('./db');
const { createMembersRouter } = require('./routes/members');
const { createTasksRouter } = require('./routes/tasks');

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

  return app;
}

module.exports = { createApp };
