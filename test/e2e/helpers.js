'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { makeTempDataFile } = require('../helpers');
const { SEED_MEMBERS } = require('../../src/db');
const { SEED_USERS } = require('../../src/domain/user');
const DEFAULT_ITERATIONS = [{ id: 1, name: 'Sprint 1' }, { id: 2, name: 'Sprint 2' }, { id: 3, name: 'Sprint 3' }];
// Test-only teaching fixtures. No real credentials or environment overrides.
const DEMO_ADMIN = { username: 'admin', password: 'admin123' };
const DEMO_MEMBER = { username: 'pengjiacheng', password: 'member123' };
function seedData(tasks = []) {
  return { members: SEED_MEMBERS, tasks, iterations: DEFAULT_ITERATIONS, users: SEED_USERS };
}
async function getJson(url, options) {
  const response = await fetch(url, options);
  assert.match(response.headers.get('content-type') || '', /application\/json/, `Expected JSON for ${response.status}`);
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function requestWithSession(baseUrl, pathname, options = {}, token) {
  return getJson(`${baseUrl}${pathname}`, { ...options,
    headers: { ...(options.headers || {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
}
async function login(baseUrl, credentials = DEMO_ADMIN) {
  const result = await requestWithSession(baseUrl, '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials),
  });
  assert.equal(result.status, 200, 'Release journey requires working login');
  assert.equal(typeof result.body.token, 'string');
  assert.ok(result.body.token.length > 0);
  return { token: result.body.token, user: result.body };
}
// Launch the actual production entry, never the legacy unprotected embedding factory.
async function startServer(t, dataFile) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stopping;
  function close() {
    if (!stopping) stopping = new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve); child.kill();
    });
    return stopping;
  }
  t.after(close);
  const baseUrl = await new Promise((resolve, reject) => {
    let output = '', errors = '';
    const timeout = setTimeout(() => { close(); reject(new Error('Production server startup timed out')); }, 15000);
    const fail = error => { clearTimeout(timeout); reject(error); };
    child.once('error', fail);
    child.once('exit', code => fail(new Error(`Production server exited before readiness: ${code}; ${errors}`)));
    child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000); });
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = /http:\/\/localhost:(\d+)/.exec(output);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  return { baseUrl, close };
}
function jsonOptions(method, body) {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
module.exports = { DEMO_ADMIN, DEMO_MEMBER, getJson, requestWithSession, login, seedData, makeTempDataFile, startServer, jsonOptions };
