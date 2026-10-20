# US02 登录 · 契约与准备材料（朱传玺起草，计划会冻结）

起草人：朱传玺（DRI／PO／SM，契约 owner）　日期：2026-10-20　对象：计划会

---

## 一、US02 契约草案

### 1.1 边界（先锁死，最重要）

US02 只做**登录 / 登出 / 会话 / 凭证校验**。**不挂全局鉴权拦截**——那是 US03 的事。
US02 落地后，既有 4 个路由（members/tasks/stats/iterations）继续**免登录可访问**，US03 才挂权限中间件。
这样 US02 对既有路由**零侵入**，基线 62 项（57 + 集成 5）一个不破。

### 1.2 账号实体

```
User = { id: number, username: string, passwordHash: string, role: 'admin' | 'member' }
```

- `role` 是**权限角色**，区别于 `Member.role`（实验一团队分工，如「技术与架构负责人」）——两者是不同概念，不复用。
- 预置账号 4 个：`admin`=朱传玺（role=admin）；`pengjiacheng`/`yanghaowei`/`hejianxiang`=其余三人（role=member）。
  初始明文密码在计划会纪要表 2 记录（用于演示与测试），代码与 db.json **只存哈希，不存明文**。

### 1.3 存储

- 账号存 `data/db.json` 的 `users` 集合，**惰性写入**：首次登录请求时才写入预置账号。
- `ensureInitialized()` 默认结构**不变**（仍 `{ members, tasks }`）；`readData()` 对 `users` 条件透传（沿用 TD-S2-01 对 `iterations` 的写法：文件里存在才透传）。
- 密码用 node 内置 `crypto.scrypt` 哈希 + 随机盐，**不新增任何 npm 依赖**（package.json 仍只有 express）。

> 为什么惰性写入：`test/members.test.js` 第 41、117 行有 `deepEqual(readData(file), { members, tasks })` 整体对象断言。
> 若把 `users` 塞进默认初始化结构，这两处立即变红。惰性写入 + 条件透传保证「无登录请求的既有测试流程」永远不写 users。

### 1.4 会话

- 登录成功返回 `token` = `crypto.randomBytes(32).toString('hex')`。
- `token → userId` 映射存**内存 Map**（进程内），重启失效。诚实注明：这是教学原型，不做持久会话。
- 后续请求带 `Authorization: Bearer <token>`。

### 1.5 接口

| 接口 | 请求 | 成功 | 失败 |
|---|---|---|---|
| `POST /api/auth/login` | `{ username, password }` | 200 `{ token, id, username, role }` | 400 缺字段；401 凭证错误 |
| `POST /api/auth/logout` | 带 Bearer token | 200（清除该 token） | 401 无有效 token |
| `GET /api/auth/me` | 带 Bearer token | 200 `{ id, username, role }` | 401 未登录／token 无效 |

### 1.6 错误码

- `400` 缺字段 / 格式错（username、password 为空）
- `401` 凭证错误 / 未登录 / token 无效
- `500` 数据文件损坏（沿用现有「中文可读提示」风格）
- `403` **归 US03**，US02 不产出 403。

### 1.7 不破坏基线（DoD 前置）

1. 不改 `ensureInitialized` 默认结构、不改既有 4 路由行为、不改既有 8 个测试文件一行断言。
2. `users` 惰性写入 + 条件透传，`members.test.js` 整体对象断言不红。
3. 密码哈希不进明文；`data/db.json` 与代码中不出现明文密码。

---

## 二、US02 验收标准（3 条，可断言／点击验证）

1. **登录成功/失败**：正确凭证 `POST /api/auth/login` 返回 200 与 token；错误凭证返回 401 且不建立会话。
2. **会话有效/登出失效**：登录后 `GET /api/auth/me` 带 token 返回当前用户；登出后（或无效 token）返回 401。
3. **不破坏基线**：落地后 `npm test` 57 项 + 集成 5 项全绿、0 失败；`data/db.json` 与代码中无明文密码（哈希存储）。

> 与 US03 的依赖点：验收 1、2 产出的 **token 会话**是 US03 权限中间件的输入；US03 依赖「Bearer token → 当前用户」这条链路稳定。

---

## 三、预计文件改动清单（标注与他人交集）

| 文件 | 改动 | 是否公共文件 | 交集 |
|---|---|---|---|
| `src/domain/user.js` | 新增：User 契约 + SEED_USERS + validate + scrypt 哈希 | 否（新增） | 无 |
| `src/routes/auth.js` | 新增：createAuthRouter + login/logout/me | 否（新增） | 无 |
| `src/app.js` | 挂 `/api/auth` + 内存 token store | **是** | 与杨浩伟 US03（挂权限中间件）交集，按「先朱传玺→后杨浩伟」串行 |
| `src/db.js` | `readData` 透传 users + 惰性写入支持 | **是** | 与杨浩伟 US03（账号角色管理）交集 |
| `package.json` | test 脚本追加 `test/auth.test.js` | **是** | 与彭佳成（加 filter 测试）同文件，机械冲突，合并时保留双方 |
| `test/auth.test.js` | 新增：登录/登出/me + 不破坏基线断言 | 否（新增） | 无 |
| `public/auth.js` | 新增：登录/登出/当前用户前端逻辑 | 否（新增） | 无 |
| `public/index.html` | 加一处登录状态条（小块） | **是** | 与彭佳成 US11 筛选 UI、杨浩伟 US03 权限 UI 交集，**前端归并人统一合入** |

> 前端归并人本轮待计划会确认（Sprint 2 是杨浩伟统一归并，建议沿用）；US02 前端只交独立 `public/auth.js` + `index.html` 一小块，不直接改 `app.js`/`style.css`。

---

## 四、课前准备三件（回「收到」时可直接用）

1. 改进措施：Sprint 1 三条里我相关的——统一契约已落实；同步证据/预留集成窗口部分落实，Sprint 3 随「影响面说明」补齐。Sprint 2 三条里我落实「影响面说明」（US02 每次提交附改哪些文件、让哪条测试变红、验证命令）。
2. 验收标准：见第二节 3 条（登录成功/失败、会话有效/登出失效、不破坏基线）。
3. 文件清单：见第三节 8 个文件；公共文件交集 = `src/app.js`、`src/db.js`、`package.json`、`public/index.html`，与杨浩伟 US03、彭佳成 US11 按串行/归并规则错开。
