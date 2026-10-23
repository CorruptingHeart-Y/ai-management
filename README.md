# 爱管理 · Sprint 3 集成候选

当前分支 integration/sprint3，尚未正式发布 v1.0.0。已包含登录/权限、任务属性、预置迭代归属、统计、筛选与逾期视图；原七份业务测试哈希受保护，npm test 递归执行所有测试（包括启动真实 server.js 的 E2E），TODO/skip 会阻断门禁。

最新工程收尾补齐任务创建防重复/明确保存反馈、认证响应禁止缓存、跨端共享枚举，回归145/145。最新范围、证据和剩余事项见[工程收尾报告](docs/sprint3/engineering-closeout-20261023.md)；历史139/137/88项均对应各自旧提交。

筛选入口 `/task-filters.html`，真实查询接口 `/api/task-query`。普通成员可以查看、筛选和更新任务状态；创建任务与账号角色管理仅管理员可用。完整能力与限制见 [候选发布说明](docs/sprint3/release-notes.md)、[用户手册](docs/sprint3/user-guide.md)、[收口记录](docs/sprint3/closeout-20261023.md)。以下 Sprint 1 目标和早期计数保留为历史记录，不代表当前完整范围或发布批准。

## 项目背景

“爱管理”项目的 Sprint 1 最小功能原型。

## Sprint Goal

在本地演示环境中完成：

查看项目成员 → 创建并分配任务 → 更新任务状态

形成一个能够实际运行和演示的最小功能闭环。

## 技术栈

- 后端：Node.js + Express（REST API）
- 持久化：单个 JSON 文件（`data/db.json`），满足「刷新后任务仍在」，不引入数据库
- 前端：原生 HTML / CSS / JavaScript，无构建步骤
- 测试：Node 内置 `node:test` + 内置 `fetch`，零额外测试依赖

## Sprint 1 用户故事

### US01 查看项目成员

用户可以查看预置项目成员的姓名、分工等基本信息；后续创建任务时，负责人必须来源于成员列表。

验收目标：成员列表可查看，信息清晰且可作为任务负责人选项来源。

### US04 创建并分配任务

用户可以创建包含标题、描述和负责人的任务，负责人必须从项目成员中选择。

验收目标：空标题、无效负责人被拒绝；保存后刷新仍可查看任务。

### US05 更新任务状态

用户可以将任务状态修改为 TODO、DOING 或 DONE（待办、进行中、已完成）。

验收目标：页面同步更新，刷新后状态仍然保留。

## 运行指南

已验证环境：Node.js 22/24（CI）。package.json保留旧的最低版本声明；本轮没有声称在所有较早版本上运行过。

```bash
# 1. 安装依赖（仅 express 一个）
npm ci

# 2. 启动服务（默认 http://localhost:3000）
npm start
```

打开浏览器访问 <http://localhost:3000>，即可查看成员、创建任务、查看任务列表并修改任务状态。

### 登录（US02）

右上角「登录状态条」可登录 / 登出。演示口令由 DRI 通过纸质纪要或群公告提供，不在版本库文档登记；代码与 `data/db.json` 只存 scrypt 哈希：

| 用户名 | 角色 |
|---|---|
| `admin` | 管理员 |
| `pengjiacheng` | 成员 |
| `yanghaowei` | 成员 |
| `hejianxiang` | 成员 |

> US02负责登录态（token + `/api/auth/me`）；当前集成版同时启用US03全业务API权限检查。

### 基础权限（US03）

`npm start` 已固定启用权限：管理员可读取业务数据、创建任务、修改状态及管理账号角色；普通成员可读取、筛选和修改任务状态，不能创建任务或管理角色；未登录401，已登录越权403。首页提供最小角色管理面板，普通成员不可见，创建禁用、状态更新可用；本轮尚未升级视觉布局。

角色管理为 `GET /api/users`、`PATCH /api/users/:id/role`（请求 `{ "role": "admin" }` 或member），仅管理员可用；最后一名管理员不可降级。角色发生变化会撤销目标账号全部旧会话，重新登录取得新角色。账号与项目成员是不同实体，不按ID相等推断任务所有权。

**嵌入工厂说明**：运行应用使用 `createSecuredApp`，`server.js`无关闭鉴权开关；旧 `createApp` 仅保留US01/US02免登录嵌入回归契约，不是生产服务入口。原七份业务测试保持原文；故障注入夹具适配和后续权限测试修正详见修复报告。权限与本轮E2E均包含真实server.js子进程验证，不能用旧工厂的测试结果冒称生产鉴权通过。

验收说明、权限矩阵与已知边界见 [US03交付](docs/sprint3/us03-permission.md)。

## 测试

```bash
npm test
```

覆盖 US04 的正常创建、空标题校验、无效负责人校验、创建后读取、以及持久化（刷新后仍在），
覆盖 US05 的 TODO → DOING、DOING → DONE、非法状态、404 和状态持久化，
并验证成员姓名与分工、种子一致性、成员 id 唯一、自定义数据源、全部成员可分配、空列表及错误数据处理。
2026-09-20 在 `feature/us01-members` 的全量测试为 24/24 通过（含子测试）；基线 `6906e49` 的原有测试为 12/12。
实际日志见 [US01 全量测试记录](docs/evidence/us01-tests.tap)，浏览器 8 项验证见 [运行证据](docs/evidence/us01-verification.md)。

## Sprint 2 · US10 状态统计

统计页：启动后访问 <http://localhost:3000/stats.html>（工作台 `index.html` 不受影响）。
接口：`GET /api/stats`，只读，返回 `total`、`byStatus`、`byPriority`、`byAssignee`、`byIteration`。
口径：旧任务缺字段按 `TODO` / `MEDIUM` / 未分配 计；引用不存在的迭代或负责人会单列为「未知」，不静默丢弃。
证据：全量 47/47 通过（基线 35 + US10 12），见 [测试记录](docs/evidence/sprint2-us10-test-20261017.txt)
与 [接口联调记录](docs/evidence/sprint2-us10-api-demo-20261017.txt)；实现与集成说明见 [US10 说明](docs/us10-stats.md)。

## 统一数据约定

三个用户故事（US01 / US04 / US05）共用同一份数据与同一套字段，不允许各自造假数据。

- `Member`：`{ id, name, role }`
- `Task`：`{ id, title, description, assigneeId, status, createdAt }`
- `status ∈ { TODO, DOING, DONE }`，页面显示「待办 / 进行中 / 已完成」
- `assigneeId` 必须对应真实存在的 `Member.id`
- `User`：`{ id, username, passwordHash, role }`，`role ∈ { admin, member }`（权限角色，区别于 `Member.role` 团队分工）；密码只存 scrypt 哈希 `salt:hash`

## API 约定

| 方法 | 路径 | 说明 | 归属 |
|---|---|---|---|
| GET | `/api/members` | 查看项目成员列表，负责人选项共用此数据 | US01 |
| GET | `/api/tasks` | 查看任务列表 | US04 / US05 共用 |
| POST | `/api/tasks` | 创建并分配任务 | **US04** |
| PATCH | `/api/tasks/:id/status` | 更新任务状态 | US05 |
| GET | `/api/stats` | 任务统计：总数、按状态/优先级/负责人/迭代 | **US10**（Sprint 2） |
| GET | `/api/iterations` | 读取预置迭代 | US07 |
| GET | `/api/task-query` | 组合筛选、逾期、返回任务及计数 | US11/US12 |
| GET | `/api/users` | 管理员查看账号公开字段 | US03 |
| PATCH | `/api/users/:id/role` | 管理员修改角色，变化后撤会话 | US03 |
| POST | `/api/auth/login` | 登录：校验凭证、签发 token | **US02**（Sprint 3） |
| POST | `/api/auth/logout` | 登出：清除当前 token | **US02**（Sprint 3） |
| GET | `/api/auth/me` | 当前登录用户 | **US02**（Sprint 3） |

### GET /api/members

成功返回 `200` 与 `Member[]`，空成员返回 `[]`。每条成员包含唯一正整数 `id`、姓名 `name` 和分工 `role`。成员数组内字段非法、id 重复或文件读取失败返回 `500` JSON 错误。成员为空或加载失败时，页面禁止分配并支持重新加载。

详见 [US01 成员接口与验收说明](docs/us01-members.md)。

### POST /api/tasks

请求体：

```json
{ "title": "任务标题", "description": "选填描述", "assigneeId": 2 }
```

- `title` 不能为空，否则返回 `400`
- `assigneeId` 必须对应真实存在的成员，否则返回 `400`
- 成功后返回 `201`，新任务 `status` 初始为 `TODO`，并记录 `createdAt`

### PATCH /api/tasks/:id/status

请求体：

```json
{ "status": "DOING" }
```

- `status` 只允许 `TODO`、`DOING`、`DONE`，非法状态返回 `400`
- 任务不存在返回 `404`
- 成功后返回更新后的任务，状态写回 `data/db.json`

## 目录结构

```
server.js              # 入口，读 PORT / DATA_FILE 并启动
src/app.js             # createApp({ dataFile }) 工厂（测试复用）
src/db.js              # 数据访问层，JSON 文件读写
src/routes/members.js  # 成员接口
src/routes/tasks.js    # 任务接口（US04 创建 + US05 状态更新）
src/domain/task.js     # 任务状态校验与更新逻辑
src/domain/member.js   # 共享 Member 契约与校验
src/domain/user.js     # 登录账号契约 + scrypt 哈希（US02）
src/routes/auth.js     # 登录 / 登出 / 当前用户接口（US02）
data/db.json           # 预置成员 + 任务数据
public/                # 前端页面
test/                  # node:test 测试（US01 / US04 / US05）
```

## DoD

1. 功能能够正常运行；
2. 用户故事达到验收标准；
3. 关键路径具有基本单元测试或集成测试；
4. 关键函数和模块有必要注释；
5. AI 生成的代码经过人工 diff 审查；
6. 合入主分支后测试通过；
7. 有运行结果或截图能够作为验证证据。

详见 [docs/dod.md](docs/dod.md)。

## Git Workflow

- `main`：稳定、满足 DoD 的 Sprint 增量
- `develop`：Sprint 1 集成分支
- `feature/us01-members`：US01 查看项目成员
- `feature/us04-create-task`：US04 创建并分配任务
- `feature/us05-task-status`：US05 更新任务状态

流程：`feature → develop → 测试/审查 → main`。

## 团队开发原则

人类成员负责定义需求边界、技术约束、接口规范、审查 AI 代码 diff 和最终验收。

AI 编码智能体负责编写代码、编写测试、运行测试并根据错误修改代码。所有 AI 互动需要实时记录在 [docs/ai-interactions.md](docs/ai-interactions.md) 中。

当前仓库在 Sprint 1 的成员—任务—状态闭环之上，正在累积 Sprint 2 增量：US10 状态统计已实现（分支 `feature/us10-stats`），
US06 任务优先级与截止时间、US07 迭代归属见《实验三_Task字段与接口契约》，集成后统一回归。

## 成员一交付材料

[彭佳成 US01 交付说明](deliverables/第7组_成员一彭佳成_US01交付说明.txt) 包含职责、实现差异、验证结果、演示步骤、个人 DoD 及群汇报准备。
当前 US01 已通过 AI 辅助集成审查、完整链路验证和 `develop` 合并后 24/24 回归测试；人工 diff 审查及正式 DoD 验收仍待完成，不能直接标记 Done。
