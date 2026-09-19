'use strict';

/**
 * 测试辅助：在临时数据文件上启动独立 app 实例，避免污染 data/db.json。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');

/** 创建临时数据文件路径，并返回一个可在测试结束时清理的句柄。 */
function makeTempDataFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-mgmt-'));
  const dataFile = path.join(dir, 'db.json');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dataFile;
}

/**
 * 启动一个监听临时端口的 HTTP 服务。
 * 返回 { baseUrl, close }，close 关闭服务。
 */
function startServer(t, dataFile) {
  const app = createApp({ dataFile });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      t.after(() => server.close());
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

module.exports = { makeTempDataFile, startServer };
