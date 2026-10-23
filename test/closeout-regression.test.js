'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const contract = require('../public/task-contract');
const { start, request } = require('./support/permission-helpers');

// Execute the real workbench handler. The minimal DOM isolates submission
// behavior; browser rendering and real HTTP are verified separately.
function workbench(fetchImpl) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false,
      dataset: {}, addEventListener() {}, setAttribute() {}, reset() {} });
    return elements.get(id);
  }
  const session = { canWrite: () => true, canUpdateStatus: () => true,
    fetch: fetchImpl, ready: new Promise(() => {}), subscribe() {} };
  const context = vm.createContext({ TaskContract: contract, AppSession: session,
    createServiceStatus: () => ({}), document: { getElementById: element, querySelector: element } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8'), context);
  element('task-title').value = 'one intended task';
  element('task-assignee').value = '1';
  element('task-priority').value = 'MEDIUM';
  vm.runInContext('members = [{id: 1}]', context);
  return { element, session,
    submit: () => vm.runInContext('handleSubmit({ preventDefault() {} })', context) };
}

test('closeout UI: repeated submit while POST is pending creates only one request', async () => {
  let finish, posts = 0;
  const page = workbench(async (url, options) => {
    if (options?.method === 'POST') { posts++; return new Promise(resolve => { finish = resolve; }); }
    return Response.json([]);
  });
  const pending = page.submit();
  assert.equal(page.element('create-task').disabled, true);
  await page.submit();
  assert.equal(posts, 1);
  finish(Response.json({ id: 1 }, { status: 201 }));
  await pending;
  assert.equal(page.element('form-message').textContent, '任务已创建');
  assert.equal(page.element('create-task').disabled, false);
});

test('closeout UI: persisted task with failed refresh is reported as saved, never as failed creation', async () => {
  const page = workbench(async (url, options) => {
    if (options?.method === 'POST') return Response.json({ id: 1 }, { status: 201 });
    throw new Error('list disconnected after commit');
  });
  await page.submit();
  assert.match(page.element('form-message').textContent, /任务已创建.*不要重复提交/);
  assert.equal(page.element('task-title').value, '');
});

test('closeout UI: ambiguous POST failure retains input and asks to verify before retry', async () => {
  const page = workbench(async () => { throw new Error('connection interrupted'); });
  await page.submit();
  assert.match(page.element('form-message').textContent, /无法确认创建结果.*先刷新/);
  assert.equal(page.element('task-title').value, 'one intended task');
  assert.equal(page.element('create-task').disabled, false);
});

test('closeout UI: validation error retains input and never reenables creation after role changed', async () => {
  let finish;
  const page = workbench(() => new Promise(resolve => { finish = resolve; }));
  const pending = page.submit();
  page.session.canWrite = () => false;
  finish(Response.json({ error: '负责人无效' }, { status: 400 }));
  await pending;
  assert.equal(page.element('form-message').textContent, '负责人无效');
  assert.equal(page.element('task-title').value, 'one intended task');
  assert.equal(page.element('create-task').disabled, true);
});

test('closeout TD05: browser and server use the same immutable task vocabulary', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/task-contract.js'), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.TaskContract)), contract);
  assert.throws(() => { contract.VALID_STATUSES.push('BLOCKED'); }, TypeError);
  const task = require('../src/domain/task');
  const stats = require('../src/domain/stats');
  const routes = require('../src/routes/tasks');
  assert.equal(task.VALID_STATUSES, contract.VALID_STATUSES);
  assert.equal(routes.VALID_STATUS, contract.VALID_STATUSES);
  assert.equal(stats.STATUS_ORDER, contract.VALID_STATUSES);
  for (const page of ['index.html', 'stats.html', 'task-filters.html']) {
    const html = fs.readFileSync(path.join(__dirname, '../public', page), 'utf8');
    assert.ok(html.indexOf('src="task-contract.js"') >= 0, page);
  }
});

test('closeout auth: successful and rejected session responses are never cached', async t => {
  const { base } = await start(t);
  const failed = await request(base, '/auth/login', null, 'POST', { username: 'admin', password: 'wrong' });
  assert.equal(failed.status, 401);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
  const success = await request(base, '/auth/login', null, 'POST', { username: 'admin', password: 'admin123' });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  const token = (await success.json()).token;
  for (const [route, method, expected] of [['/auth/me', 'GET', 200], ['/auth/logout', 'POST', 200], ['/auth/me', 'GET', 401]]) {
    const response = await request(base, route, token, method);
    assert.equal(response.status, expected);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
