'use strict';

/**
 * E2E 公共辅助。
 *
 * 设计前提：本轮鉴权是分批落地的——US02 只做登录/会话（不挂拦截），US03 才挂权限中间件。
 * 因此 E2E 不能写死"必须 401"或"必须 200"，而是先探测能力、再按当前能力断言，
 * 并在同一份测试里兼容"未登录可访问"和"未登录被拦截"两种状态。
 * 这样：develop 上能跑（无鉴权，记为 skip 分支），US02 合入后能跑，US03 合入后仍然能跑。
 */

const { makeTempDataFile, startServer } = require('../helpers');

const DEFAULT_MEMBERS = [
  { id: 1, name: '彭佳成', role: '产品与范围负责人' },
  { id: 2, name: '朱传玺', role: '技术与架构负责人' },
  { id: 3, name: '杨浩伟', role: '质量与风险负责人' },
  { id: 4, name: '何健翔', role: 'AI协调与记录负责人' },
];

const DEFAULT_ITERATIONS = [
  { id: 1, name: 'Sprint 1' },
  { id: 2, name: 'Sprint 2' },
  { id: 3, name: 'Sprint 3' },
];

/** 演示账号来自 US02 测试常量；可用环境变量覆盖，避免把口令散落到多处。 */
const DEMO_ADMIN = {
  username: process.env.E2E_ADMIN_USER || 'admin',
  password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
};

async function getJson(url, options) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: res.headers };
}

/** 探测鉴权是否已落地：/api/auth/me 返回 401 或 200 说明接口存在，404 说明还没有。 */
async function authCapability(baseUrl) {
  const probe = await getJson(`${baseUrl}/api/auth/me`);
  const exists = probe.status === 401 || probe.status === 200;
  return { exists, meStatus: probe.status };
}

/** 登录；接口不存在时返回 { ok:false, reason:'NO_AUTH' }，不抛错。 */
async function login(baseUrl, credentials = DEMO_ADMIN) {
  const res = await getJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (res.status === 200 && res.body && res.body.token) {
    return { ok: true, token: res.body.token, user: res.body };
  }
  if (res.status === 404) return { ok: false, reason: 'NO_AUTH' };
  return { ok: false, reason: `LOGIN_FAILED_${res.status}`, body: res.body };
}

function authHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** 一次请求同时兼容"需要鉴权"与"不需要鉴权"两种环境。 */
async function requestWithSession(baseUrl, pathname, options = {}, token) {
  const headers = { ...(options.headers || {}), ...authHeaders(token) };
  return getJson(`${baseUrl}${pathname}`, { ...options, headers });
}

function seedData(tasks = []) {
  return { members: DEFAULT_MEMBERS, tasks, iterations: DEFAULT_ITERATIONS };
}

module.exports = {
  DEFAULT_MEMBERS,
  DEFAULT_ITERATIONS,
  DEMO_ADMIN,
  getJson,
  authCapability,
  login,
  authHeaders,
  requestWithSession,
  seedData,
  makeTempDataFile,
  startServer,
};
