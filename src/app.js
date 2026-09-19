// Express 应用组装。使用工厂函数便于测试时注入自定义存储。

const express = require('express');
const path = require('path');
const { TaskStore } = require('./store/taskStore');
const { createTasksRouter } = require('./routes/tasks');

function createApp(taskStore = new TaskStore()) {
  const app = express();

  app.use(express.json());
  // 静态资源：前端页面
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/tasks', createTasksRouter(taskStore));

  return app;
}

module.exports = { createApp };
