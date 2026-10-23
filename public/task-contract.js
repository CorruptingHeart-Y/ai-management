'use strict';
// Shared, read-only task vocabulary for Node and the three browser pages.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TaskContract = factory();
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const TASK_STATUS = Object.freeze({ TODO: 'TODO', DOING: 'DOING', DONE: 'DONE' });
  const STATUS_LABELS = Object.freeze({ TODO: '待办', DOING: '进行中', DONE: '已完成' });
  const TASK_PRIORITY = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });
  const PRIORITY_LABELS = Object.freeze({ HIGH: '高', MEDIUM: '中', LOW: '低' });
  return Object.freeze({ TASK_STATUS, STATUS_LABELS, TASK_PRIORITY, PRIORITY_LABELS,
    VALID_STATUSES: Object.freeze(Object.values(TASK_STATUS)),
    VALID_PRIORITIES: Object.freeze(Object.values(TASK_PRIORITY)),
    DEFAULT_STATUS: TASK_STATUS.TODO, DEFAULT_PRIORITY: TASK_PRIORITY.MEDIUM });
});
