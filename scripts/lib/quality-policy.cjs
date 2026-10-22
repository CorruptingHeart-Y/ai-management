'use strict';

const fields = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
function parseSummary(tap) {
  const summary = {};
  for (const field of fields) {
    const matches = [...tap.matchAll(new RegExp(`^# ${field} (\\d+)\\r?$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`Missing or ambiguous TAP summary: ${field}`);
    summary[field] = Number(matches[0][1]);
    if (!Number.isSafeInteger(summary[field])) throw new Error(`Unsafe TAP count: ${field}`);
  }
  if (summary.tests !== fields.slice(1).reduce((sum, field) => sum + summary[field], 0)) {
    throw new Error('Inconsistent TAP counts');
  }
  return summary;
}
function blockers(summary) {
  return [
    ...(summary.tests === 0 ? ['no tests executed'] : []),
    ...['fail', 'cancelled', 'skipped', 'todo'].filter(key => summary[key] > 0)
      .map(key => `${key}=${summary[key]}`),
  ];
}
module.exports = { parseSummary, blockers, fields };
