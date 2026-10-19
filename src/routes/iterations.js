'use strict';

const express = require('express');
const { validateIterations } = require('../domain/iteration');

/** Read-only US07 router; the shared application owner mounts /api/iterations. */
function createIterationsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const data = db.readData();
      const iterations = data.iterations === undefined ? [] : data.iterations;
      if (!validateIterations(iterations)) {
        return res.status(500).json({ error: 'Invalid iteration data' });
      }
      return res.json(iterations);
    } catch {
      return res.status(500).json({ error: 'Unable to read iterations' });
    }
  });

  return router;
}

module.exports = { createIterationsRouter };
