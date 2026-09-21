'use strict';

const express = require('express');
const { validateMembers } = require('../domain/member');

/**
 * 成员路由（对应 US01 查看项目成员的后端部分）。
 *
 * 成员页面和 US04 负责人选择共用此只读接口。
 * 数据始终来自 db.readData()，不在路由内复制预置数据；
 * 成员维护和权限管理属于后续 Sprint。
 *
 * @param {object} db createDb 返回的数据访问对象
 */
function createMembersRouter(db) {
  const router = express.Router();

  // GET /api/members —— 返回全部项目成员
  router.get('/', (req, res) => {
    // 禁止缓存旧成员选项，保证页面刷新后读取当前共享数据。
    res.set('Cache-Control', 'no-store');
    try {
      const { members } = db.readData();
      if (!validateMembers(members)) {
        return res.status(500).json({ error: '成员数据格式错误，请检查项目数据文件' });
      }
      return res.json(members);
    } catch {
      // 不用另一份假成员数据掩盖文件读取故障。
      return res.status(500).json({ error: '成员列表暂时无法读取，请稍后重试' });
    }
  });

  return router;
}

module.exports = { createMembersRouter };
