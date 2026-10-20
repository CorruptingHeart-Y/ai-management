'use strict';

// Optional visual QA runner. Supply an installed Playwright module and browser; no app dependencies change.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createApp } = require('../src/app');
const { createDb, SEED_MEMBERS } = require('../src/db');
const { mountTaskFilters } = require('../src/features/task-filters');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-filter-browser-'));
  const output = path.resolve(process.env.FILTER_EVIDENCE_DIR || path.join(os.tmpdir(), `ai-filter-evidence-${Date.now()}`));
  fs.mkdirSync(output, { recursive: true });
  const dataFile = path.join(temp, 'db.json');
  const fixture = {
    members: SEED_MEMBERS,
    iterations: [{ id: 1, name: 'Sprint 1' }, { id: 2, name: 'Sprint 2' }, { id: 3, name: 'Sprint 3' }],
    tasks: [
      { id: 1, title: '完成迭代归属验收', description: '检查刷新后的归属', status: 'DOING', priority: 'HIGH', assigneeId: 1, iterationId: 2, dueDate: '2026-10-19' },
      { id: 2, title: '任务筛选与逾期提醒', status: 'DOING', priority: 'HIGH', assigneeId: 1, iterationId: 3, dueDate: '2026-10-21' },
      { id: 3, title: '已完成的旧任务', status: 'DONE', priority: 'MEDIUM', assigneeId: 2, iterationId: 1, dueDate: '2026-10-18' },
      { id: 4, title: '项目价值兑现说明', status: 'TODO', priority: 'LOW', assigneeId: 1, iterationId: null, dueDate: null },
      { id: 5, title: '发布就绪检查', status: 'TODO', priority: 'MEDIUM', assigneeId: 4, iterationId: 3, dueDate: '2026-10-20' },
      { id: 6, title: '<img src=x onerror="window.__injected=true">', description: '<script>injected</script>', status: 'TODO', assigneeId: 3, iterationId: 99, dueDate: '2026-02-31' },
    ],
  };
  fs.writeFileSync(dataFile, JSON.stringify(fixture));
  const before = fs.readFileSync(dataFile, 'utf8');
  const app = createApp({ dataFile });
  let queryMode = 'ok';
  let readCount = 0;
  const db = createDb(dataFile);
  const queryDb = { readData() { readCount += 1; return db.readData(); } };
  mountTaskFilters(app, queryDb, (req, res, next) => {
    if (queryMode === 'offline') return res.status(503).json({ error: '暂时无法读取任务，请稍后重试' });
    if (queryMode === 'denied') return res.status(403).json({ error: 'Denied' });
    if (queryMode === 'expired' || req.get('authorization') !== 'Bearer browser-test-token') {
      return res.status(401).json({ error: 'Expired' });
    }
    next();
  }, { clock: () => new Date(2026, 9, 21, 12) });
  let browser;
  let server;
  const checks = [];
  try {
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      instance.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('ai-mgmt-token', 'browser-test-token'));
    const ready = () => page.waitForFunction(() => document.getElementById('results').getAttribute('aria-busy') === 'false');
    const count = (n) => page.waitForFunction((expected) => document.getElementById('matched-count').textContent === String(expected), n);
    await page.goto(`${base}/task-filters.html`);
    await ready(); await count(6);
    assert.equal(await page.locator('#overdue-count').innerText(), '2');
    assert.equal(await page.locator('.overdue-label').count(), 2);
    assert.equal(await page.locator('tbody img, tbody script').count(), 0);
    assert.equal(await page.evaluate(() => window.__injected), undefined);
    checks.push('real same-origin API data, safe text rendering and server-day overdue labels');

    await page.locator('#group-iteration').check();
    assert.equal(await page.locator('.group-heading').count(), 5);
    assert.match(await page.locator('.group-heading').last().innerText(), /未知迭代 #99/);
    await page.screenshot({ path: path.join(output, 'desktop-grouped.png'), fullPage: true });
    checks.push('US07 known, unassigned and orphan iteration groups');

    await page.locator('#filter-status').selectOption('DOING'); await count(2);
    await page.locator('#filter-assignee').selectOption('1'); await count(2);
    await page.locator('#filter-iteration').selectOption('2'); await count(1);
    await page.locator('#view-overdue').click(); await count(1);
    assert.match(await page.locator('tbody').innerText(), /完成迭代归属验收/);
    await page.reload(); await ready(); await count(1);
    assert.equal(await page.locator('#group-iteration').isChecked(), true);
    checks.push('combined filters, overdue-only and URL/reload restoration');

    await page.locator('#reset').click(); await count(6);
    await page.locator('#query').fill('完全不匹配'); await count(0);
    assert.equal(await page.locator('.empty-state').innerText(), '没有符合条件的任务');
    await page.locator('#reset').click(); await count(6);
    await page.locator('#filter-iteration').selectOption('unassigned'); await count(1);
    assert.match(await page.locator('tbody').innerText(), /项目价值兑现说明/);
    await page.locator('#reset').click(); await count(6);
    checks.push('reset, empty state and unassigned iteration filter');

    queryMode = 'offline';
    await page.locator('#refresh').click(); await ready();
    assert.equal(await page.locator('tbody tr').count(), 0);
    assert.equal(await page.locator('#failure').isVisible(), true);
    queryMode = 'ok';
    await page.locator('#retry').click(); await count(6);
    checks.push('failure clears stale rows and retry recovers');

    queryMode = 'denied';
    const beforeDenied = readCount;
    await page.locator('#refresh').click(); await ready();
    assert.match(await page.locator('#failure-message').innerText(), /没有查看任务的权限/);
    assert.equal(await page.locator('tbody tr').count(), 0);
    assert.equal(readCount, beforeDenied);
    assert.equal(await page.evaluate(() => localStorage.getItem('ai-mgmt-token')), 'browser-test-token');
    assert.equal(await page.locator('#filter-assignee option').count(), 1);
    assert.equal(await page.locator('#filter-iteration option').count(), 2);
    queryMode = 'expired';
    await page.locator('#retry').click(); await ready();
    assert.equal(await page.locator('#login-link').isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('ai-mgmt-token')), null);
    assert.equal(await page.locator('tbody tr').count(), 0);
    checks.push('stub 401/403 deny before read, clear results, preserve 403 token and remove 401 token');

    queryMode = 'ok';
    await page.evaluate(() => localStorage.setItem('ai-mgmt-token', 'browser-test-token'));
    await page.locator('#retry').click(); await count(6);
    await page.route('**/api/members', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Denied"}' }));
    await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'ai-mgmt-token', newValue: 'other-account' })));
    await ready();
    assert.equal(await page.locator('tbody tr').count(), 0);
    assert.equal(await page.locator('#filter-assignee option').count(), 1);
    assert.equal(await page.locator('#filter-iteration option').count(), 2);
    await page.unroute('**/api/members');
    checks.push('account transition or denied metadata clears previous members and iteration options');

    queryMode = 'ok';
    await page.evaluate(() => localStorage.setItem('ai-mgmt-token', 'browser-test-token'));
    await page.locator('#retry').click(); await count(6);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#view-overdue').click(); await count(2);
      await page.locator('#group-iteration').check();
      await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
      await page.locator('#reset').click(); await count(6);
    }
    checks.push('390px and 320px layouts, live filters, no horizontal overflow');
    assert.deepEqual(errors, []);
    assert.equal(fs.readFileSync(dataFile, 'utf8'), before);
    checks.push('no browser exceptions and data file byte-for-byte unchanged');
    const result = { date: new Date().toISOString(), checks, passed: checks.length,
      browser: await browser.version(), screenshots: ['desktop-grouped.png', 'mobile-390.png', 'mobile-320.png'],
      limitation: 'Automated browser QA with injected authorization stub; not human acceptance or real US02/US03 integration.' };
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, evidenceDirectory: output }, null, 2));
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections?.(); });
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
