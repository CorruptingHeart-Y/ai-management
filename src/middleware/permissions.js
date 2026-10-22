'use strict';
const { validateUser } = require('../domain/user');

function validAccounts(users) {
  return Array.isArray(users) && users.every(validateUser) &&
    new Set(users.map(user => user.id)).size === users.length &&
    new Set(users.map(user => user.username)).size === users.length;
}
const publicUser = ({ id, username, role }) => ({ id, username, role });

/** 每次从持久数据读取角色，绝不信任请求中的role或将User.id当Member.id。 */
function createPermissions(db, tokenStore) {
  function requireSession(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const match = /^Bearer\s+([^\s]+)$/i.exec(req.headers.authorization || '');
    const id = match ? tokenStore.get(match[1]) : undefined;
    if (!id) return res.status(401).json({ error: '请先登录或重新登录' });
    try {
      const { users } = db.readData();
      if (!validAccounts(users)) return res.status(500).json({ error: '账号数据异常，请联系管理员' });
      const user = users.find(item => item.id === id);
      if (!user) return res.status(401).json({ error: '登录账号已失效' });
      req.currentUser = publicUser(user);
      next();
    } catch {
      return res.status(500).json({ error: '暂时无法验证登录状态' });
    }
  }
  function requireAdmin(req, res, next) {
    if (req.currentUser?.role !== 'admin') return res.status(403).json({ error: '当前角色无权执行此操作' });
    next();
  }
  function allowBusiness(req, res, next) {
    if (['GET', 'HEAD'].includes(req.method)) return next();
    return requireAdmin(req, res, next);
  }
  function readAccess(req, res, next) {
    return requireSession(req, res, next);
  }
  return { requireSession, requireAdmin, allowBusiness, readAccess };
}
module.exports = { createPermissions, validAccounts, publicUser };
