'use strict';
// 仅在临时文件复现既有风险；调查完成不等于风险已经被接受或修复。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 's3-debt-audit-'));
  const dataFile = path.join(directory, 'db.json');
  const server = createApp({ dataFile }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const findings = [];
  try {
    const malformed = '{"members":BROKEN';
    fs.writeFileSync(dataFile, malformed);
    const read = await fetch(`${url}/api/tasks`);
    findings.push({ debt: 'TD-S2-03', observation: 'malformed task data error response',
      status: read.status, contentType: read.headers.get('content-type'),
      originalBytesPreserved: fs.readFileSync(dataFile, 'utf8') === malformed,
      result: read.headers.get('content-type')?.includes('application/json') ? 'JSON_ERROR' : 'OPEN_NON_JSON_ERROR' });
    const source = { members: [{ id: 1, name: 'QA', role: 'QA' }], tasks: { opaque: 'do-not-lose' } };
    fs.writeFileSync(dataFile, JSON.stringify(source));
    const created = await fetch(`${url}/api/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'temporary risk probe', assigneeId: 1 }),
    });
    const after = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    findings.push({ debt: 'TD-S2-06', observation: 'non-array tasks with sentinel followed by task creation',
      status: created.status, originalMalformedTasksPreserved: JSON.stringify(after.tasks) === JSON.stringify(source.tasks),
      result: created.status === 201 ? 'OPEN_SILENT_SHAPE_REPLACEMENT' : 'REJECTED' });
    const beforeUpdate = fs.readFileSync(dataFile, 'utf8');
    const unsupported = await fetch(`${url}/api/tasks/1`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: 'LOW' }),
    });
    findings.push({ debt: 'TD-S2-08', observation: 'task attribute update endpoint',
      status: unsupported.status, originalBytesPreserved: fs.readFileSync(dataFile, 'utf8') === beforeUpdate,
      result: unsupported.status === 404 ? 'OPEN_UNSUPPORTED_IN_CURRENT_SCOPE' : 'REVIEW_REQUIRED' });
    console.log(JSON.stringify({ date: new Date().toISOString(), scope: 'temporary data only; audit observations, not release acceptance', findings }, null, 2));
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
