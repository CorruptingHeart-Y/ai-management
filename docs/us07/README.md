# US07 迭代归属独立准备

负责人：彭佳成。准备日期：2026-10-19（Asia/Shanghai）。

当前仅完成可独立开发的模块，尚未达到故事 DoD。分支 `feature/us07-iteration` 从 `origin/develop` 的 `6f96b9d767c315ba21e806b95d15ad0ab8ea6e99` 创建，没有合并其他成员的分支。正式基线统一后再由集成人员安排对齐。

## 已实现与边界

| 新增文件 | 内容 |
|---|---|
| `src/domain/iteration.js` | 最小迭代实体校验、可空任务归属校验 |
| `src/routes/iterations.js` | 只读迭代列表路由工厂，接受现有 db 对象 |
| `public/iterations.js` | 独立的筛选、分组函数，可通过浏览器全局 `IterationView` 或 CommonJS 使用 |
| `test/iterations.test.js` | 4 项独立模块测试，不替换生产数据层或应用入口 |

本轮未修改现有公共文件、旧测试、`src/app.js` 和现有页面。不增加迭代管理、登录、权限或重新分配已有任务的接口。

## US07 接口与领域约定

以下是交付给契约 owner 核对的 US07 最小定义，不代表 PO 已批准或公共文件已经接入。

- `Iteration = { id: number, name: string }`：id 为唯一正安全整数；name 为去除首尾空白后非空的显示名。暂不增加日期、状态字段。
- `GET /api/iterations` 返回 200 和迭代数组；空集合为 `[]`；旧数据缺少集合时兼容空数组。设置 `Cache-Control: no-store`。
- 显式损坏的集合、重复 id、不完整实体返回 JSON 500 `Invalid iteration data`；读取异常返回 JSON 500 `Unable to read iterations`。只读接口不调用 `writeData()`。
- `resolveIterationId(value, iterations)`：省略或 `null` 返回 `null`；有效引用仅接受存在的正安全整数 number。字符串、空串、布尔值和不存在引用均拒绝；无类型强转。
- 浏览器选择框的空选项转成 `null`，非空选项由页面先转换为 number，再发送 JSON。不要用 `Number('')` 把空值变成 0。
- 实体校验失败抛普通 Error（服务端数据问题），输入类型错误抛 TypeError，不存在引用抛 RangeError。公共任务接口应将后两者映射为 400，数据错误映射为 500；必须在写入之前校验。

## 前端接入契约

页面加载 `iterations.js` 后可调用：

```javascript
const selection = select.value === '' ? null : Number(select.value);
const body = { title, description, assigneeId, iterationId: selection };
const visible = IterationView.filterTasks(tasks, IterationView.ALL);
const groups = IterationView.groupTasks(visible, iterations);
```

筛选值是 `IterationView.ALL`（全部）、`IterationView.UNASSIGNED`（未归属）或正整数迭代 id。分组沿用接口的迭代顺序，组内保留任务顺序，不修改任务对象。缺失/null 归属进入未归属组；不存在的引用单列 `missing: true` 组，页面应显示“未知迭代”，不得悄悄算作未归属。空组不展示。

该模块尚未加载到真实页面，没有替代既有状态控件、服务状态检测或 US06 徽标。选择器、分组标题和任务渲染由指定页面出口接入，加载失败时需展示错误和重试；不可用演示数组替代 API。

## 交给公共文件负责人的接入清单

| 文件/事项 | 接入内容 | 负责人 |
|---|---|---|
| `src/db.js` | 初始化和读取保留 `iterations`，兼容缺字段；创建任务和状态写回后集合不得丢失。关闭 TD-S2-01 | 朱传玺 |
| `data/db.json` | 添加 `iterations`；若采用 GET-only，提供经确认的演示迭代，避免空集合无从选择；不覆盖真实任务 | 朱传玺 |
| `src/domain/task.js`、`src/routes/tasks.js` | 使用归属校验，创建任务保存 `iterationId`，省略时为 null；非法值 400 且不写库；旧任务读取补齐 null；状态变更保留归属和 US06 字段 | 朱传玺 |
| `package.json` | 保留原四份测试及 US06，将 `test/iterations.test.js` 加入正式测试入口 | 朱传玺 |
| `src/app.js` | 导入 `createIterationsRouter`，在统一 db 上挂载 `/api/iterations` | 待 PO 指定出口 |
| 现有前端三文件 | 引入模块、创建表单归属选择、筛选与分组；创建/状态更新后使用当前数据重新渲染 | 待 PO 指定出口 |
| 正式开发基线 | 接收 35 项基线、US06 与准备门禁，明确 feature 对齐的 SHA | 何健翔、杨浩伟 |

注意：当前 develop 的 `db.readData()` 会丢弃顶层 iterations，仅挂载路由可能错误地看到空列表，不能据此宣称真实数据层接入成功。

## 三条验收标准草案

1. 页面从同一数据源显示可用迭代；选择迭代创建任务后，响应、列表、刷新和服务重启仍保留相同归属；不选择时归属为 null，旧创建请求继续成功。
2. 不存在、类型不正确的 iterationId 返回 400，前后数据文件内容一致；正常创建和状态流转后 iterations 集合、归属以及优先级/截止日不丢失。
3. 页面支持全部、未归属、指定迭代的筛选和分组，数量与任务列表一致；TODO→DOING→DONE 后显示正确，原 35 项回归及浏览器业务链路通过。

## 四项当前测试及后续真实集成

运行 `node --test test/iterations.test.js`。当前四项覆盖：列表只读与新数据读取、错误实体/读取异常、领域归属校验、前端纯筛选分组。路由测试挂载在临时 Express 应用上，注入只读 db 测试替身，不假装生产应用已挂载或持久化已完成。

2026-10-19 实跑：上述 4/4 通过，当前 develop 起点的 `npm test` 为 24/24 通过；四个新增 JS 文件语法检查通过。当前起点不含服务状态的 11 项，不能把 24 项表述为完整 35 项回归。未修改旧测试以适配新模块。

公共接入完成后，在同一新增测试文件继续增加真实 `createApp({ dataFile })` 集成覆盖；不修改旧四份测试。验证 GET 路由、POST 合法/非法/省略归属、刷新/重启、状态流转和 iterations 集合保留。不得删除独立断言以凑固定的测试数量，4 项是当前准备覆盖数。

浏览器人工验收见 [acceptance.md](acceptance.md)。本次执行记录与现场 AI 记录见 [session-20261019.md](session-20261019.md)。
