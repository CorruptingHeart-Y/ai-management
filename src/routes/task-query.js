'use strict';

const express = require('express');
const { parseTaskFilters, queryTasks } = require('../domain/task-filter');

/** The shared app owner must mount this router after authentication and read permission checks. */
function createTaskQueryRouter(db, { clock = () => new Date() } = {}) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    let filters;
    try {
      // Raw parameters retain duplicates and bracket syntax that Express's query parser can discard.
      filters = parseTaskFilters(new URL(req.originalUrl, 'http://localhost').searchParams);
    } catch {
      return res.status(400).json({ error: 'Invalid task query' });
    }
    try {
      const data = db.readData();
      return res.json(queryTasks(data.tasks, filters, clock()));
    } catch {
      return res.status(500).json({ error: 'Unable to read tasks' });
    }
  });

  return router;
}

module.exports = { createTaskQueryRouter };
