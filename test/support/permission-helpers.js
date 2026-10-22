'use strict';
const assert = require('node:assert/strict');
const { createSecuredApp } = require('../../src/app');
const { SEED_USERS } = require('../../src/domain/user');
const { makeTempDataFile } = require('../helpers');
function data() {
  return { members: [{ id: 1, name: '成员一', role: 'QA' }],
    tasks: [{ id: 1, title: '原任务', status: 'TODO', assigneeId: 1 }],
    iterations: [{ id: 2, name: 'Sprint 2' }], users: SEED_USERS, extension: { retained: true } };
}
async function start(t, file = makeTempDataFile(t, data()), options = {}) {
  const app = createSecuredApp({ dataFile: file, ...options });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); }));
  return { file, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
function request(base, route, token, method = 'GET', body, extra = {}) {
  return fetch(`${base}/api${route}`, { method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function login(base, username = 'admin') {
  const response = await request(base, '/auth/login', null, 'POST', {
    username, password: username === 'admin' ? 'admin123' : 'member123',
  });
  assert.equal(response.status, 200);
  return (await response.json()).token;
}
module.exports = { start, data, request, login, makeTempDataFile };
