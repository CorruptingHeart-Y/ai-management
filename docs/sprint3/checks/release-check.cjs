'use strict';

/**
 * 发布自检汇总（不替代测试运行，只做"证据是否齐、口径是否一致"的静态清点）。
 *
 * 为什么单独写一个脚本而不并进 verify-sprint2.cjs：那份门禁归杨浩伟维护，
 * 且它会 spawn 子进程跑测试；本脚本只读文件，任何环境都能跑，用于发布前 30 秒摸底。
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..');
process.chdir(root);

const out = { checkedAt: new Date().toISOString(), sections: {}, problems: [] };
const exists = (p) => fs.existsSync(path.join(root, p));

function countTodo() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.test.js') || entry.name.endsWith('.cjs')) files.push(rel);
    }
  };
  walk('test');
  if (exists('docs/sprint2/checks')) walk('docs/sprint2/checks');
  let todo = 0;
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    // 只统计"显式声明的待办"：{ todo: ... } 选项或 t.todo() 调用；
    // 不能统计 TODO 状态字面量（status === 'TODO' 是业务关键字，不是未完成测试）
    const m = text.match(/\btodo\s*:|\bt\.todo\(/g);
    if (m) {
      todo += m.length;
      hits.push(`${f}: ${m.length}`);
    }
  }
  return { files, todo, hits };
}

// 1. 关键文件
const required = [
  'src/app.js', 'src/db.js', 'package.json', 'README.md', 'data/db.json',
  'src/domain/stats.js', 'src/routes/stats.js', 'src/routes/iterations.js', 'public/stats.html',
  'test/members.test.js', 'test/tasks.test.js', 'test/task-status.test.js',
  'test/service-status.test.js', 'test/task-attrs.test.js', 'test/iterations.test.js', 'test/stats.test.js',
  'test/e2e/main-journey.test.js', 'test/e2e/exception-journey.test.js',
  'docs/sprint3/release-readiness.md', 'docs/sprint3/release-notes.md',
  'docs/sprint3/user-guide.md', 'docs/sprint3/review-log.md',
];
const missing = required.filter((f) => !exists(f));
out.sections.files = { required: required.length, missing };

// 2. 测试清单一致性
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const inScript = (pkg.scripts && pkg.scripts.test) || '';
const testFiles = fs.readdirSync(path.join(root, 'test'))
  .filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`);
const notInScript = testFiles.filter((f) => !inScript.includes(f));
const e2e = fs.readdirSync(path.join(root, 'test', 'e2e')).filter((f) => f.endsWith('.test.js')).map((f) => `test/e2e/${f}`);
out.sections.tests = {
  files: testFiles.length,
  unit: notInScript.filter((f) => !e2e.includes(f)),
  e2eExcludedByDesign: e2e,
  integrationNotInScript: notInScript.filter((f) => f.includes('sprint2-integration')),
};

// 3. 待办/跳过计数
out.sections.pending = countTodo();

// 4. 版本与发布边界
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
out.sections.readme = {
  hasRunGuide: /npm ci/.test(readme) && /npm test/.test(readme),
  mentionsStatsPage: readme.includes('stats.html'),
  mentionsAuth: /登录|auth/i.test(readme),
};
const notes = fs.readFileSync(path.join(root, 'docs/sprint3/release-notes.md'), 'utf8');
out.sections.releaseNotes = {
  hasKnownLimits: notes.includes('已知限制'),
  hasRollback: notes.includes('回滚'),
  hasVersionRecord: notes.includes('v1.0.0'),
};

// 5. 证据目录
out.sections.evidence = ['docs/evidence', 'docs/sprint2/evidence', 'docs/sprint3']
  .map((dir) => ({ dir, exists: exists(dir) }));

// 汇总问题
if (missing.length) out.problems.push(`缺少文件 ${missing.length} 个`);
if (out.sections.tests.unit.length) out.problems.push(`单元/集成测试未进 npm test 清单：${out.sections.tests.unit.join(', ')}`);
if (out.sections.tests.integrationNotInScript.length) out.problems.push('sprint2-integration.test.js 未进 npm test（由门禁脚本单独跑，需在发布说明中注明）');
if (out.sections.pending.todo) out.problems.push(`测试中仍有 ${out.sections.pending.todo} 处 TODO 标记`);
if (!out.sections.readme.mentionsAuth) out.problems.push('README 未提及登录/鉴权（US02 合入后需补）');

console.log(JSON.stringify(out, null, 2));
console.log(out.problems.length ? `\n[s] 待处理：${out.problems.length} 项` : '\n[s] 静态检查未见阻塞项');
