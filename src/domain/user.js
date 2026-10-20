'use strict';

/**
 * 登录账号的共享数据约定（US02 登录）。
 *
 * 与 Member 的区别：Member.role 是实验一团队分工（如「技术与架构负责人」），
 * 这里的 User.role 是**权限角色**（admin / member），两者是不同概念，不复用。
 * 账号独立于 Member，US02 不强制关联 memberId。
 *
 * 密码不存明文：以 scrypt 哈希 + 随机盐存储，格式 `salt:hash`（均为 hex）。
 * 预置账号的初始明文密码只在计划会纪要表 2 / README 记录，代码与 data/db.json 只存哈希。
 *
 * @typedef {object} User
 * @property {number} id 唯一的正安全整数
 * @property {string} username 非空登录名
 * @property {string} passwordHash scrypt 哈希，格式 `salt:hash`
 * @property {'admin'|'member'} role 权限角色
 */

const crypto = require('node:crypto');

const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
};

const VALID_ROLES = [USER_ROLES.ADMIN, USER_ROLES.MEMBER];

/** 判断权限角色是否合法。 */
function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

/** scrypt 哈希密码；未传 salt 时随机生成。返回 `salt:hash`。 */
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return `${s}:${hash}`;
}

/** 校验密码是否匹配存储的 `salt:hash`。 */
function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const idx = stored.indexOf(':');
  if (idx < 0) return false;
  const salt = stored.slice(0, idx);
  const expected = stored.slice(idx + 1);
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, 'hex');
  return expectedBuf.length === actual.length &&
    crypto.timingSafeEqual(actual, expectedBuf);
}

/** 校验 API 输出/写入的账号结构。 */
function validateUser(user) {
  return !!user &&
    Number.isSafeInteger(user.id) && user.id > 0 &&
    typeof user.username === 'string' && user.username.trim() !== '' &&
    typeof user.passwordHash === 'string' && user.passwordHash.indexOf(':') > 0 &&
    isValidRole(user.role);
}

// 预置账号（US02 登录用）。passwordHash 为预计算的 scrypt `salt:hash`，不含明文。
// 教学演示凭证见计划会纪要表 2；生产源码仅保留预计算哈希。
const SEED_USERS = [
  {
    id: 1,
    username: 'admin',
    passwordHash: '44f5be390147c4b577c5332a9952e123:d3494d2d578f012d99ccdb7a66931024f2ed880fc70e036f2dcdb206543b5244ba04d874a3f87d96c6863de714d37c74cef20a357d04e0ad9a40f6b25bbfce9f',
    role: USER_ROLES.ADMIN,
  },
  {
    id: 2,
    username: 'pengjiacheng',
    passwordHash: 'f678b70942ba5fbf9a00bf9bed5e4147:3c65c588f7dc2bcd75898a53505dd4a59561279998ad0459b7db40f9ede67f52c129af29e8c9947d1250e22ddde816f543472661b263defbf3810d1bb04b3f60',
    role: USER_ROLES.MEMBER,
  },
  {
    id: 3,
    username: 'yanghaowei',
    passwordHash: '638ae750a0d8a5cad02d899e6cb304f7:e8336f7a184b917e61568cb36f72bb14548b167342a0298965e6bbd4dec3b49f88f5fa3bb22943fbfac9f20435b4c5bcc73df514b5820fb6c55d9422913693ce',
    role: USER_ROLES.MEMBER,
  },
  {
    id: 4,
    username: 'hejianxiang',
    passwordHash: 'bc1bfc33650f9bc6b725d9c3d931d43c:0eb712d2f89f39ac9eb59362c8a33661ddbd1dc3536b3da15361be103973492f4f1e7fdf7d40180737259049338643531adc8cb70103f14dd491379ae10ab979',
    role: USER_ROLES.MEMBER,
  },
];

module.exports = {
  USER_ROLES,
  VALID_ROLES,
  isValidRole,
  hashPassword,
  verifyPassword,
  validateUser,
  SEED_USERS,
};
