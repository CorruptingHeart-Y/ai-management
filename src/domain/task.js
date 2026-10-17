// Task 领域逻辑（US05 更新任务状态、US06 任务优先级与截止时间）
// 统一任务状态与优先级字段，与工作安排第二节「统一数据约定」保持一致。

// 任务状态枚举：只允许三种状态
const TASK_STATUS = {
  TODO: 'TODO',
  DOING: 'DOING',
  DONE: 'DONE',
};

// 状态对应的中文显示文案
const STATUS_LABELS = {
  TODO: '待办',
  DOING: '进行中',
  DONE: '已完成',
};

// 所有合法状态值
const VALID_STATUSES = [TASK_STATUS.TODO, TASK_STATUS.DOING, TASK_STATUS.DONE];

/**
 * 判断某个状态是否合法。
 * @param {string} status 待校验的状态
 * @returns {boolean} 是否合法
 */
function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

/**
 * 更新任务状态（US05 核心逻辑）。
 * 不修改原任务对象，返回一个状态已更新的新任务对象。
 * 非法状态会抛出异常，从而在保存前被拒绝。
 * @param {object} task 原任务
 * @param {string} newStatus 目标状态
 * @returns {object} 更新后的任务
 */
function updateTaskStatus(task, newStatus) {
  if (!isValidStatus(newStatus)) {
    throw new Error(
      `非法任务状态: ${newStatus}，仅支持 ${VALID_STATUSES.join('/')}`
    );
  }
  return { ...task, status: newStatus };
}

// 任务优先级枚举（US06）：只允许三种优先级，缺省为中
const TASK_PRIORITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

// 优先级对应的中文显示文案
const PRIORITY_LABELS = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

// 所有合法优先级值
const VALID_PRIORITIES = [TASK_PRIORITY.HIGH, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.LOW];

// 新建任务时的缺省优先级
const DEFAULT_PRIORITY = TASK_PRIORITY.MEDIUM;

/**
 * 判断某个优先级是否合法。
 * @param {string} priority 待校验的优先级
 * @returns {boolean} 是否合法
 */
function isValidPriority(priority) {
  return VALID_PRIORITIES.includes(priority);
}

/**
 * 校验截止时间是否为合法日期字符串。
 * 只接受 YYYY-MM-DD 且为真实日历日期（2026-02-31 这类会被拒绝）。
 * 空值（null/undefined/空串）由调用方归一化为 null，本函数只校验非空字符串。
 * @param {string} dueDate 待校验的截止时间
 * @returns {boolean} 是否合法
 */
function isValidDueDate(dueDate) {
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return false;
  }
  const [year, month, day] = dueDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

module.exports = {
  TASK_STATUS,
  STATUS_LABELS,
  VALID_STATUSES,
  isValidStatus,
  updateTaskStatus,
  TASK_PRIORITY,
  PRIORITY_LABELS,
  VALID_PRIORITIES,
  DEFAULT_PRIORITY,
  isValidPriority,
  isValidDueDate,
};
