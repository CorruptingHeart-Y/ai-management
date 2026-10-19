'use strict';

/**
 * US07 minimum iteration contract. Dates and iteration management are out of scope.
 * @typedef {object} Iteration
 * @property {number} id Unique positive safe integer, referenced by Task.iterationId.
 * @property {string} name Nonblank display name.
 */
function validateIterations(iterations) {
  if (!Array.isArray(iterations)) return false;
  const ids = new Set();
  for (const iteration of iterations) {
    if (!iteration || !Number.isSafeInteger(iteration.id) || iteration.id <= 0 ||
        typeof iteration.name !== 'string' || !iteration.name.trim() ||
        ids.has(iteration.id)) {
      return false;
    }
    ids.add(iteration.id);
  }
  return true;
}

/** Validate before the shared task route writes anything. Do not coerce JSON types. */
function resolveIterationId(iterationId, iterations) {
  if (!validateIterations(iterations)) {
    throw new Error('Invalid iteration data');
  }
  if (iterationId === undefined || iterationId === null) return null;
  if (!Number.isSafeInteger(iterationId) || iterationId <= 0) {
    throw new TypeError('iterationId must be a positive safe integer or null');
  }
  if (!iterations.some((iteration) => iteration.id === iterationId)) {
    throw new RangeError('Iteration does not exist');
  }
  return iterationId;
}

module.exports = { validateIterations, resolveIterationId };
