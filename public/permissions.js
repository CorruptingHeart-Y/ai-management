'use strict';
(function () {
  const panel = document.getElementById('account-management');
  const list = document.getElementById('account-list');
  const feedback = document.getElementById('account-message');
  const summary = document.getElementById('permissions-summary');
  const session = window.AppSession;
  let revision = 0;
  async function load() {
    const version = ++revision;
    list.replaceChildren(); feedback.textContent = '';
    const account = session.user();
    summary.textContent = !account ? '请先登录。' : session.canWrite()
      ? '管理员：可创建任务、更新状态和管理角色。' : '普通成员：可查看、筛选任务和更新任务状态；不能创建任务或管理角色。';
    panel.hidden = !session.canWrite();
    if (panel.hidden) return;
    try {
      const response = await session.fetch('/api/users');
      if (!response.ok) throw new Error((await response.json()).error || '账号读取失败');
      const users = await response.json();
      if (version !== revision) return;
      for (const user of users) {
        const item = document.createElement('li');
        const name = document.createElement('span'); name.textContent = `${user.username} `;
        const select = document.createElement('select'); select.setAttribute('aria-label', `账号 ${user.username} 角色`);
        for (const role of ['admin', 'member']) {
          const option = document.createElement('option'); option.value = role;
          option.textContent = role === 'admin' ? '管理员' : '普通成员'; option.selected = role === user.role; select.append(option);
        }
        const save = document.createElement('button'); save.type = 'button'; save.textContent = '保存角色';
        save.addEventListener('click', async () => {
          save.disabled = true; feedback.textContent = '';
          try {
            const updated = await session.fetch(`/api/users/${user.id}/role`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: select.value }),
            });
            const body = await updated.json();
            if (!updated.ok) throw new Error(body.error || '角色更新失败');
            if (body.sessionsRevoked && user.id === session.user()?.id) session.setSession(null, null);
            else { await load(); feedback.textContent = '角色已保存；发生变化的账号需要重新登录。'; }
          } catch (error) { feedback.textContent = error.message || '网络异常，请重试'; save.disabled = false; }
        });
        item.append(name, select, save); list.append(item);
      }
    } catch (error) {
      if (version === revision) feedback.textContent = error.message || '网络异常，请重试';
    }
  }
  document.getElementById('account-refresh').addEventListener('click', load);
  session.subscribe(load);
  session.ready.then(load);
})();
