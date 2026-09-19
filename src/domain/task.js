// Task 领域逻辑（US05 更新任务状态）
// 统一任务状态字段，与工作安排第二节「统一数据约定」保持一致。

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

module.exports = {
  TASK_STATUS,
  STATUS_LABELS,
  VALID_STATUSES,
  isValidStatus,
  updateTaskStatus,
};
