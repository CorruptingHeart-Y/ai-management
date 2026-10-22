'use strict';

(function () {
  const el = (id) => document.getElementById(id);
  const form = el('filters');
  const fields = ['q', 'status', 'priority', 'assigneeId', 'iterationId'];
  const statusLabels = { TODO: '待办', DOING: '进行中', DONE: '已完成' };
  const priorityLabels = { HIGH: '高', MEDIUM: '中', LOW: '低' };
  let members = [];
  let iterations = [];
  let snapshot = null;
  let overdueOnly = false;
  let requestId = 0;
  let pending;
  let searchTimer;
  let optionsReady = false;

  async function request(url, signal) {
    let response;
    try { response = await window.AppSession.fetch(url, { signal }); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('网络连接失败或登录状态已变化，请重试');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.error || '暂时无法读取任务，请稍后重试');
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function option(select, value, text) {
    const item = document.createElement('option');
    item.value = String(value);
    item.textContent = text;
    select.appendChild(item);
  }

  function fillOptions() {
    const assignee = form.elements.assigneeId;
    const iteration = form.elements.iterationId;
    const selected = [assignee.value, iteration.value];
    assignee.replaceChildren();
    iteration.replaceChildren();
    option(assignee, '', '全部负责人');
    option(iteration, '', '全部迭代');
    option(iteration, 'unassigned', '未归属');
    members.forEach((member) => option(assignee, member.id, member.name));
    iterations.forEach((item) => option(iteration, item.id, item.name));
    [assignee, iteration].forEach((select, index) => {
      if (selected[index] && ![...select.options].some((item) => item.value === selected[index])) {
        option(select, selected[index], `未知 #${selected[index]}`);
      }
      select.value = selected[index];
    });
  }

  function clearOptions() {
    members = [];
    iterations = [];
    optionsReady = false;
    form.elements.assigneeId.replaceChildren();
    form.elements.iterationId.replaceChildren();
    option(form.elements.assigneeId, '', '全部负责人');
    option(form.elements.iterationId, '', '全部迭代');
    option(form.elements.iterationId, 'unassigned', '未归属');
  }

  function setTabs() {
    el('view-all').setAttribute('aria-pressed', String(!overdueOnly));
    el('view-overdue').setAttribute('aria-pressed', String(overdueOnly));
  }

  function readLocation() {
    const params = new URLSearchParams(location.search);
    for (const name of fields) {
      const value = params.get(name) || '';
      const field = form.elements[name];
      if (field.tagName === 'SELECT' && value && ![...field.options].some((item) => item.value === value)) {
        option(field, value, `未知 #${value}`);
      }
      field.value = value;
    }
    overdueOnly = params.get('overdue') === 'true';
    el('group-iteration').checked = params.get('group') === 'iteration';
    setTabs();
  }

  function parameters() {
    const params = new URLSearchParams();
    for (const name of fields) {
      const value = form.elements[name].value.trim();
      if (value) params.set(name, value);
    }
    if (overdueOnly) params.set('overdue', 'true');
    return params;
  }

  function saveLocation() {
    const params = parameters();
    if (el('group-iteration').checked) params.set('group', 'iteration');
    const query = params.toString();
    const url = `${location.pathname}${query ? `?${query}` : ''}`;
    if (`${location.pathname}${location.search}` !== url) history.pushState(null, '', url);
  }

  function badge(text, className) {
    const node = document.createElement('span');
    node.className = `badge ${className}`;
    node.textContent = text;
    return node;
  }

  function validDueDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 100 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  }

  function table(tasks) {
    const node = document.createElement('table');
    node.className = 'task-table';
    const thead = node.createTHead();
    const heading = thead.insertRow();
    const labels = ['任务', '负责人', '状态', '优先级', '截止时间'];
    labels.forEach((label) => {
      const cell = document.createElement('th');
      cell.scope = 'col'; cell.textContent = label; heading.appendChild(cell);
    });
    const tbody = node.createTBody();
    for (const task of tasks) {
      const row = tbody.insertRow();
      row.dataset.taskId = String(task.id);
      const cells = labels.map((label) => {
        const cell = row.insertCell(); cell.dataset.label = label; return cell;
      });
      const title = document.createElement('p');
      title.className = 'task-title';
      const id = document.createElement('span');
      id.className = 'task-id'; id.textContent = `#${task.id}`;
      title.append(id, document.createTextNode(task.title));
      cells[0].appendChild(title);
      if (task.description) {
        const description = document.createElement('p');
        description.className = 'task-description'; description.textContent = task.description;
        cells[0].appendChild(description);
      }
      const iteration = iterations.find((item) => item.id === task.iterationId);
      const iterationLabel = document.createElement('span');
      iterationLabel.className = 'task-iteration';
      iterationLabel.textContent = task.iterationId == null ? '未归属' :
        iteration ? iteration.name : `未知迭代 #${task.iterationId}`;
      cells[0].appendChild(iterationLabel);
      cells[1].textContent = members.find((member) => member.id === task.assigneeId)?.name || `未知成员 #${task.assigneeId}`;
      const status = task.status == null || task.status === '' ? 'TODO' : task.status;
      const priority = task.priority == null || task.priority === '' ? 'MEDIUM' : task.priority;
      cells[2].appendChild(badge(statusLabels[status] || '未知状态', statusLabels[status] ? `status-${status.toLowerCase()}` : 'status-todo'));
      cells[3].appendChild(badge(priorityLabels[priority] || '未知优先级', priorityLabels[priority] ? `priority-${priority.toLowerCase()}` : 'priority-low'));
      const date = document.createElement('span');
      date.className = 'due-date';
      date.textContent = task.dueDate || '未设置';
      if (!task.dueDate) date.classList.add('no-date');
      cells[4].appendChild(date);
      if (validDueDate(task.dueDate) &&
          task.dueDate < snapshot.today && status !== 'DONE') {
        // Query metadata is authoritative; do not use the browser UTC date.
        date.classList.add('overdue');
        const label = document.createElement('span');
        label.className = 'overdue-label'; label.textContent = '已逾期';
        cells[4].appendChild(label);
      }
    }
    return node;
  }

  function render() {
    const results = el('results');
    results.replaceChildren();
    if (!snapshot) return;
    if (snapshot.tasks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = snapshot.total === 0 ? '暂无任务' : '没有符合条件的任务';
      results.appendChild(empty);
      return;
    }
    if (!el('group-iteration').checked) {
      results.appendChild(table(snapshot.tasks));
      return;
    }
    for (const group of IterationView.groupTasks(snapshot.tasks, iterations)) {
      const heading = document.createElement('h3');
      heading.className = 'group-heading';
      heading.textContent = group.missing ? `未知迭代 #${group.iterationId}` :
        group.iterationId === null ? '未归属' : group.name;
      const count = document.createElement('span'); count.textContent = String(group.tasks.length);
      heading.appendChild(count);
      results.append(heading, table(group.tasks));
    }
  }

  function clearResults() {
    snapshot = null;
    el('results').replaceChildren();
    for (const id of ['total-count', 'overdue-count', 'matched-count']) el(id).textContent = '-';
    el('as-of').textContent = '';
  }

  async function load(refreshOptions = false) {
    const sequence = ++requestId;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const signal = controller.signal;
    const timeout = setTimeout(() => controller.abort(), 12000);
    el('results').setAttribute('aria-busy', 'true');
    el('failure').hidden = true;
    el('refresh').disabled = true;
    el('login-link').hidden = true;
    clearResults();
    el('notice').textContent = '正在读取任务…';
    el('notice').hidden = false;
    try {
      if (refreshOptions || !optionsReady) {
        const [memberData, iterationData] = await Promise.all([
          request('/api/members', signal), request('/api/iterations', signal),
        ]);
        if (sequence !== requestId) return;
        if (!Array.isArray(memberData) || !Array.isArray(iterationData) ||
            !memberData.every((item) => item && Number.isSafeInteger(item.id) && typeof item.name === 'string') ||
            !iterationData.every((item) => item && Number.isSafeInteger(item.id) && typeof item.name === 'string')) {
          throw new Error('列表数据格式异常');
        }
        members = memberData;
        iterations = iterationData;
        fillOptions();
        optionsReady = true;
      }
      const data = await request(`/api/task-query?${parameters()}`, signal);
      if (sequence !== requestId) return;
      if (!Array.isArray(data.tasks) || !Number.isSafeInteger(data.total) ||
          !Number.isSafeInteger(data.matched) || !Number.isSafeInteger(data.overdueCount) ||
          typeof data.today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.today)) {
        throw new Error('任务数据格式异常');
      }
      snapshot = data;
      el('total-count').textContent = String(data.total);
      el('overdue-count').textContent = String(data.overdueCount);
      el('matched-count').textContent = String(data.matched);
      el('as-of').textContent = `截至 ${data.today}`;
      el('notice').hidden = true;
      render();
    } catch (error) {
      if (sequence !== requestId) return;
      clearResults();
      el('notice').hidden = true;
      el('failure').hidden = false;
      if (error.status === 401) {
        clearOptions();
        try { localStorage.removeItem('ai-mgmt-token'); } catch { /* Storage may be disabled. */ }
        el('failure-message').textContent = '登录已失效，请返回工作台重新登录。';
        el('login-link').hidden = false;
      } else if (error.status === 403) {
        clearOptions();
        el('failure-message').textContent = '当前账号没有查看任务的权限。';
      } else if (error.name === 'AbortError') {
        el('failure-message').textContent = '读取超时，请稍后重试。';
      } else {
        el('failure-message').textContent = error.message || '暂时无法读取任务，请稍后重试';
      }
    } finally {
      clearTimeout(timeout);
      if (sequence === requestId) {
        el('results').setAttribute('aria-busy', 'false');
        el('refresh').disabled = false;
      }
    }
  }

  function apply() {
    clearTimeout(searchTimer);
    saveLocation();
    load();
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); apply(); });
  form.addEventListener('change', (event) => { if (event.target.tagName === 'SELECT') apply(); });
  form.elements.q.addEventListener('input', () => {
    clearTimeout(searchTimer); searchTimer = setTimeout(apply, 250);
  });
  el('reset').addEventListener('click', () => {
    for (const name of fields) form.elements[name].value = '';
    overdueOnly = false; el('group-iteration').checked = false; setTabs(); apply();
  });
  el('view-all').addEventListener('click', () => { overdueOnly = false; setTabs(); apply(); });
  el('view-overdue').addEventListener('click', () => { overdueOnly = true; setTabs(); apply(); });
  el('group-iteration').addEventListener('change', () => { saveLocation(); render(); });
  el('refresh').addEventListener('click', () => load(true));
  el('retry').addEventListener('click', () => load(true));
  window.addEventListener('popstate', () => { readLocation(); load(true); });
  window.addEventListener('storage', (event) => {
    if (event.key === 'ai-mgmt-token' || event.key === null) { clearResults(); clearOptions(); load(true); }
  });
  readLocation();
  load(true);
}());
