// 服务入口：启动 HTTP 服务用于本地演示。

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`爱管理 Sprint 1 服务已启动: http://localhost:${PORT}`);
});
