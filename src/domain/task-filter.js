'use strict';

const { VALID_STATUSES, VALID_PRIORITIES, isValidDueDate } = require('./task');

const FILTER_NAMES = new Set(['status', 'priority', 'assigneeId', 'iterationId', 'overdue', 'q']);

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new TypeError('Invalid task query');
  }
  return Number(value);
}

/** Accept raw URL parameters as well as Express query objects; never coerce arrays or objects. */
function parseTaskFilters(query = {}) {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) {
    throw new TypeError('Invalid task query');
  }
  const entries = query instanceof URLSearchParams ? query.entries() : Object.entries(query);
  const filters = {};
  const seen = new Set();
  for (const [name, value] of entries) {
    if (!FILTER_NAMES.has(name) || seen.has(name) || typeof value !== 'string') {
      throw new TypeError('Invalid task query');
    }
    seen.add(name);
    switch (name) {
      case 'status':
        if (!VALID_STATUSES.includes(value)) throw new TypeError('Invalid task query');
        filters.status = value;
        break;
      case 'priority':
        if (!VALID_PRIORITIES.includes(value)) throw new TypeError('Invalid task query');
        filters.priority = value;
        break;
      case 'assigneeId':
        filters.assigneeId = parseId(value);
        break;
      case 'iterationId':
        filters.iterationId = value === 'unassigned' ? null : parseId(value);
        break;
      case 'overdue':
        if (value !== 'true' && value !== 'false') throw new TypeError('Invalid task query');
        filters.overdue = value === 'true';
        break;
      case 'q':
        filters.q = value.trim();
        if (Array.from(filters.q).length > 100) throw new TypeError('Invalid task query');
        break;
    }
  }
  return filters;
}

function localDate(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('Invalid query clock');
  }
  const year = now.getFullYear();
  if (year < 100 || year > 9999) throw new RangeError('Invalid query clock');
  return `${String(year).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isOverdue(task, today = localDate()) {
  return Boolean(task && task.status !== 'DONE' &&
    isValidDueDate(task.dueDate) && task.dueDate < today);
}

/** Reject unusable records without attempting a database migration or repairing stored fields. */
function validateTasks(tasks) {
  if (!Array.isArray(tasks)) return false;
  const ids = new Set();
  for (const task of tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task) ||
      !Number.isSafeInteger(task.id) || task.id <= 0 || ids.has(task.id) ||
      typeof task.title !== 'string' || !task.title.trim()) return false;
    ids.add(task.id);
  }
  return true;
}

function legacyValue(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}

/** Missing legacy fields affect matching only; result rows retain their original fields and order. */
function queryTasks(tasks, filters = {}, now = new Date()) {
  if (!validateTasks(tasks)) throw new TypeError('Invalid task data');
  const today = localDate(now);
  const q = (filters.q || '').toLowerCase();
  const matched = tasks.filter((task) => {
    if (filters.status !== undefined && legacyValue(task.status, 'TODO') !== filters.status) return false;
    if (filters.priority !== undefined && legacyValue(task.priority, 'MEDIUM') !== filters.priority) return false;
    if (filters.assigneeId !== undefined && task.assigneeId !== filters.assigneeId) return false;
    if (filters.iterationId !== undefined &&
      (task.iterationId === undefined ? null : task.iterationId) !== filters.iterationId) return false;
    if (filters.overdue !== undefined && isOverdue(task, today) !== filters.overdue) return false;
    if (q && !task.title.toLowerCase().includes(q) &&
      !(typeof task.description === 'string' && task.description.toLowerCase().includes(q))) return false;
    return true;
  });
  return {
    tasks: matched,
    total: tasks.length,
    matched: matched.length,
    today,
    overdueCount: tasks.filter((task) => isOverdue(task, today)).length,
  };
}

module.exports = { parseTaskFilters, localDate, isOverdue, validateTasks, queryTasks };
