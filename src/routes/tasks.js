// 任务相关 REST 接口（US05 主要关注状态更新）。
// 使用工厂函数注入 TaskStore，便于测试时替换为临时文件。

const express = require('express');
const { updateTaskStatus, isValidStatus } = require('../domain/task');

function createTasksRouter(taskStore) {
  const router = express.Router();

  // GET /api/tasks 查看任务列表（US05 需要展示已有任务）
  router.get('/', (req, res) => {
    res.json(taskStore.load());
  });

  // PATCH /api/tasks/:id/status 更新任务状态
  router.patch('/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};

    // 非法状态直接拒绝，不允许保存
    if (!isValidStatus(status)) {
      return res.status(400).json({ error: `非法任务状态: ${status}` });
    }

    const tasks = taskStore.load();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: `任务不存在: ${id}` });
    }

    const updated = updateTaskStatus(tasks[index], status);
    tasks[index] = updated;
    taskStore.save(tasks);

    return res.json(updated);
  });

  return router;
}

module.exports = { createTasksRouter };
