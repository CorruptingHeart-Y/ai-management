'use strict';
(function () {
  const bar = document.getElementById('auth-bar');
  const session = window.AppSession;
  let busy = false;
  let message = '';
  function render() {
    bar.replaceChildren();
    const account = session.user();
    if (account && session.token()) {
      const label = document.createElement('span');
      label.textContent = `${account.username}（${account.role === 'admin' ? '管理员' : '成员：可更新状态'}）`;
      const logout = document.createElement('button');
      logout.id = 'auth-logout'; logout.type = 'button'; logout.textContent = '登出'; logout.disabled = busy;
      logout.addEventListener('click', async () => {
        busy = true; message = ''; render();
        try {
          const response = await session.fetch('/api/auth/logout', { method: 'POST' });
          if (!response.ok && response.status !== 401) throw new Error('登出失败，请重试');
          session.setSession(null, null);
        } catch (error) { message = error.message || '网络异常，请重试'; }
        finally { busy = false; render(); }
      });
      bar.append(label, logout);
    } else {
      const form = document.createElement('form'); form.id = 'auth-login-form';
      const username = document.createElement('input'); username.id = 'auth-username';
      username.placeholder = '用户名'; username.autocomplete = 'username'; username.required = true;
      const password = document.createElement('input'); password.id = 'auth-password'; password.type = 'password';
      password.placeholder = '密码'; password.autocomplete = 'current-password'; password.required = true;
      const button = document.createElement('button'); button.type = 'submit'; button.textContent = '登录'; button.disabled = busy;
      form.append(username, password, button);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const credentials = { username: username.value.trim(), password: password.value };
        busy = true; message = ''; render();
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || '登录失败');
          if (typeof body.token !== 'string' || !['admin', 'member'].includes(body.role)) throw new Error('登录响应异常');
          session.setSession(body.token, body);
        } catch (error) { message = error.message || '网络异常，请重试'; }
        finally { busy = false; render(); }
      });
      bar.append(form);
    }
    const hint = document.createElement('span'); hint.id = 'auth-error'; hint.setAttribute('role', 'alert');
    hint.textContent = message; bar.append(hint);
  }
  async function refresh() {
    if (!session.token()) return render();
    try {
      const response = await session.fetch('/api/auth/me');
      if (response.status === 401) return render();
      if (!response.ok) throw new Error('暂时无法读取会话，请刷新重试');
      session.setSession(session.token(), await response.json());
    } catch (error) { message = error.message || '网络异常，请重试'; }
    render();
  }
  session.subscribe(render);
  window.addEventListener('storage', () => { message = ''; refresh(); });
  render();
  session.ready = refresh();
})();
