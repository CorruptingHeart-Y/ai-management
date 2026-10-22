'use strict';

/**
 * 入口文件：启动 HTTP 服务。
 *
 * 运行：npm start
 * 环境变量：
 *   PORT      监听端口，默认 3000
 *   DATA_FILE 数据文件路径，默认 data/db.json（测试时传入临时文件）
 */

const { createSecuredApp } = require('./src/app');

const PORT = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error('PORT必须为0到65535的整数');
const DATA_FILE = process.env.DATA_FILE;

// 无环境变量或端口例外；npm start始终启用US03鉴权。
const app = createSecuredApp({ dataFile: DATA_FILE });

const server = app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`爱管理已启动：http://localhost:${server.address().port}`);
});
