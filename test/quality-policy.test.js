'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSummary, blockers } = require('../scripts/lib/quality-policy.cjs');
function tap(counts) {
  return Object.entries({ tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0, ...counts })
    .map(([key, value]) => `# ${key} ${value}`).join('\n');
}
test('门禁策略：只有实际执行且全通过才允许自动门禁通过', () => {
  assert.deepEqual(blockers(parseSummary(tap({}))), []);
});
test('门禁策略：Node退出0仍须拒绝TODO与skip', () => {
  assert.deepEqual(blockers(parseSummary(tap({ tests: 3, pass: 1, todo: 1, skipped: 1 }))), ['skipped=1', 'todo=1']);
});
test('门禁策略：明确报告fail与cancelled', () => {
  assert.deepEqual(blockers(parseSummary(tap({ tests: 3, pass: 1, fail: 1, cancelled: 1 }))), ['fail=1', 'cancelled=1']);
});
test('门禁策略：缺失或重复汇总不能当成功', () => {
  assert.throws(() => parseSummary('TAP version 13\n'), /Missing/);
  assert.throws(() => parseSummary(`${tap({})}\n# tests 1`), /ambiguous/);
});
test('门禁策略：零测试不能当通过', () => {
  assert.deepEqual(blockers(parseSummary(tap({ tests: 0, pass: 0 }))), ['no tests executed']);
});
test('门禁策略：拒绝不一致或溢出的计数', () => {
  assert.throws(() => parseSummary(tap({ tests: 2 })), /Inconsistent/);
  assert.throws(() => parseSummary(tap({ tests: '99999999999999999999' })), /Unsafe/);
});
