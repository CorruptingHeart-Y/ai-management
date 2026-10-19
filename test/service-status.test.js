'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServiceStatus } = require('../public/service-status');

const members = [
  { id: 1, name: '彭佳成', role: '产品与范围负责人' },
  { id: 2, name: '朱传玺', role: '技术与架构负责人' },
];

function makeStatus() {
  const container = { dataset: {} };
  const text = { textContent: '' };
  return { container, text };
}

function jsonResponse(body, { ok = true, contentType = 'application/json; charset=utf-8' } = {}) {
  return {
    ok,
    headers: { get: (name) => name === 'content-type' ? contentType : null },
    json: async () => body,
  };
}

test('页面初始显示检查中，并由现有成员加载请求驱动状态', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

  assert.match(html, /data-state="checking"/);
  assert.match(html, /正在检查服务\.\.\./);
  assert.doesNotMatch(html, /本地运行正常/);
  assert.match(app, /await serviceStatus\.check\(\)/);
  assert.doesNotMatch(app, /fetch\(['"]\/api\/members/);
  assert.equal((app.match(/serviceStatus\.check\(\)/g) || []).length, 1);
});

test('成员接口成功且响应结构有效后才显示连接正常，只请求一次', async () => {
  const status = makeStatus();
  const requests = [];
  let resolveFetch;
  const service = createServiceStatus(status.container, status.text, {
    fetchImpl: (...args) => {
      requests.push(args);
      return new Promise((resolve) => { resolveFetch = resolve; });
    },
  });

  const result = service.check();
  assert.equal(status.container.dataset.state, 'checking');
  assert.equal(status.text.textContent, '正在检查服务...');
  resolveFetch(jsonResponse(members));

  assert.deepEqual(await result, members);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], '/api/members');
  assert.equal(requests[0][1].signal instanceof AbortSignal, true);
  assert.equal(status.container.dataset.state, 'connected');
  assert.equal(status.text.textContent, '服务连接正常');
});

test('请求失败时切换为服务连接异常', async () => {
  const status = makeStatus();
  const service = createServiceStatus(status.container, status.text, {
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });

  await assert.rejects(service.check(), /Failed to fetch/);
  assert.equal(status.container.dataset.state, 'error');
  assert.equal(status.text.textContent, '服务连接异常');
});

test('空成员数组符合接口契约，连接状态仍由有效响应决定', async () => {
  const status = makeStatus();
  const service = createServiceStatus(status.container, status.text, {
    fetchImpl: async () => jsonResponse([]),
  });

  assert.deepEqual(await service.check(), []);
  assert.equal(status.container.dataset.state, 'connected');
});

test('HTTP失败、非JSON和不符合成员契约的响应均不能显示正常', async (t) => {
  const invalidResponses = [
    { label: 'HTTP 500', response: jsonResponse(members, { ok: false }) },
    { label: '非JSON响应', response: jsonResponse(members, { contentType: 'text/html' }) },
    { label: '成员字段不完整', response: jsonResponse([{ id: 1, name: '缺少分工' }]) },
    { label: '重复成员编号', response: jsonResponse([members[0], members[0]]) },
    { label: '无法解析的JSON', response: { ...jsonResponse(null), json: async () => { throw new SyntaxError('invalid json'); } } },
  ];

  for (const { label, response } of invalidResponses) {
    await t.test(label, async () => {
      const status = makeStatus();
      const service = createServiceStatus(status.container, status.text, {
        fetchImpl: async () => response,
      });

      await assert.rejects(service.check());
      assert.equal(status.container.dataset.state, 'error');
      assert.equal(status.text.textContent, '服务连接异常');
    });
  }
});

test('超时会中止请求并显示服务连接异常', async () => {
  const status = makeStatus();
  let signal;
  const service = createServiceStatus(status.container, status.text, {
    timeoutMs: 10,
    fetchImpl: (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });

  await assert.rejects(service.check(), /服务检查超时/);
  assert.equal(signal.aborted, true);
  assert.equal(status.container.dataset.state, 'error');
  assert.equal(status.text.textContent, '服务连接异常');
});
