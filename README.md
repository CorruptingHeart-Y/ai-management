# 爱管理 · 实验二 Sprint 1

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

环境要求：Node.js ≥ 18。

```bash
# 1. 安装依赖（仅 express 一个）
npm install

# 2. 启动服务（默认 http://localhost:3000）
npm start
```

打开浏览器访问 <http://localhost:3000>，即可查看成员、创建任务、查看任务列表并修改任务状态。

## 测试

```bash
npm test
```

覆盖 US04 的正常创建、空标题校验、无效负责人校验、创建后读取、以及持久化（刷新后仍在），
覆盖 US05 的 TODO → DOING、DOING → DONE、非法状态、404 和状态持久化，
并验证成员列表、id 唯一、成员数据可供分配使用。当前合并后的测试结果为 12/12 通过。

## 统一数据约定

三个用户故事（US01 / US04 / US05）共用同一份数据与同一套字段，不允许各自造假数据。

- `Member`：`{ id, name, role }`
- `Task`：`{ id, title, description, assigneeId, status, createdAt }`
- `status ∈ { TODO, DOING, DONE }`，页面显示「待办 / 进行中 / 已完成」
- `assigneeId` 必须对应真实存在的 `Member.id`

## API 约定

| 方法 | 路径 | 说明 | 归属 |
|---|---|---|---|
| GET | `/api/members` | 查看项目成员列表 | US01（后端地基） |
| GET | `/api/tasks` | 查看任务列表 | US04 / US05 共用 |
| POST | `/api/tasks` | 创建并分配任务 | **US04** |
| PATCH | `/api/tasks/:id/status` | 更新任务状态 | US05 |

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
- `feature/us04-create-task`：US04 创建并分配任务（本分支）
- `feature/us05-task-status`：US05 更新任务状态

流程：`feature → develop → 测试/审查 → main`。

## 团队开发原则

人类成员负责定义需求边界、技术约束、接口规范、审查 AI 代码 diff 和最终验收。

AI 编码智能体负责编写代码、编写测试、运行测试并根据错误修改代码。所有 AI 互动需要实时记录在 [docs/ai-interactions.md](docs/ai-interactions.md) 中。

当前仓库仅完成 Sprint 1 范围内的功能，不包含 Sprint 2 / Sprint 3 或范围外复杂功能。
