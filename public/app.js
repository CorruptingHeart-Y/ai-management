'use strict';

/**
 * 前端逻辑：调用 /api/members 与 /api/tasks 渲染页面，并提交创建任务。
 * 状态中文映射与后端统一：TODO→待办、DOING→进行中、DONE→已完成。
 */

const STATUS_LABEL = {
  TODO: '待办',
  DOING: '进行中',
  DONE: '已完成',
};

const memberListEl = document.getElementById('member-list');
const taskListEl = document.getElementById('task-list');
const assigneeEl = document.getElementById('task-assignee');
const formEl = document.getElementById('task-form');
const messageEl = document.getElementById('form-message');
const taskMessageEl = document.getElementById('task-message');

let members = [];

/** 拉取并渲染成员列表，同时填充负责人下拉框。 */
async function loadMembers() {
  const res = await fetch('/api/members');
  members = await res.json();

  // 成员列表
  memberListEl.innerHTML = '';
  members.forEach((m) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="name">${escapeHtml(m.name)}</span><span class="role">${escapeHtml(m.role)}</span>`;
    memberListEl.appendChild(li);
  });

  // 负责人下拉框（保持“请选择成员”占位项）
  assigneeEl.innerHTML = '<option value="">—— 请选择成员 ——</option>';
  members.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = String(m.id);
    opt.textContent = `${m.name}（${m.role}）`;
    assigneeEl.appendChild(opt);
  });
}

/** 拉取并渲染任务列表。 */
async function loadTasks() {
  const res = await fetch('/api/tasks');
  const tasks = await res.json();

  taskListEl.innerHTML = '';
  if (tasks.length === 0) {
    taskListEl.innerHTML = '<li class="empty">暂无任务</li>';
    return;
  }

  tasks.forEach((t) => {
    const assignee = members.find((m) => m.id === t.assigneeId);
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-meta">
        <span class="tag">${assignee ? escapeHtml(assignee.name) : '未知成员'}</span>
      </div>
      ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
    `;

    const statusLabel = document.createElement('label');
    statusLabel.className = 'task-status-control';
    statusLabel.textContent = '状态：';
    const statusSelect = document.createElement('select');
    statusSelect.setAttribute('aria-label', `修改任务 ${t.title} 状态`);
    ['TODO', 'DOING', 'DONE'].forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = STATUS_LABEL[status];
      option.selected = status === t.status;
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener('change', () => updateTaskStatus(t.id, statusSelect.value));
    statusLabel.appendChild(statusSelect);
    li.appendChild(statusLabel);
    taskListEl.appendChild(li);
  });
}

/** 更新任务状态；后端会再次校验状态并持久化。 */
async function updateTaskStatus(taskId, status) {
  taskMessageEl.textContent = '';
  const res = await fetch(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    taskMessageEl.textContent = data.error || '状态更新失败';
    return;
  }

  await loadTasks();
}

/** 提交创建任务；失败时在界面提示。 */
async function handleSubmit(e) {
  e.preventDefault();
  messageEl.textContent = '';

  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const assigneeId = assigneeEl.value;

  // 前端先做一层校验，给出即时反馈；后端仍会二次校验。
  if (!title) {
    messageEl.textContent = '任务标题不能为空';
    return;
  }
  if (!assigneeId) {
    messageEl.textContent = '请选择负责人';
    return;
  }

  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      assigneeId: Number(assigneeId),
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    messageEl.textContent = data.error || '创建失败';
    return;
  }

  // 成功后清空表单并刷新任务列表
  document.getElementById('task-title').value = '';
  document.getElementById('task-desc').value = '';
  assigneeEl.value = '';
  await loadTasks();
}

/** 转义 HTML，防止成员/任务内容注入。 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

formEl.addEventListener('submit', handleSubmit);

// 页面加载时并行拉取成员与任务
loadMembers().then(loadTasks).catch((err) => {
  console.error('初始化失败：', err);
  memberListEl.innerHTML = '<li class="empty">加载失败</li>';
  taskListEl.innerHTML = '<li class="empty">加载失败</li>';
});
