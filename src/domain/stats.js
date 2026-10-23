'use strict';

/**
 * 任务统计领域逻辑（US10 状态统计）。
 *
 * 统计口径与《实验三_Task字段与接口契约》（朱传玺，2026-10-17）保持一致：
 *   - status：仅 TODO / DOING / DONE；缺失或非法一律按 TODO 计（与创建时的默认值一致），
 *     这样 byStatus 三项之和恒等于 total，前端不会出现“加起来对不上”的数。
 *   - priority：仅 HIGH / MEDIUM / LOW；缺失或非法按 MEDIUM 计（契约默认值）。
 *     ⚠ 契约把默认值定成 MEDIUM，意味着“用户没选”和“用户选了中”在统计上无法区分；
 *     是否改为 null 默认，已在契约评审意见中作为第 1 条提出，待计划会裁决。
 *   - iterationId：null / 空串 / 缺失 → 归入「未分配」；引用不存在的迭代 → 归入「未知迭代 #id」，
 *     不静默丢弃，便于暴露脏数据。
 *   - byAssignee：覆盖全部成员（含 0 任务的成员），负责人不存在的任务归入「未知成员 #id」。
 *
 * 纯函数：不读文件、不依赖 Express，便于单测与在别处复用（例如以后的导出功能）。
 */

const { VALID_STATUSES: STATUS_ORDER, VALID_PRIORITIES: PRIORITY_ORDER,
  DEFAULT_STATUS, DEFAULT_PRIORITY } = require('../../public/task-contract');
const UNASSIGNED_LABEL = '未分配';

/**
 * 把数字或数字字符串统一成整数；非数字原样返回，便于在「未知成员」里显示原始值。
 * @param {*} value
 * @returns {number|*}
 */
function toId(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}

/**
 * @param {*} value
 * @returns {'TODO'|'DOING'|'DONE'}
 */
function normalizeStatus(value) {
  return STATUS_ORDER.includes(value) ? value : DEFAULT_STATUS;
}

/**
 * @param {*} value
 * @returns {'HIGH'|'MEDIUM'|'LOW'}
 */
function normalizePriority(value) {
  if (typeof value !== 'string') return DEFAULT_PRIORITY;
  const upper = value.trim().toUpperCase();
  return PRIORITY_ORDER.includes(upper) ? upper : DEFAULT_PRIORITY;
}

/**
 * 迭代归属归一化：空值统一为 null（未分配）。
 * @param {*} value
 * @returns {number|null|*}
 */
function normalizeIterationId(value) {
  return toId(value);
}

/**
 * 生成统计结果。
 * @param {{members?: Array, tasks?: Array, iterations?: Array}} data createDb().readData() 的返回值
 * @returns {{
 *   total: number,
 *   byStatus: {TODO: number, DOING: number, DONE: number},
 *   byPriority: {HIGH: number, MEDIUM: number, LOW: number},
 *   byAssignee: Array<{memberId: any, name: string, role: string, count: number}>,
 *   byIteration: Array<{iterationId: any, name: string, count: number}>
 * }}
 */
function buildStats(data) {
  const members = Array.isArray(data && data.members) ? data.members : [];
  const tasks = Array.isArray(data && data.tasks) ? data.tasks : [];
  const iterations = Array.isArray(data && data.iterations) ? data.iterations : [];

  const byStatus = Object.fromEntries(STATUS_ORDER.map(status => [status, 0]));
  const byPriority = Object.fromEntries(PRIORITY_ORDER.map(priority => [priority, 0]));
  /** @type {Map<any, number>} */
  const assigneeCounts = new Map();
  /** @type {Map<any, number>} */
  const iterationCounts = new Map();

  // 先放成员与迭代，保证 0 任务的人/迭代也会出现在结果里（否则“谁手上没活”看不出来）
  for (const member of members) {
    assigneeCounts.set(toId(member.id), 0);
  }
  for (const iteration of iterations) {
    iterationCounts.set(toId(iteration.id), 0);
  }

  for (const task of tasks) {
    byStatus[normalizeStatus(task && task.status)] += 1;
    byPriority[normalizePriority(task && task.priority)] += 1;

    const assigneeKey = toId(task && task.assigneeId);
    assigneeCounts.set(assigneeKey, (assigneeCounts.get(assigneeKey) || 0) + 1);

    const iterationKey = normalizeIterationId(task && task.iterationId);
    iterationCounts.set(iterationKey, (iterationCounts.get(iterationKey) || 0) + 1);
  }

  const byAssignee = members.map((member) => {
    const key = toId(member.id);
    return {
      memberId: key,
      name: member.name,
      role: member.role || '',
      count: assigneeCounts.get(key) || 0,
    };
  });
  for (const [key, count] of assigneeCounts) {
    if (members.some((member) => toId(member.id) === key)) continue;
    byAssignee.push({
      memberId: key,
      name: `未知成员 #${key}`,
      role: '',
      count,
    });
  }

  const byIteration = [];
  // 「未分配」固定排第一，便于前端稳定渲染
  byIteration.push({
    iterationId: null,
    name: UNASSIGNED_LABEL,
    count: iterationCounts.get(null) || 0,
  });
  const sortedIterations = [...iterations].sort(
    (a, b) => Number(toId(a.id)) - Number(toId(b.id))
  );
  for (const iteration of sortedIterations) {
    const key = toId(iteration.id);
    byIteration.push({
      iterationId: key,
      name: iteration.name || `迭代 #${key}`,
      count: iterationCounts.get(key) || 0,
    });
  }
  for (const [key, count] of iterationCounts) {
    if (key === null) continue;
    if (iterations.some((iteration) => toId(iteration.id) === key)) continue;
    byIteration.push({ iterationId: key, name: `未知迭代 #${key}`, count });
  }

  return {
    total: tasks.length,
    byStatus,
    byPriority,
    byAssignee,
    byIteration,
  };
}

module.exports = {
  buildStats,
  normalizeStatus,
  normalizePriority,
  normalizeIterationId,
  STATUS_ORDER,
  PRIORITY_ORDER,
  DEFAULT_STATUS,
  DEFAULT_PRIORITY,
  UNASSIGNED_LABEL,
};
