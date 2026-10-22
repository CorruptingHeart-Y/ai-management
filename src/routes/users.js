'use strict';
const express = require('express');
const { isValidRole } = require('../domain/user');
const { validAccounts, publicUser } = require('../middleware/permissions');

function createUsersRouter(db, tokenStore) {
  const router = express.Router();
  router.get('/', (req, res) => {
    try {
      const { users } = db.readData();
      if (!validAccounts(users)) throw new Error('Invalid accounts');
      res.json(users.map(publicUser));
    } catch {
      res.status(500).json({ error: '账号列表暂时无法读取' });
    }
  });
  router.patch('/:id/role', (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id) ||
        !body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !isValidRole(body.role)) {
      return res.status(400).json({ error: '账号编号或角色无效，仅支持admin/member' });
    }
    try {
      let changed = false;
      let result;
      db.updateData(data => {
        if (!validAccounts(data.users)) throw new Error('Invalid accounts');
        const user = data.users.find(item => item.id === id);
        if (!user) throw Object.assign(new Error('账号不存在'), { status: 404 });
        if (user.role === body.role) { result = publicUser(user); return false; }
        if (user.role === 'admin' && body.role !== 'admin' &&
            data.users.filter(item => item.role === 'admin').length === 1) {
          throw Object.assign(new Error('不能移除最后一名管理员'), { status: 409 });
        }
        user.role = body.role;
        result = publicUser(user);
        changed = true;
      });
      // 仅持久化成功后撤销目标用户全部会话；失败时不伪称已改角色。
      if (changed) for (const [token, userId] of tokenStore) if (userId === id) tokenStore.delete(token);
      return res.json({ ...result, sessionsRevoked: changed });
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.status ? error.message : '角色更新失败，原数据未提交',
      });
    }
  });
  return router;
}
module.exports = { createUsersRouter };
