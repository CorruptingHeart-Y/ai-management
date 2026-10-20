'use strict';

const { createTaskQueryRouter } = require('../routes/task-query');

/** The owner must supply the same read policy/session middleware as the task API. */
function mountTaskFilters(app, db, readAccess, options = {}) {
  if (typeof readAccess !== 'function') {
    throw new TypeError('Task query requires an explicit read-access middleware');
  }
  app.use('/api/task-query', readAccess, createTaskQueryRouter(db, options));
}

module.exports = { mountTaskFilters };
