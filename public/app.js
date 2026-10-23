'use strict';

/**
 * 前端逻辑：调用 /api/members 与 /api/tasks 渲染页面，并提交创建任务。
 * 状态中文映射与后端统一：TODO→待办、DOING→进行中、DONE→已完成。
 */

const STATUS_LABEL = TaskContract.STATUS_LABELS;

// US06 优先级中文映射，与后端统一：HIGH→高、MEDIUM→中、LOW→低
const PRIORITY_LABEL = TaskContract.PRIORITY_LABELS;

const memberListEl = document.getElementById('member-list');
const taskListEl = document.getElementById('task-list');
const assigneeEl = document.getElementById('task-assignee');
const formEl = document.getElementById('task-form');
const messageEl = document.getElementById('form-message');
const taskMessageEl = document.getElementById('task-message');
const memberMessageEl = document.getElementById('member-message');
const memberRetryEl = document.getElementById('member-retry');
const createTaskEl = document.getElementById('create-task');
const serviceStatus = createServiceStatus(
  document.querySelector('.topbar-status'),
  document.getElementById('service-status'),
  { fetchImpl: AppSession.fetch },
);

let members = [];
let creationPending = false;
// US07：迭代 id -> 迭代对象；为空时不显示迭代控件，也不伪造选项
let iterationById = new Map();

/** 拉取迭代列表并填充「迭代」下拉框；失败则隐藏该控件，不影响创建任务。 */
async function loadIterations() {
  const field = document.getElementById('iteration-field');
  const select = document.getElementById('task-iteration');
  if (!field || !select) return;
  try {
    const res = await AppSession.fetch('/api/iterations', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const iterations = await res.json();
    iterationById = new Map(iterations.map((it) => [it.id, it]));
    select.innerHTML = '<option value="">未归属</option>';
    iterations.forEach((it) => {
      const option = document.createElement('option');
      option.value = String(it.id);
      option.textContent = it.name;
      select.appendChild(option);
    });
    field.hidden = iterations.length === 0;
  } catch {
    // 迭代接口不可用时保持隐藏：宁可没有这个字段，也不显示假选项
    field.hidden = true;
  }
}

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
    const data = await serviceStatus.check();
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
      assigneeEl.disabled = !AppSession.canWrite();
      createTaskEl.disabled = creationPending || !AppSession.canWrite();
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
  const res = await AppSession.fetch('/api/tasks');
  if (!res.ok) throw new Error('任务列表加载失败');
  const tasks = await res.json();

  taskListEl.innerHTML = '';
  if (tasks.length === 0) {
    taskListEl.innerHTML = '<li class="empty">暂无任务</li>';
    return;
  }

  tasks.forEach((t) => {
    const assignee = members.find((m) => m.id === t.assigneeId);
    // US06：旧数据可能没有 priority/dueDate，做容错，缺省显示为中
    const priority = PRIORITY_LABEL[t.priority] ? t.priority : TaskContract.DEFAULT_PRIORITY;
    const dueDate = t.dueDate || null;
    // US07：迭代名来自迭代列表；未归属或列表未加载时不显示标签，但不会显示假名字
    const iteration = iterationById.get(t.iterationId);
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-meta">
        <span class="tag">${assignee ? escapeHtml(assignee.name) : '未知成员'}</span>
        <span class="priority-badge priority-${priority.toLowerCase()}">${PRIORITY_LABEL[priority]}</span>
        ${dueDate ? `<span class="due-badge">截止 ${escapeHtml(dueDate)}</span>` : ''}
        ${iteration ? `<span class="iteration-badge">${escapeHtml(iteration.name)}</span>` : ''}
      </div>
      ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
    `;

    const statusLabel = document.createElement('label');
    statusLabel.className = 'task-status-control';
    statusLabel.textContent = '状态：';
    const statusSelect = document.createElement('select');
    statusSelect.disabled = !AppSession.canUpdateStatus();
    statusSelect.setAttribute('aria-label', `修改任务 ${t.title} 状态`);
    TaskContract.VALID_STATUSES.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = STATUS_LABEL[status];
      option.selected = status === t.status;
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener('change', async () => {
      statusSelect.disabled = true;
      try { await updateTaskStatus(t.id, statusSelect.value); }
      catch (error) {
        statusSelect.value = t.status || TaskContract.DEFAULT_STATUS;
        taskMessageEl.textContent = error.message || '状态更新请求失败，请刷新确认后重试';
      } finally { statusSelect.disabled = !AppSession.canUpdateStatus(); }
    });
    statusLabel.appendChild(statusSelect);
    li.appendChild(statusLabel);
    taskListEl.appendChild(li);
  });
}

/** 更新任务状态；后端会再次校验状态并持久化。 */
async function updateTaskStatus(taskId, status) {
  taskMessageEl.textContent = '';
  const res = await AppSession.fetch(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).catch(() => { throw new Error('状态更新请求失败，请刷新确认后重试'); });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '状态更新失败，请刷新确认后重试');
  }

  try { await loadTasks(); }
  catch { throw new Error('状态已保存，但任务列表刷新失败，请刷新页面确认'); }
}

/** 提交创建任务；失败时在界面提示。 */
async function handleSubmit(e) {
  e.preventDefault();
  if (creationPending) return;
  messageEl.textContent = '';
  if (!AppSession.canWrite()) { messageEl.textContent = '当前角色不能创建任务'; return; }

  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const assigneeId = assigneeEl.value;
  const priority = document.getElementById('task-priority').value;
  const dueDate = document.getElementById('task-due').value;
  const iterationSelect = document.getElementById('task-iteration');
  const iterationValue = iterationSelect ? iterationSelect.value : '';

  // 前端先做一层校验，给出即时反馈；后端仍会二次校验。
  if (!title) {
    messageEl.textContent = '任务标题不能为空';
    return;
  }
  if (!assigneeId) {
    messageEl.textContent = '请选择负责人';
    return;
  }

  creationPending = true;
  createTaskEl.disabled = true;
  try {
    const res = await AppSession.fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        assigneeId: Number(assigneeId),
        priority,
        dueDate: dueDate || null,
        // US07：未选迭代时传 null（后端按“未归属”处理）
        iterationId: iterationValue ? Number(iterationValue) : null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      messageEl.textContent = data.error || '创建失败';
      return;
    }

    // 成功后清空表单并刷新任务列表；刷新失败不能冒称创建失败。
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    assigneeEl.value = '';
    document.getElementById('task-priority').value = TaskContract.DEFAULT_PRIORITY;
    document.getElementById('task-due').value = '';
    const iterationReset = document.getElementById('task-iteration');
    if (iterationReset) iterationReset.value = '';
    messageEl.textContent = '任务已创建';
    try { await loadTasks(); }
    catch { messageEl.textContent = '任务已创建，但列表刷新失败。请刷新页面确认，不要重复提交。'; }
  } catch {
    messageEl.textContent = '无法确认创建结果，请先刷新任务列表确认，再决定是否重试。';
  } finally {
    creationPending = false;
    createTaskEl.disabled = !AppSession.canWrite() || members.length === 0;
  }
}

/** 转义 HTML，防止成员/任务内容注入。 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

formEl.addEventListener('submit', event => handleSubmit(event)
  .catch(() => { messageEl.textContent = '无法确认创建结果，请先刷新任务列表确认，再决定是否重试。'; }));

/** 任务加载异常独立显示，不覆盖已经成功读取的成员列表。 */
async function refreshTaskList() {
  try {
    taskMessageEl.textContent = '';
    await loadTasks();
  } catch {
    taskListEl.innerHTML = '<li class="empty">任务列表加载失败</li>';
    taskMessageEl.textContent = AppSession.token() ? '任务列表加载失败，请刷新页面重试' : '请先登录后查看任务';
  }
}

// 先取得成员再显示任务负责人；成员失败也允许查看已有任务。
async function initializePage() {
  if (!AppSession.token()) {
    members = []; iterationById.clear();
    memberListEl.innerHTML = '<li class="empty">登录后查看成员</li>';
    memberMessageEl.textContent = '请先登录后查看项目成员';
    memberRetryEl.hidden = true;
    assigneeEl.disabled = true; createTaskEl.disabled = true;
    assigneeEl.innerHTML = '<option value="">—— 请选择成员 ——</option>';
    document.getElementById('iteration-field').hidden = true;
    taskListEl.innerHTML = '<li class="empty">登录后查看任务</li>';
    taskMessageEl.textContent = '请先登录后查看任务';
    document.getElementById('service-status').textContent = '请先登录';
    document.querySelector('.topbar-status').dataset.state = 'checking';
    return;
  }
  await loadMembers();
  // 迭代列表独立加载：接口不可用只隐藏控件，不阻塞成员与任务
  await loadIterations();
  await refreshTaskList();
}

memberRetryEl.addEventListener('click', initializePage);
let sessionReady = false;
AppSession.subscribe(() => {
  if (!AppSession.user()) formEl.reset();
  if (sessionReady) initializePage();
});
AppSession.ready.then(() => { sessionReady = true; initializePage(); });
