'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const express = require('express');
const { createDb } = require('../src/db');
const { createApp } = require('../src/app');
const { createTaskQueryRouter } = require('../src/routes/task-query');
const { parseTaskFilters, localDate, isOverdue, validateTasks, queryTasks } = require('../src/domain/task-filter');
const { makeTempDataFile } = require('./helpers');

const NOW = new Date(2026, 9, 21, 0, 5);
const clock = () => new Date(NOW.getTime());
const ROWS = [
  { id: 1, title: 'Alpha [API]', description: 'Needle in a description', status: 'TODO', priority: 'HIGH', assigneeId: 1, iterationId: 2, dueDate: '2026-10-20' },
  { id: 2, title: 'Beta', description: 'ALPHA', status: 'DOING', priority: 'LOW', assigneeId: 2, iterationId: 2, dueDate: '2026-10-21' },
  { id: 3, title: 'Done', status: 'DONE', priority: 'HIGH', assigneeId: 1, iterationId: null, dueDate: '2026-10-19' },
  { id: 4, title: 'Legacy', assigneeId: 1 },
  { id: 5, title: 'Future', status: 'TODO', priority: 'MEDIUM', assigneeId: 2, iterationId: 3, dueDate: '2026-10-22' },
];

async function listen(t, app) {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function startRouter(t, db, middleware = []) {
  const app = express();
  app.use('/api/task-query', ...middleware, createTaskQueryRouter(db, { clock }));
  return `${await listen(t, app)}/api/task-query`;
}

function ids(result) { return result.tasks.map((task) => task.id); }

test('US11 parser accepts documented scalar filters and trims literal keyword searches', () => {
  assert.deepEqual(parseTaskFilters(new URLSearchParams({
    status: 'TODO', priority: 'HIGH', assigneeId: '1', iterationId: 'unassigned', overdue: 'false', q: '  Alpha [API]  ',
  })), { status: 'TODO', priority: 'HIGH', assigneeId: 1, iterationId: null, overdue: false, q: 'Alpha [API]' });
  assert.deepEqual(parseTaskFilters({ iterationId: '2' }), { iterationId: 2 });
  assert.deepEqual(parseTaskFilters({ q: '   ' }), { q: '' });
  assert.equal(parseTaskFilters({ q: 'x'.repeat(100) }).q.length, 100);
});

test('US11 parser rejects unknown, repeated, nested and non-scalar parameters', () => {
  for (const query of [null, [], 'status=TODO', { unknown: '1' }, { status: ['TODO'] },
    { status: { value: 'TODO' } }, { q: 1 }, { overdue: true },
    new URLSearchParams('status=TODO&status=TODO'), new URLSearchParams('q=a&q=b'),
    new URLSearchParams('status[]=TODO'), new URLSearchParams('q[x]=a')]) {
    assert.throws(() => parseTaskFilters(query), TypeError);
  }
});

test('US11 parser rejects invalid enums, ids, booleans and long keywords', () => {
  for (const query of [{ status: 'todo' }, { status: '' }, { priority: 'URGENT' }, { priority: 'high' },
    { overdue: '1' }, { overdue: 'TRUE' }, { overdue: '' }, { q: 'x'.repeat(101) }]) {
    assert.throws(() => parseTaskFilters(query), TypeError);
  }
  for (const value of ['', '0', '-1', '1.5', '1e2', '01', '+1', ' 1 ', 'Infinity', '9007199254740992']) {
    assert.throws(() => parseTaskFilters({ assigneeId: value }), TypeError);
    assert.throws(() => parseTaskFilters({ iterationId: value }), TypeError);
  }
  assert.equal(parseTaskFilters({ assigneeId: '9007199254740991' }).assigneeId, Number.MAX_SAFE_INTEGER);
});

test('US11 combines every filter with AND and keeps full-source counters', () => {
  const filters = parseTaskFilters({ status: 'TODO', priority: 'HIGH', assigneeId: '1', iterationId: '2', overdue: 'true', q: 'needle' });
  const result = queryTasks(ROWS, filters, clock());
  assert.deepEqual(ids(result), [1]);
  assert.deepEqual({ total: result.total, matched: result.matched, today: result.today, overdueCount: result.overdueCount },
    { total: 5, matched: 1, today: '2026-10-21', overdueCount: 1 });
  assert.deepEqual(ids(queryTasks(ROWS, { ...filters, assigneeId: 2 }, clock())), []);
  for (const filters of [{ assigneeId: 99 }, { iterationId: 99 }]) {
    assert.equal(queryTasks(ROWS, filters, clock()).matched, 0);
  }
});

test('US11 keywords are literal and case-insensitive in title or description', () => {
  for (const [q, expected] of [['alpha', [1, 2]], ['[API]', [1]], ['.*', []], ['needle', [1]], ['', [1, 2, 3, 4, 5]]]) {
    assert.deepEqual(ids(queryTasks(ROWS, { q }, clock())), expected);
  }
});

test('US11 legacy defaults and unassigned matching preserve original task objects', () => {
  const tasks = ROWS.map((task) => Object.freeze({ ...task }));
  Object.freeze(tasks);
  const before = JSON.stringify(tasks);
  const result = queryTasks(tasks, { status: 'TODO', priority: 'MEDIUM', iterationId: null }, clock());
  assert.deepEqual(ids(result), [4]);
  assert.equal(result.tasks[0], tasks[3]);
  assert.equal(Object.hasOwn(result.tasks[0], 'status'), false);
  assert.equal(Object.hasOwn(result.tasks[0], 'priority'), false);
  const all = queryTasks(tasks, {}, clock());
  assert.notEqual(all.tasks, tasks);
  assert.deepEqual(all.tasks, tasks);
  assert.equal(JSON.stringify(tasks), before);
});

test('US07 filtering and grouping agree that only absent/null references are unassigned', () => {
  const { groupTasks } = require('../public/iterations');
  const tasks = [
    { id: 1, title: 'Absent' }, { id: 2, title: 'Null', iterationId: null },
    { id: 3, title: 'Empty string', iterationId: '' }, { id: 4, title: 'Unknown', iterationId: 99 },
  ];
  const result = queryTasks(tasks, { iterationId: null }, clock());
  assert.deepEqual(ids(result), [1, 2]);
  const groups = groupTasks(result.tasks, []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].iterationId, null);
  assert.equal(groups[0].missing, false);
  assert.deepEqual(ids(queryTasks(tasks, { iterationId: 99 }, clock())), [4]);
});

test('US12 overdue uses the local calendar day, excludes today/future and DONE', () => {
  assert.equal(localDate(new Date(2026, 0, 1, 0, 0, 1)), '2026-01-01');
  assert.equal(localDate(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
  assert.equal(isOverdue({ dueDate: '2026-10-20' }, '2026-10-21'), true);
  assert.equal(isOverdue({ dueDate: '2026-10-21' }, '2026-10-21'), false);
  assert.equal(isOverdue({ dueDate: '2026-10-22' }, '2026-10-21'), false);
  assert.equal(isOverdue({ dueDate: '2026-10-20', status: 'DONE' }, '2026-10-21'), false);
  assert.equal(isOverdue({ dueDate: '2024-02-29' }, '2024-03-01'), true);
  assert.equal(isOverdue({ dueDate: '2025-12-31', status: 'DOING' }, '2026-01-01'), true);
  assert.deepEqual(ids(queryTasks(ROWS, { overdue: true }, clock())), [1]);
  assert.deepEqual(ids(queryTasks(ROWS, { overdue: false }, clock())), [2, 3, 4, 5]);
});

test('US12 absent and malformed due dates never become overdue', () => {
  for (const dueDate of [undefined, null, '', '2026-02-29', '2026-02-31', '2026-13-01',
    '2026-10-20T00:00:00Z', '2026/10/20', 'yesterday', 20261020, [], {}]) {
    assert.equal(isOverdue({ dueDate }, '2026-10-21'), false);
  }
  assert.throws(() => localDate(new Date('invalid')), TypeError);
  assert.throws(() => localDate('2026-10-21'), TypeError);
});

test('US12 local date follows the server timezone across a UTC day boundary', () => {
  const script = "process.stdout.write(require('./src/domain/task-filter').localDate(new Date('2026-10-20T16:05:00Z')))";
  for (const [timezone, expected] of [['Asia/Shanghai', '2026-10-21'], ['America/Los_Angeles', '2026-10-20']]) {
    const actual = execFileSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'), env: { ...process.env, TZ: timezone }, encoding: 'utf8',
    });
    assert.equal(actual, expected, timezone);
  }
});

test('US11 empty task data returns an empty result and zero counters', () => {
  assert.deepEqual(queryTasks([], {}, clock()), {
    tasks: [], total: 0, matched: 0, today: '2026-10-21', overdueCount: 0,
  });
});

test('US11 rejects malformed records and duplicate ids without repairing data', () => {
  for (const tasks of [null, {}, [null], [[]], [3], new Array(1), [{ id: 1 }],
    [{ id: 1, title: ' ' }], [{ id: 1, title: 12 }], [{ id: 1, title: 'A' }, { id: 1, title: 'B' }],
    ...[0, -1, 1.5, '1', true, Number.MAX_SAFE_INTEGER + 1].map((id) => [{ id, title: 'Bad' }])]) {
    assert.equal(validateTasks(tasks), false);
    assert.throws(() => queryTasks(tasks, {}, clock()), /Invalid task data/);
  }
});

test('GET task-query returns JSON with no-store, reads once and never writes', async (t) => {
  let reads = 0;
  let writes = 0;
  const data = { tasks: ROWS };
  const before = JSON.stringify(data);
  const url = await startRouter(t, {
    readData() { reads += 1; return data; },
    writeData() { writes += 1; },
  });
  const response = await fetch(`${url}?status=TODO&priority=HIGH&iterationId=2&q=%5Bapi%5D`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(ids(await response.json()), [1]);
  assert.equal(reads, 1);
  assert.equal(writes, 0);
  assert.equal(JSON.stringify(data), before);
});

test('GET task-query rejects bad raw parameters before reading the database', async (t) => {
  let reads = 0;
  const url = await startRouter(t, { readData() { reads += 1; throw new Error('must not read'); } });
  for (const query of ['status=BAD', 'unknown=1', 'status=TODO&status=TODO', 'status[]=TODO',
    'q[x]=a', '__proto__[x]=a', 'constructor[prototype][x]=a', 'assigneeId=0', 'iterationId=nope',
    'overdue=TRUE', `q=${'x'.repeat(101)}`]) {
    const response = await fetch(`${url}?${query}`);
    assert.equal(response.status, 400, query);
    assert.deepEqual(await response.json(), { error: 'Invalid task query' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(reads, 0);
});

test('GET task-query returns a generic JSON 500 for broken tasks and read failures', async (t) => {
  let data;
  let failure;
  let writes = 0;
  const url = await startRouter(t, {
    readData() { if (failure) throw failure; return data; },
    writeData() { writes += 1; },
  });
  for (data of [null, {}, { tasks: null }, { tasks: {} }, { tasks: [null] },
    { tasks: [{ id: 1, title: 'A' }, { id: 1, title: 'B' }] }]) {
    const response = await fetch(url);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to read tasks' });
  }
  failure = new Error('private disk path and credentials');
  const response = await fetch(url);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unable to read tasks' });
  assert.equal(writes, 0);
});

test('task-query can sit after auth and read-permission guards without reading denied requests', async (t) => {
  let reads = 0;
  const db = { readData() { reads += 1; return { tasks: [] }; } };
  const guards = [
    (req, res, next) => req.get('x-test-user') ? next() : res.status(401).json({ error: 'Authentication required' }),
    (req, res, next) => req.get('x-test-read') === 'yes' ? next() : res.status(403).json({ error: 'Read permission required' }),
  ];
  const url = await startRouter(t, db, guards);
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { 'x-test-user': 'user' } })).status, 403);
  assert.equal(reads, 0);
  assert.equal((await fetch(url, { headers: { 'x-test-user': 'user', 'x-test-read': 'yes' } })).status, 200);
  assert.equal(reads, 1);
});

test('task-query uses real createDb and existing create/status APIs without changing query bytes', async (t) => {
  const dataFile = makeTempDataFile(t, {
    members: [{ id: 1, name: 'Test member', role: 'QA' }],
    iterations: [{ id: 2, name: 'Sprint 3' }],
    tasks: [],
  });
  const app = createApp({ dataFile });
  // This harness appends the router only for testing; the app owner still owns protected mounting.
  app.use('/api/task-query', createTaskQueryRouter(createDb(dataFile), { clock }));
  const baseUrl = await listen(t, app);
  const createdResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Integrated Alpha', description: 'Read-only query', assigneeId: 1,
      priority: 'HIGH', dueDate: '2026-10-20', iterationId: 2 }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const createdBytes = fs.readFileSync(dataFile, 'utf8');
  const overdueResponse = await fetch(`${baseUrl}/api/task-query?status=TODO&priority=HIGH&assigneeId=1&iterationId=2&overdue=true&q=alpha`);
  assert.equal(overdueResponse.status, 200);
  const overdue = await overdueResponse.json();
  assert.deepEqual(overdue.tasks, [created]);
  assert.equal(overdue.overdueCount, 1);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), createdBytes);
  const statusResponse = await fetch(`${baseUrl}/api/tasks/${created.id}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'DONE' }),
  });
  assert.equal(statusResponse.status, 200);
  const updated = await statusResponse.json();
  const doneBytes = fs.readFileSync(dataFile, 'utf8');
  const doneResponse = await fetch(`${baseUrl}/api/task-query?status=DONE&overdue=false`);
  const done = await doneResponse.json();
  assert.deepEqual(done.tasks, [updated]);
  assert.equal(done.overdueCount, 0);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), doneBytes);
  const secondApp = express();
  secondApp.use('/api/task-query', createTaskQueryRouter(createDb(dataFile), { clock }));
  const secondBase = await listen(t, secondApp);
  const reloaded = await (await fetch(`${secondBase}/api/task-query`)).json();
  assert.deepEqual(reloaded.tasks, [updated]);
});

test('task-query keeps a broken real data file unchanged and hides parser details', async (t) => {
  const dataFile = makeTempDataFile(t, { members: [], tasks: [] });
  const broken = '{ "tasks": private broken content';
  fs.writeFileSync(dataFile, broken);
  const url = await startRouter(t, createDb(dataFile));
  const response = await fetch(url);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unable to read tasks' });
  assert.equal(fs.readFileSync(dataFile, 'utf8'), broken);
});
