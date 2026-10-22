'use strict';

/**
 * US10 状态统计页面逻辑。
 *
 * 只做三件事：取数、渲染、报错。
 * 渲染全部走 textContent / createElement，不拼 innerHTML —— 任务标题、成员姓名、迭代名
 * 都来自数据文件，拼接字符串等于把注入风险带进页面（Sprint 1 曾专门处理过文本注入）。
 * 独立文件的好处：不碰 public/app.js，与 US06/US07 的前端改动在合并时互不冲突。
 */

(function init() {
  const STATUS_META = [
    { key: 'TODO', label: '待办', tone: 'todo' },
    { key: 'DOING', label: '进行中', tone: 'doing' },
    { key: 'DONE', label: '已完成', tone: 'done' },
  ];
  const PRIORITY_META = [
    { key: 'HIGH', label: '高', tone: 'done' },
    { key: 'MEDIUM', label: '中', tone: 'doing' },
    { key: 'LOW', label: '低', tone: 'todo' },
  ];

  const el = (id) => document.getElementById(id);
  const stateBox = el('stats-state');
  const updated = el('stats-updated');
  const refreshBtn = el('stats-refresh');

  /** 一行「名称 + 条形 + 数字」。 */
  function makeRow(name, count, max, tone) {
    const row = document.createElement('div');
    row.className = 'stats-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'stats-row-name';
    nameEl.textContent = name;
    nameEl.title = name;

    const bar = document.createElement('span');
    bar.className = 'stats-bar';
    const fill = document.createElement('span');
    fill.className = 'stats-bar-fill';
    if (tone) fill.dataset.tone = tone;
    fill.style.width = max > 0 ? `${Math.round((count / max) * 100)}%` : '0%';
    bar.appendChild(fill);

    const num = document.createElement('span');
    num.className = 'stats-num';
    num.textContent = String(count);

    row.append(nameEl, bar, num);
    return row;
  }

  function renderList(container, rows) {
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'stats-row stats-muted';
      empty.textContent = '暂无数据';
      container.appendChild(empty);
      return;
    }
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    for (const row of rows) {
      container.appendChild(makeRow(row.name, row.count, max, row.tone));
    }
  }

  function showState(tone, message) {
    if (!message) {
      stateBox.dataset.visible = 'false';
      stateBox.textContent = '';
      stateBox.removeAttribute('data-tone');
      return;
    }
    stateBox.dataset.visible = 'true';
    stateBox.dataset.tone = tone;
    stateBox.textContent = message;
  }

  function setKpis(stats) {
    el('kpi-total').textContent = String(stats.total);
    el('kpi-todo').textContent = String(stats.byStatus.TODO);
    el('kpi-doing').textContent = String(stats.byStatus.DOING);
    el('kpi-done').textContent = String(stats.byStatus.DONE);
  }

  function render(stats) {
    setKpis(stats);

    renderList(
      el('list-status'),
      STATUS_META.map((m) => ({ name: m.label, count: stats.byStatus[m.key], tone: m.tone }))
    );

    renderList(
      el('list-priority'),
      PRIORITY_META.map((m) => ({
        name: m.label,
        count: stats.byPriority ? stats.byPriority[m.key] : 0,
        tone: m.tone,
      }))
    );

    renderList(
      el('list-assignee'),
      stats.byAssignee.map((row) => ({
        name: row.count === 0 ? `${row.name}（空闲）` : row.name,
        count: row.count,
      }))
    );

    renderList(
      el('list-iteration'),
      stats.byIteration.map((row) => ({
        name: row.iterationId === null ? '未分配' : row.name,
        count: row.count,
      }))
    );

    if (stats.total === 0) {
      showState('empty', '目前还没有任务。到工作台创建一个任务，这里的数字会跟着变化。');
    } else {
      showState('', '');
    }
    const now = new Date();
    updated.textContent = `已更新 ${now.toLocaleTimeString('zh-CN', { hour12: false })}`;
  }

  async function load() {
    refreshBtn.disabled = true;
    try {
      const res = await AppSession.fetch('/api/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 401 ? '请返回工作台登录' : res.status === 403 ? '当前账号无读取权限' : `HTTP ${res.status}`);
      const stats = await res.json();
      render(stats);
    } catch (error) {
      // 明确区分“没有数据”和“读不到数据”，避免把故障显示成 0 任务
      updated.textContent = '读取失败';
      showState('error', `统计数据读取失败（${error.message}）。请确认服务已启动，然后点击「刷新」重试。`);
      for (const id of ['kpi-total', 'kpi-todo', 'kpi-doing', 'kpi-done']) {
        el(id).textContent = '—';
      }
      for (const id of ['list-status', 'list-priority', 'list-assignee', 'list-iteration']) {
        if (el(id)) el(id).replaceChildren();
      }
    } finally {
      refreshBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener('click', load);
  AppSession.subscribe(load);
  load();
})();
