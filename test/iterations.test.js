'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createIterationsRouter } = require('../src/routes/iterations');
const { validateIterations, resolveIterationId } = require('../src/domain/iteration');
const { ALL, UNASSIGNED, filterTasks, groupTasks } = require('../public/iterations');

// Isolated router contract tests: deliberately do not replace or patch createDb/createApp.
async function startRouter(t, db) {
  const app = express();
  app.use('/api/iterations', createIterationsRouter(db));
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
  }));
  return `http://127.0.0.1:${server.address().port}/api/iterations`;
}

test('US07 isolated list: shared source, empty/legacy data, no cache or writes', async (t) => {
  let data = { iterations: [{ id: 1, name: 'Sprint 1' }, { id: 2, name: 'Sprint 2' }] };
  let reads = 0;
  let writes = 0;
  const url = await startRouter(t, {
    readData() { reads += 1; return data; },
    writeData() { writes += 1; },
  });
  for (const sample of [data, { iterations: [] }, {}, {
    iterations: [{ id: 3, name: 'Sprint 3' }], tasks: [{ id: 4 }],
  }]) {
    data = sample;
    const before = JSON.stringify(data);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), data.iterations || []);
    assert.equal(JSON.stringify(data), before);
  }
  assert.equal(reads, 4);
  assert.equal(writes, 0);
});

test('US07 isolated list: bad entities and read failures return JSON 500 without writes', async (t) => {
  let data;
  let failure;
  let writes = 0;
  const url = await startRouter(t, {
    readData() { if (failure) throw failure; return data; },
    writeData() { writes += 1; },
  });
  const invalid = [null, {}, [null], new Array(1), [{ id: 1 }],
    [{ id: 1, name: ' ' }], [{ id: 1, name: 'A' }, { id: 1, name: 'B' }]];
  for (const id of [0, -1, 1.5, '1', true, Number.MAX_SAFE_INTEGER + 1]) {
    invalid.push([{ id, name: 'Bad id' }]);
  }
  for (const iterations of invalid) {
    data = { iterations };
    const before = JSON.stringify(data);
    const response = await fetch(url);
    assert.equal(response.status, 500);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal((await response.json()).error, 'Invalid iteration data');
    assert.equal(JSON.stringify(data), before);
  }
  failure = new Error('private disk path should not escape');
  const response = await fetch(url);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unable to read iterations' });
  assert.equal(writes, 0);
});

test('US07 domain: nullable/existing numeric references only, without input mutation', () => {
  const iterations = Object.freeze([
    Object.freeze({ id: 1, name: 'Sprint 1' }),
    Object.freeze({ id: 2, name: 'Sprint 2' }),
  ]);
  assert.equal(validateIterations(iterations), true);
  assert.equal(validateIterations([]), true);
  assert.equal(resolveIterationId(undefined, iterations), null);
  assert.equal(resolveIterationId(null, []), null);
  assert.equal(resolveIterationId(2, iterations), 2);
  for (const invalid of ['', '1', false, true, 0, -1, 1.5, NaN, Infinity,
    Number.MAX_SAFE_INTEGER + 1, {}, []]) {
    assert.throws(() => resolveIterationId(invalid, iterations), TypeError);
  }
  assert.throws(() => resolveIterationId(3, iterations), RangeError);
  assert.throws(() => resolveIterationId(1, []), RangeError);
  assert.throws(() => resolveIterationId(null, null), /Invalid iteration data/);
  assert.deepEqual(iterations, [{ id: 1, name: 'Sprint 1' }, { id: 2, name: 'Sprint 2' }]);
});

test('US07 view: filter/group known, unassigned and orphan tasks without changing fields', () => {
  const iterations = Object.freeze([
    Object.freeze({ id: 2, name: 'Sprint 2' }),
    Object.freeze({ id: 1, name: 'Sprint 1' }),
    Object.freeze({ id: 3, name: 'Empty sprint' }),
  ]);
  const tasks = Object.freeze([
    Object.freeze({ id: 1, iterationId: 1, status: 'DOING', priority: 'HIGH', dueDate: '2026-10-20' }),
    Object.freeze({ id: 2, status: 'TODO' }),
    Object.freeze({ id: 3, iterationId: 2, status: 'DONE' }),
    Object.freeze({ id: 4, iterationId: null, status: 'TODO' }),
    Object.freeze({ id: 5, iterationId: 99, status: 'TODO' }),
    Object.freeze({ id: 6, iterationId: 1, status: 'DONE' }),
  ]);
  const before = JSON.stringify({ tasks, iterations });
  assert.deepEqual(filterTasks(tasks), tasks);
  assert.notEqual(filterTasks(tasks, ALL), tasks);
  assert.deepEqual(filterTasks(tasks, UNASSIGNED), [tasks[1], tasks[3]]);
  assert.deepEqual(filterTasks(tasks, 1), [tasks[0], tasks[5]]);
  assert.deepEqual(filterTasks(tasks, 99), [tasks[4]]);
  assert.deepEqual(filterTasks(tasks, 3), []);
  for (const invalid of ['1', '', null, 0, true]) {
    assert.throws(() => filterTasks(tasks, invalid), TypeError);
  }
  assert.deepEqual(groupTasks(tasks, iterations), [
    { iterationId: 2, name: 'Sprint 2', missing: false, tasks: [tasks[2]] },
    { iterationId: 1, name: 'Sprint 1', missing: false, tasks: [tasks[0], tasks[5]] },
    { iterationId: null, name: null, missing: false, tasks: [tasks[1], tasks[3]] },
    { iterationId: 99, name: null, missing: true, tasks: [tasks[4]] },
  ]);
  assert.deepEqual(groupTasks([], iterations), []);
  assert.equal(groupTasks(tasks, iterations)[1].tasks[0], tasks[0]);
  assert.equal(JSON.stringify({ tasks, iterations }), before);
});
