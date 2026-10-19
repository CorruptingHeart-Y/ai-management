'use strict';

const express = require('express');
const { buildStats } = require('../domain/stats');

/**
 * 统计路由（US10 状态统计）。
 *
 *   GET /api/stats  返回任务总数、按状态、按优先级、按负责人、按迭代的分布
 *
 * 设计取舍：
 *   - 只读接口，不写数据文件，因此不会与 US06/US07 的写操作抢文件；
 *   - 全部统计在内存里算，数据量是本课程的原型级，不做缓存，避免“数字落后于列表”；
 *   - 数据文件损坏时返回 500 与可读提示，不返回半截数据，也不伪造 0。
 *
 * @param {object} db createDb 返回的数据访问对象
 */
function createStatsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    // 统计必须反映当前数据，禁止浏览器缓存旧结果
    res.set('Cache-Control', 'no-store');
    try {
      const data = db.readData();
      return res.json(buildStats(data));
    } catch {
      return res.status(500).json({ error: '统计数据暂时无法读取，请稍后重试' });
    }
  });

  return router;
}

module.exports = { createStatsRouter };
