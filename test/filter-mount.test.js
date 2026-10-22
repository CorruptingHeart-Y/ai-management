'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { mountTaskFilters } = require('../src/features/task-filters');

test('US11 protected mounting requires an explicit read-access middleware', () => {
  const app = express();
  for (const guard of [undefined, null, false, {}, []]) {
    assert.throws(() => mountTaskFilters(app, {}, guard), /explicit read-access/);
  }
});

test('US11 mounted query stops denied requests before reading and serves permitted requests', async (t) => {
  const app = express();
  let reads = 0;
  const db = { readData() { reads += 1; return { tasks: [] }; } };
  mountTaskFilters(app, db, (req, res, next) => {
    if (req.get('authorization') === 'Bearer permitted') return next();
    return res.status(401).json({ error: 'Authentication required' });
  }, { clock: () => new Date(2026, 9, 21, 12) });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
  }));
  const url = `http://127.0.0.1:${server.address().port}/api/task-query`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal(reads, 0);
  const response = await fetch(url, { headers: { Authorization: 'Bearer permitted' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { tasks: [], total: 0, matched: 0, today: '2026-10-21', overdueCount: 0 });
  assert.equal(reads, 1);
});
