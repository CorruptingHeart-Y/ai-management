'use strict';

/**
 * 数据访问层：以单个 JSON 文件作为唯一数据源。
 *
 * US01 / US04 / US05 共用这一份数据，避免三个功能各写一套假数据。
 * 持久化要求很低，因此不引入数据库，直接读写 JSON 文件即可满足
 * “创建任务后刷新页面任务仍在”的验收要求。
 *
 * 通过 createDb(dataFile) 注入文件路径，测试时传入临时文件，
 * 避免污染 data/db.json 的预置成员数据。
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateData } = require('./domain/data-integrity');

// 实验一确认的姓名和长期分工。仅在数据文件缺失时初始化；不覆盖已有数据。
/** @type {import('./domain/member').Member[]} */
const SEED_MEMBERS = [
  { id: 1, name: '彭佳成', role: '产品与范围负责人' },
  { id: 2, name: '朱传玺', role: '技术与架构负责人' },
  { id: 3, name: '杨浩伟', role: '质量与风险负责人' },
  { id: 4, name: '何健翔', role: 'AI协调与记录负责人' },
];

function createDb(dataFile) {
  const file = path.resolve(dataFile);

  function ensureInitialized() {
    if (!fs.existsSync(file)) {
      const initial = { members: SEED_MEMBERS, tasks: [] };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      writeData(initial);
      return initial;
    }
    return readData();
  }

  /** 读取整份数据；文件缺失时用预置成员初始化。 */
  function readData() {
    if (!fs.existsSync(file)) {
      return ensureInitialized();
    }
    const raw = fs.readFileSync(file, 'utf8');
    // Preserve every field, including extensions. Never normalize corrupt collections.
    return validateData(JSON.parse(raw));
  }

  /** 将整份数据写回 JSON 文件。 */
  function writeData(data) {
    validateData(data);
    // A direct caller must not overwrite a corrupt source either.
    const existing = fs.existsSync(file) ? readData() : {};
    atomicReplace(validateData({ ...existing, ...data }, { references: true }));
  }

  /** Synchronous single-process read/validate/mutate/atomic-replace operation. */
  function updateData(mutator) {
    const data = readData();
    if (mutator(data) === false) return;
    atomicReplace(validateData(data, { references: true }));
  }

  function atomicReplace(data) {
    const temporary = `${file}.write-${crypto.randomUUID()}.tmp`;
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporary, file);
    } finally {
      try { if (descriptor !== undefined) fs.closeSync(descriptor); }
      finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }
  }

  return { readData, writeData, updateData };
}

module.exports = { createDb, SEED_MEMBERS };
