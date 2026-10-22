'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.AppSession = factory(root);
})(typeof window === 'undefined' ? globalThis : window, function createSession(env) {
  const key = 'ai-mgmt-token';
  let user = null;
  const listeners = new Set();
  function token() { try { return env.localStorage.getItem(key); } catch { return null; } }
  function emit() { for (const listener of listeners) listener(); }
  function setSession(value, account) {
    const before = token();
    const old = JSON.stringify(user);
    if (value) env.localStorage.setItem(key, value); else env.localStorage.removeItem(key);
    user = account ? { id: account.id, username: account.username, role: account.role } : null;
    if (before !== token() || old !== JSON.stringify(user)) emit();
  }
  async function apiFetch(url, options = {}) {
    const target = new URL(url, env.location.href);
    if (target.origin !== env.location.origin || !target.pathname.startsWith('/api/')) throw new Error('会话请求仅允许同源API');
    const captured = token();
    const headers = new Headers(options.headers);
    if (captured) headers.set('Authorization', `Bearer ${captured}`);
    const response = await env.fetch(target.href, { ...options, headers, cache: 'no-store' });
    if (captured !== token()) throw new Error('登录状态已变化，请重试');
    if (response.status === 401 && captured) setSession(null, null);
    const parse = response.json.bind(response);
    response.json = async () => {
      const body = await parse();
      if (response.status !== 401 && captured !== token()) throw new Error('登录状态已变化，请重试');
      return body;
    };
    return response;
  }
  env.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { user = null; emit(); }
  });
  return { token, setSession, fetch: apiFetch, user: () => user,
    canWrite: () => !!token() && user?.role === 'admin',
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    ready: Promise.resolve() };
});
