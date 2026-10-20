'use strict';

/**
 * 登录状态条（US02 登录的前端部分）。
 * 独立文件，只负责登录 / 登出 / 当前用户展示；不做任何权限控制（那是 US03）。
 * token 存 localStorage，刷新后仍保持登录态。
 */

const TOKEN_KEY = 'ai-mgmt-token';

const authBarEl = document.getElementById('auth-bar');

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function roleLabel(role) {
  return role === 'admin' ? '管理员' : '成员';
}

async function fetchMe(token) {
  const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

function render() {
  const token = getToken();
  if (!token) {
    authBarEl.innerHTML = `
      <form id="auth-login-form" class="auth-login">
        <input id="auth-username" type="text" placeholder="用户名" autocomplete="username" />
        <input id="auth-password" type="password" placeholder="密码" autocomplete="current-password" />
        <button type="submit">登录</button>
      </form>
    `;
    authBarEl.querySelector('#auth-login-form').addEventListener('submit', handleLogin);
    return;
  }

  fetchMe(token).then((me) => {
    if (!me) {
      // token 失效（重启后内存清空）：清掉本地 token，回到未登录态
      setToken(null);
      render();
      return;
    }
    authBarEl.innerHTML = `
      <span class="auth-user">${escapeHtml(me.username)}（${roleLabel(me.role)}）</span>
      <button id="auth-logout" type="button">登出</button>
    `;
    authBarEl.querySelector('#auth-logout').addEventListener('click', handleLogout);
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const username = authBarEl.querySelector('#auth-username').value.trim();
  const password = authBarEl.querySelector('#auth-password').value;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    window.alert(data.error || '登录失败');
    return;
  }
  const body = await res.json();
  setToken(body.token);
  render();
}

async function handleLogout() {
  const token = getToken();
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  setToken(null);
  render();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

render();
