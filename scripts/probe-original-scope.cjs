'use strict';
// Observations, not passing acceptance tests. Every write uses disposable data.
const fs = require('node:fs');
const { start, request, login, data, makeTempDataFile } = require('../test/support/permission-helpers');
const { mountTaskFilters } = require('../src/features/task-filters');
const cleanup = [];
const t = { after(fn) { cleanup.push(fn); } };
(async () => {
  try {
    const { base, file } = await start(t, undefined, { mountReadFeatures: mountTaskFilters });
    const admin = await login(base);
    const member = await login(base, 'pengjiacheng');
    const findings = [];
    const observe = async (name, route, token, method, body) => {
      const response = await request(base, route, token, method, body);
      findings.push({ name, status: response.status });
      return response;
    };
    await observe('US05 member changes task status: blocked by current conservative role matrix', '/tasks/1/status', member, 'PATCH', { status: 'DOING' });
    await observe('TD08 update priority/due date: endpoint absent', '/tasks/1', admin, 'PATCH', { priority: 'HIGH', dueDate: '2026-10-23' });
    await observe('US07 create iteration: endpoint absent', '/iterations', admin, 'POST', { name: 'Sprint 3', goal: 'release', startDate: '2026-10-22', endDate: '2026-10-23' });
    await observe('US07 reassign existing task iteration: endpoint absent', '/tasks/1', admin, 'PATCH', { iterationId: 2 });
    const created = await request(base, '/tasks', admin, 'POST', { title: 'acceptance criteria probe', assigneeId: 1, acceptanceCriteria: 'must persist this field' });
    findings.push({ name: 'US06 acceptance criteria persistence', status: created.status,
      fieldPersisted: Object.hasOwn(await created.json(), 'acceptanceCriteria') });
    const broken = data();
    broken.tasks = { sentinel: 'must not silently lose' };
    fs.writeFileSync(file, JSON.stringify(broken));
    const before = fs.readFileSync(file, 'utf8');
    const query = await request(base, '/task-query', admin);
    const queryBody = await query.json();
    const write = await request(base, '/tasks', admin, 'POST', { title: 'malformed collection probe', assigneeId: 1 });
    findings.push({ name: 'TD06 malformed tasks collection', readStatus: query.status,
      readReturnedEmpty: Array.isArray(queryBody.tasks) && queryBody.tasks.length === 0,
      writeStatus: write.status, rawFileChanged: before !== fs.readFileSync(file, 'utf8'),
      sentinelRetained: fs.readFileSync(file, 'utf8').includes('must not silently lose') });
    console.log(JSON.stringify({ recordedAt: new Date().toISOString(), acceptancePassed: false, findings }, null, 2));
  } finally {
    for (const fn of cleanup.reverse()) await fn();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
