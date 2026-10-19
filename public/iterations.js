'use strict';

// Pure view helpers: the page owner supplies API data and renders existing task controls.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IterationView = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ALL = 'all';
  const UNASSIGNED = 'unassigned';

  function taskIterationId(task) {
    return task.iterationId === undefined ? null : task.iterationId;
  }

  /** Filter values are ALL, UNASSIGNED or a positive numeric iteration id. */
  function filterTasks(tasks, selection = ALL) {
    if (selection === ALL) return tasks.slice();
    if (selection === UNASSIGNED) {
      return tasks.filter((task) => taskIterationId(task) === null);
    }
    if (!Number.isSafeInteger(selection) || selection <= 0) {
      throw new TypeError('Invalid iteration filter');
    }
    return tasks.filter((task) => taskIterationId(task) === selection);
  }

  /**
   * Known groups follow API order; unassigned and orphan references follow them.
   * Empty groups are omitted. Task objects and their original order are preserved.
   */
  function groupTasks(tasks, iterations) {
    const groups = new Map(iterations.map((iteration) => [iteration.id, {
      iterationId: iteration.id, name: iteration.name, missing: false, tasks: [],
    }]));
    groups.set(null, { iterationId: null, name: null, missing: false, tasks: [] });

    for (const task of tasks) {
      const id = taskIterationId(task);
      if (!groups.has(id)) {
        // Preserve invalid/orphan references visibly instead of calling them unassigned.
        groups.set(id, { iterationId: id, name: null, missing: true, tasks: [] });
      }
      groups.get(id).tasks.push(task);
    }
    return [...groups.values()].filter((group) => group.tasks.length > 0);
  }

  return { ALL, UNASSIGNED, filterTasks, groupTasks };
}));
