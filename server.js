'use strict';

/**
 * 入口文件：启动 HTTP 服务。
 *
 * 运行：npm start
 * 环境变量：
 *   PORT      监听端口，默认 3000
 *   DATA_FILE 数据文件路径，默认 data/db.json（测试时传入临时文件）
 */

const { createApp } = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE;

const app = createApp({ dataFile: DATA_FILE });

app.listen(PORT, () => {
  console.log(`爱管理已启动：http://localhost:${PORT}`);
});
