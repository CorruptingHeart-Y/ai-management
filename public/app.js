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
const memberMessageEl = document.getElementById('member-message');
const memberRetryEl = document.getElementById('member-retry');
const createTaskEl = document.getElementById('create-task');

let members = [];

/** 拉取并渲染成员列表，同时填充负责人下拉框。 */
async function loadMembers() {
  members = [];
  memberListEl.innerHTML = '<li class="empty">加载中…</li>';
  memberListEl.setAttribute('aria-busy', 'true');
  memberMessageEl.textContent = '正在加载项目成员…';
  memberRetryEl.hidden = true;
  assigneeEl.disabled = true;
  createTaskEl.disabled = true;
  assigneeEl.innerHTML = '<option value="">—— 请选择成员 ——</option>';
  try {
    const res = await fetch('/api/members');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || '成员加载失败，请稍后重试');
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('成员数据格式错误，请稍后重试');
    members = data;

    // 用同一个响应生成列表与负责人选项，避免成员数据分叉。
    memberListEl.innerHTML = '';
    members.forEach((m) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = m.name;
      const role = document.createElement('span');
      role.className = 'role';
      role.textContent = m.role;
      li.append(name, role);
      memberListEl.appendChild(li);

      const opt = document.createElement('option');
      opt.value = String(m.id);
      opt.textContent = `${m.name}（${m.role}）`;
      assigneeEl.appendChild(opt);
    });

    if (members.length === 0) {
      memberListEl.innerHTML = '<li class="empty">暂无项目成员</li>';
      memberMessageEl.textContent = '暂无可分配的成员，暂时无法创建任务。';
      memberRetryEl.hidden = false;
    } else {
      memberMessageEl.textContent = `共 ${members.length} 位成员，创建任务时可从以下成员中选择负责人。`;
      assigneeEl.disabled = false;
      createTaskEl.disabled = false;
    }
  } catch (err) {
    memberListEl.innerHTML = '<li class="empty">成员加载失败</li>';
    memberMessageEl.textContent = err.message || '成员加载失败，请稍后重试';
    memberRetryEl.hidden = false;
  } finally {
    memberListEl.setAttribute('aria-busy', 'false');
  }
}

/** 拉取并渲染任务列表。 */
async function loadTasks() {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error('任务列表加载失败');
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

/** 任务加载异常独立显示，不覆盖已经成功读取的成员列表。 */
async function refreshTaskList() {
  try {
    taskMessageEl.textContent = '';
    await loadTasks();
  } catch {
    taskListEl.innerHTML = '<li class="empty">任务列表加载失败</li>';
    taskMessageEl.textContent = '任务列表加载失败，请刷新页面重试';
  }
}

// 先取得成员再显示任务负责人；成员失败也允许查看已有任务。
async function initializePage() {
  await loadMembers();
  await refreshTaskList();
}

memberRetryEl.addEventListener('click', initializePage);
initializePage();
