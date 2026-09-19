'use strict';

const express = require('express');
const { isValidStatus, updateTaskStatus } = require('../domain/task');

/**
 * 任务路由。
 *
 * 本任务负责 US04 创建并分配任务：
 *   - GET  /api/tasks   查看任务列表
 *   - POST  /api/tasks          创建任务
 *   - PATCH /api/tasks/:id/status 更新任务状态
 */

const VALID_STATUS = ['TODO', 'DOING', 'DONE'];

/**
 * @param {object} db createDb 返回的数据访问对象
 */
function createTasksRouter(db) {
  const router = express.Router();

  // GET /api/tasks —— 返回全部任务
  router.get('/', (req, res) => {
    const { tasks } = db.readData();
    res.json(tasks);
  });

  // POST /api/tasks —— 创建并分配任务
  router.post('/', (req, res) => {
    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    // 兼容前端传入数字或字符串（如 curl 手测），统一转为数字后再比对
    const assigneeId = Number(body.assigneeId);

    // 输入校验：title 不能为空
    if (!title) {
      return res.status(400).json({ error: '任务标题不能为空' });
    }

    const data = db.readData();

    // 输入校验：assigneeId 必须对应真实存在的成员
    const assignee = data.members.find((m) => m.id === assigneeId);
    if (assignee == null) {
      return res.status(400).json({ error: '负责人无效：成员不存在' });
    }

    // 生成唯一任务 id（现有最大 id + 1）
    const nextId =
      data.tasks.reduce((max, t) => (t.id > max ? t.id : max), 0) + 1;

    const task = {
      id: nextId,
      title,
      description,
      assigneeId,
      // 新任务初始状态统一为 TODO（待办）
      status: 'TODO',
      createdAt: new Date().toISOString(),
    };

    data.tasks.push(task);
    db.writeData(data);

    res.status(201).json(task);
  });

  // PATCH /api/tasks/:id/status —— 更新任务状态
  router.patch('/:id/status', (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};

    if (!isValidStatus(status)) {
      return res.status(400).json({ error: `非法任务状态: ${status}` });
    }

    const data = db.readData();
    const taskIndex = data.tasks.findIndex((task) => task.id === id);
    if (taskIndex === -1) {
      return res.status(404).json({ error: `任务不存在: ${req.params.id}` });
    }

    data.tasks[taskIndex] = updateTaskStatus(data.tasks[taskIndex], status);
    db.writeData(data);
    return res.json(data.tasks[taskIndex]);
  });

  return router;
}

module.exports = { createTasksRouter, VALID_STATUS };
