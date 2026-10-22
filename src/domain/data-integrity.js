'use strict';
const { validateMembers } = require('./member');
const { validateIterations } = require('./iteration');
const { isValidStatus, isValidPriority, isValidDueDate } = require('./task');
const { validateUser } = require('./user');
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const absent = value => value === undefined || value === null || value === '';

// Legacy tasks may lack optional Sprint 2 fields. Existing orphan references may
// be inspected (stats names them), but no write may perpetuate invalid references.
function validateData(data, { references = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !Array.isArray(data.tasks) ||
      ('iterations' in data && !validateIterations(data.iterations))) throw new Error('Invalid data structure');
  if (!validateMembers(data.members)) throw Object.assign(new Error('Invalid members'), { code: 'INVALID_MEMBERS' });
  if ('users' in data && (!Array.isArray(data.users) || !data.users.every(validateUser) ||
      new Set(data.users.map(x => x.id)).size !== data.users.length ||
      new Set(data.users.map(x => x.username)).size !== data.users.length)) throw new Error('Invalid accounts');
  const ids = new Set();
  for (const task of data.tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task) ||
        !positiveId(task.id) || ids.has(task.id) || typeof task.title !== 'string' || !task.title.trim() ||
        !positiveId(task.assigneeId) ||
        (task.description !== undefined && typeof task.description !== 'string') ||
        (!absent(task.status) && !isValidStatus(task.status)) ||
        (!absent(task.priority) && !isValidPriority(task.priority)) ||
        (!absent(task.dueDate) && !isValidDueDate(task.dueDate)) ||
        (!absent(task.iterationId) && !positiveId(task.iterationId)) ||
        (task.createdAt !== undefined && (typeof task.createdAt !== 'string' || !Number.isFinite(Date.parse(task.createdAt))))) {
      throw new Error('Invalid task data');
    }
    ids.add(task.id);
    if (references && (!data.members.some(x => x.id === task.assigneeId) ||
        (!absent(task.iterationId) && !(data.iterations || []).some(x => x.id === task.iterationId)))) {
      throw new Error('Invalid task reference');
    }
  }
  return data;
}
module.exports = { validateData };
