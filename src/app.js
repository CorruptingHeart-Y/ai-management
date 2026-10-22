'use strict';

const path = require('node:path');
const express = require('express');

const { createDb } = require('./db');
const { createMembersRouter } = require('./routes/members');
const { createTasksRouter } = require('./routes/tasks');
const { createStatsRouter } = require('./routes/stats');
const { createIterationsRouter } = require('./routes/iterations');
const { createAuthRouter } = require('./routes/auth');
const { createPermissions } = require('./middleware/permissions');
const { createUsersRouter } = require('./routes/users');

/**
 * 创建 Express 应用。
 *
 * 抽出工厂函数的目的：测试时可以用临时 dataFile 创建独立实例，
 * 避免读写真实的 data/db.json。
 *
 * @param {object} [options]
 * @param {string} [options.dataFile] 数据文件路径，默认 data/db.json
 */
function buildApp({ dataFile, mountReadFeatures } = {}, secured) {
  const app = express();
  const db = createDb(dataFile || path.join(__dirname, '..', 'data', 'db.json'));

  app.use(express.json());

  const tokenStore = new Map();
  const permissions = createPermissions(db, tokenStore);
  // 登录/登出/me由US02自身检查会话；其余API先统一鉴权，新增路由也不可漏拦截。
  app.use('/api/auth', createAuthRouter(db, tokenStore));
  if (secured) {
    app.use('/api', permissions.requireSession, permissions.allowBusiness);
    app.use('/api/users', permissions.requireAdmin, createUsersRouter(db, tokenStore));
    if (mountReadFeatures) mountReadFeatures(app, db, permissions.readAccess);
  }
  // API鉴权在静态资源之前，避免未来public/api文件绕过API访问策略。
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/members', createMembersRouter(db));
  app.use('/api/tasks', createTasksRouter(db));
  app.use('/api/stats', createStatsRouter(db));
  // US07：迭代路由由共享应用入口挂载（PO 指定 src/app.js 出口为何健翔）
  app.use('/api/iterations', createIterationsRouter(db));

  if (secured) app.use('/api', (error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.status === 400 ? 400 : 500).json({
      error: error.status === 400 ? '请求数据格式错误' : '操作暂时无法完成，请稍后重试',
    });
  });

  return app;
}

// 旧嵌入工厂仅保留既有US01/US02回归契约；运行服务必须用createSecuredApp。
function createApp(options) { return buildApp(options, false); }
function createSecuredApp(options) { return buildApp(options, true); }
module.exports = { createApp, createSecuredApp };
