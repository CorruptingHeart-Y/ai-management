'use strict';

/**
 * 项目成员的共享数据约定（US01 / US04）。
 * role 表示实验一确定的团队分工，不是登录权限或本轮 DRI 身份。
 * id 一经使用应保持稳定，Task.assigneeId 引用同一个数字 id。
 *
 * @typedef {object} Member
 * @property {number} id 唯一的正安全整数
 * @property {string} name 非空成员姓名
 * @property {string} role 非空团队分工
 */

/** 检查 API 输出的数据契约；空列表合法，重复 id 和不完整记录不合法。 */
function validateMembers(members) {
  if (!Array.isArray(members)) return false;
  const ids = new Set();
  return members.every((member) => {
    if (!member || !Number.isSafeInteger(member.id) || member.id <= 0 ||
        typeof member.name !== 'string' || !member.name.trim() ||
        typeof member.role !== 'string' || !member.role.trim() ||
        ids.has(member.id)) {
      return false;
    }
    ids.add(member.id);
    return true;
  });
}

module.exports = { validateMembers };
