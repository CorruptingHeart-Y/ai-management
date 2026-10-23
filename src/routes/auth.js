'use strict';

const express = require('express');
const crypto = require('node:crypto');
const { SEED_USERS, verifyPassword, validateUser } = require('../domain/user');

/**
 * 认证路由（US02 登录的后端部分）。
 *
 * 只做登录 / 登出 / 会话 / 凭证校验，**不挂全局鉴权拦截**（那是 US03）。
 * token 存内存 Map（进程内，重启失效），预置账号在首次登录时惰性写入 db.json，
 * 不改 ensureInitialized 的默认结构，保证无登录流程的既有测试不写 users。
 *
 * @param {object} db createDb 返回的数据访问对象
 * @param {Map} tokenStore token → userId 的内存映射（每个 app 实例独立）
 */
function createAuthRouter(db, tokenStore) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  function getBearerToken(req) {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match ? match[1] : null;
  }

  /** 读取账号列表；文件里还没有 users 集合时惰性写入预置账号。 */
  function readUsers() {
    let data = db.readData();
    if (!Array.isArray(data.users)) {
      data = { ...data, users: SEED_USERS };
      db.writeData(data);
    }
    return data.users;
  }

  // POST /api/auth/login —— 校验凭证、签发 token
  router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() ||
        typeof password !== 'string' || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    try {
      const users = readUsers();
      const user = users.find((u) => u.username === username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }
      const token = crypto.randomBytes(32).toString('hex');
      tokenStore.set(token, user.id);
      return res.json({ token, id: user.id, username: user.username, role: user.role });
    } catch {
      return res.status(500).json({ error: '登录暂时无法处理，请稍后重试' });
    }
  });

  // POST /api/auth/logout —— 清除当前 token
  router.post('/logout', (req, res) => {
    const token = getBearerToken(req);
    if (!token || !tokenStore.has(token)) {
      return res.status(401).json({ error: '未登录或登录已失效' });
    }
    tokenStore.delete(token);
    return res.json({ ok: true });
  });

  // GET /api/auth/me —— 返回当前登录用户
  router.get('/me', (req, res) => {
    const token = getBearerToken(req);
    const userId = token ? tokenStore.get(token) : undefined;
    if (!userId) {
      return res.status(401).json({ error: '未登录或登录已失效' });
    }
    try {
      const { users } = db.readData();
      const user = (users || []).find((u) => u.id === userId);
      if (!user || !validateUser(user)) {
        return res.status(401).json({ error: '用户不存在或数据异常' });
      }
      return res.json({ id: user.id, username: user.username, role: user.role });
    } catch {
      return res.status(500).json({ error: '会话暂时无法读取，请稍后重试' });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
