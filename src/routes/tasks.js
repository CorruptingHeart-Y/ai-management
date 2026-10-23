'use strict';

const express = require('express');
const {
  isValidStatus,
  updateTaskStatus,
  isValidPriority,
  isValidDueDate,
  DEFAULT_PRIORITY,
  VALID_STATUSES,
  TASK_STATUS,
} = require('../domain/task');
const { resolveIterationId } = require('../domain/iteration');

/**
 * 任务路由。
 *
 * 本任务负责 US04 创建并分配任务、US06 任务优先级与截止时间：
 *   - GET  /api/tasks   查看任务列表
 *   - POST  /api/tasks          创建任务（含优先级与截止时间）
 *   - PATCH /api/tasks/:id/status 更新任务状态
 */

const VALID_STATUS = VALID_STATUSES;

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

  // POST /api/tasks —— 创建并分配任务（US06 扩展优先级与截止时间）
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

    // US06：优先级缺省为中，传入非法值则拒绝
    let priority = body.priority;
    if (priority == null || priority === '') priority = DEFAULT_PRIORITY;
    if (!isValidPriority(priority)) {
      return res.status(400).json({ error: `非法任务优先级: ${priority}` });
    }

    // US06：截止时间可空，空值归一化为 null；传了值则必须是合法日期
    let dueDate = body.dueDate;
    if (dueDate == null || dueDate === '') {
      dueDate = null;
    } else if (!isValidDueDate(dueDate)) {
      return res.status(400).json({ error: `非法截止时间: ${dueDate}` });
    }

    const data = db.readData();

    // US07：迭代归属可空；传了值就必须指向存在的迭代（PO 授权例外接入，待朱传玺复核）
    let iterationId = null;
    try {
      iterationId = resolveIterationId(
        body.iterationId,
        Array.isArray(data.iterations) ? data.iterations : []
      );
    } catch {
      return res.status(400).json({ error: `非法迭代: ${body.iterationId}` });
    }

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
      status: TASK_STATUS.TODO,
      // US06：任务优先级与截止时间
      priority,
      dueDate,
      // US07：迭代归属，未指定为 null
      iterationId,
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
