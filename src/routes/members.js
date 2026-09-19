'use strict';

const express = require('express');

/**
 * 成员路由（对应 US01 查看项目成员的后端部分）。
 *
 * 本任务先把“统一成员数据来源”建好：返回预置成员列表，
 * 供 US04 创建任务时的负责人下拉选择使用。
 * US01 若需扩展字段或维护能力，可直接在此基础上增量开发。
 *
 * @param {object} db createDb 返回的数据访问对象
 */
function createMembersRouter(db) {
  const router = express.Router();

  // GET /api/members —— 返回全部项目成员
  router.get('/', (req, res) => {
    const { members } = db.readData();
    res.json(members);
  });

  return router;
}

module.exports = { createMembersRouter };
