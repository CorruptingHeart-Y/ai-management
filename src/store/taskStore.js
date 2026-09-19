// 任务存储层：使用 JSON 文件做持久化，保证刷新 / 重启后数据仍存在。
// 通过构造参数注入文件路径，便于在测试中使用临时文件，避免污染真实数据。

const fs = require('fs');
const path = require('path');

// 默认任务数据文件路径
const DEFAULT_TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

class TaskStore {
  /**
   * @param {string} filePath JSON 数据文件路径
   */
  constructor(filePath = DEFAULT_TASKS_FILE) {
    this.filePath = filePath;
  }

  /**
   * 读取全部任务。
   * @returns {Array<object>} 任务数组
   */
  load() {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * 将全部任务写回文件，实现持久化。
   * @param {Array<object>} tasks 任务数组
   */
  save(tasks) {
    fs.writeFileSync(this.filePath, JSON.stringify(tasks, null, 2), 'utf-8');
  }
}

module.exports = { TaskStore, DEFAULT_TASKS_FILE };
