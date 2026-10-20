# US11 / US12 与 US07 视图交付

负责人：彭佳成。日期：2026-10-21，Asia/Shanghai。分支 `feature/us11-us12-filter`，起点 `develop@e57d62f`。

本次完成组合查询、逾期判断和可操作的迭代筛选/分组页面，以及测试、产品价值说明和人工验收准备。正式公共入口、US02/US03 集成、人工审查与发布接收仍由对应负责人完成。当前不能把本机预览或自动测试写成“故事已发布”。

## 交付文件与使用

| 文件 | 内容 |
|---|---|
| `src/domain/task-filter.js` | 严格查询参数解析、组合筛选、服务本地日期和逾期判断 |
| `src/routes/task-query.js` | 新增只读查询路由工厂，不改变原任务 API |
| `src/features/task-filters.js` | 要求显式读取授权中间件的挂载适配器 |
| `public/task-filters.html`、`task-filters.css`、`task-filters-page.js` | 完整只读任务视图，复用现有 `iterations.js` 分组 |
| `test/filter.test.js`、`test/filter-mount.test.js` | 查询、日期、只读、真实数据链路及挂载边界测试 |
| `scripts/preview-task-filters.cjs` | 仅监听 127.0.0.1，使用临时演示数据的独立预览 |
| `scripts/check-task-filters-browser.cjs` | 可复跑的自动浏览器核对和截图脚本 |

所有以上代码均为新增文件。没有修改公共文件 `src/app.js`、`src/db.js`、`data/db.json`、`package.json`、原 `src/routes/tasks.js`、既有七份业务测试或三项集成 TODO。现有首页、登录条和统计页也未改动，避免与其他成员冲突。

本机预览：

```powershell
node scripts/preview-task-filters.cjs
```

默认访问 `http://127.0.0.1:3107/task-filters.html`。端口被占用时先设置 `$env:PORT = '3108'` 再运行。预览复制的是程序定义的隔离演示数据，不读取或覆盖团队真实数据文件；预览不启用鉴权，不是生产运行入口。正式 `npm start` 在 owner 接入前不会提供 `/api/task-query`。

## 查询契约

`GET /api/task-query`，`Cache-Control: no-store`。每次请求只读取一次统一数据层，不调用写入方法。无参数返回全部任务，保留任务原顺序及全部原字段。

| 可选参数 | 合法值 | 语义 |
|---|---|---|
| `status` | `TODO` / `DOING` / `DONE` | 单一状态 |
| `priority` | `HIGH` / `MEDIUM` / `LOW` | 单一优先级 |
| `assigneeId` | 正安全整数的十进制字符串 | 指定负责人 |
| `iterationId` | 正安全整数的十进制字符串，或 `unassigned` | 指定迭代，或缺失/null 归属 |
| `overdue` | `true` / `false` | 只取逾期 / 只取非逾期；省略则不限 |
| `q` | trim 后最多 100 个 Unicode 字符 | 标题或描述的字面子串，不区分大小写，不执行正则 |

所有条件按 AND 同时生效。不存在的合法负责人或迭代 ID 返回 200 空结果；不把未知引用伪装成“未归属”。重复、未知、嵌套、数组参数或非法取值一律 400，且在读取数据前拒绝。ID 不接受前导零、指数、小数、空白、负数和非安全整数。空关键词合法；其他过滤项空字符串无效，页面通过省略参数表示不限。

响应示例：

```json
{
  "tasks": [],
  "total": 8,
  "matched": 0,
  "today": "2026-10-21",
  "overdueCount": 3
}
```

`total` 和 `overdueCount` 分别是当前读取数据源的总任务数和总逾期数，不受筛选影响；`matched` 等于当前 `tasks.length`。因此选择某位负责人时，全库“仅逾期”标签计数可能大于当前列表条数。当前整份任务数据为读取权限边界；如果 US03 将来引入逐行可见范围，owner 应把授权后的数据源传入路由，不能暴露未授权总数。

错误结构：参数无效为 400 `{ "error": "Invalid task query" }`，任务数据或读取故障为 500 `{ "error": "Unable to read tasks" }`；不泄漏磁盘路径或错误栈。畸形任务、重复 ID、无效标题会被拒绝；不通过“修复数据”让查询看似成功。

## 逾期与旧数据

规则：合法纯日期 `dueDate < today`，且 `status !== 'DONE'`。直接比较 `YYYY-MM-DD` 字符串，不把截止日转换为时间戳；今天截止不算逾期，无截止日/非法日期不算逾期。`today` 使用服务进程的本地日期，不用 `toISOString().slice(0, 10)`。页面使用响应的 `today`，即使浏览器在不同的时区也不改变结果。

部署应显式固定服务时区，例如 Asia/Shanghai；测试覆盖上海与洛杉矶的同一 UTC 时刻。跨午夜后点击刷新取得新的服务日期；当前不做后台提醒或自动调度。

旧任务缺失/null/空状态与优先级仅在匹配和展示时按 TODO / MEDIUM 兼容，不修改原记录。迭代归属仅缺失/null 算未归属，空串或无效引用仍是未知引用。明确非法的状态/优先级在页面显示未知，不伪装成默认值。

已知数据层限制：当前 `createDb.readData()` 会把原始非数组 `tasks` 归一成 `[]`，并可能掩盖畸形顶层集合；新路由无法辨认已被上游归一化的数据。TD-S2-06 不因本次校验而关闭，交由 owner 评估；同理不宣布非原子写入等旧技术债已清偿。

## 前端与鉴权接入

页面 `/task-filters.html` 支持全部/仅逾期、五项过滤、关键词、按迭代分组、重置、刷新和 URL 筛选恢复。未知迭代单列，未归属单列；字符串通过文本节点渲染，避免任务/成员/迭代名称注入 HTML。页面只读，修改任务返回原工作台。

请求使用同源 `/api/members`、`/api/iterations`、`/api/task-query`，自动携带现有 `localStorage['ai-mgmt-token']` 的 Bearer 值，不另建会话。加载时清空旧结果；失败提供重试；401 清除无效凭证、任务、计数及成员/迭代选项，403 保留凭证但清空已读取数据。换账号时清除前一账号的选项。绝不回退到旧 `/api/tasks` 绕过新接口错误或权限。

由朱传玺确认、当前公共文件 owner 在正式 `createApp` 中接入：

```javascript
const { mountTaskFilters } = require('./features/task-filters');
// requireTaskRead is the owner's actual middleware, using the shared US02 session store.
mountTaskFilters(app, db, requireTaskRead);
```

以上 `requireTaskRead` 是实际 US03 中间件的接入位置，当前基线未定义它，不应直接照抄未定义变量。必须先将其绑定到正式用户解析与读取权限策略；未提供函数时适配器拒绝挂载。不要新建第二个 token Map，不要把生产 `readAccess` 写成无条件 `next()`。新路径与 `/api/tasks` 平级，仅保护后者不会保护本查询。

同一 owner/前端归并人另需：

1. 在工作台导航加 `<a href="task-filters.html">任务视图</a>`，不移除登录/权限 UI。
2. 在 `package.json` 保留全部原测试，追加 `test/filter.test.js test/filter-mount.test.js`。
3. US03 E2E 覆盖本查询以及字典接口：无凭证/伪造/撤销/重启失效，合法 member/admin，实际读取权限规则和拒绝前不访问数据。
4. 杨浩伟统一回归、CI 和历史 TODO，何健翔审查本人实际 diff 并真实确认；彭佳成执行 [人工验收表](acceptance.md)。

## 验证证据

```powershell
node --test test/filter.test.js test/filter-mount.test.js
npm test
node --test test/sprint2-integration.test.js
```

当前新增测试 20/20 通过，0 fail/skip/TODO；既有七份业务测试 57/57 通过。历史集成测试为 5 pass / 3 TODO，未将 TODO 算成通过或修改以变绿。分工中的“62 项”指 57 业务 + 5 已实现集成，不包括那 3 个待实现 TODO。

Chrome 自动浏览器验证覆盖 9 组检查：组合筛选、重载恢复、迭代分组、仅逾期、空结果、失败重试、401/403 行为、账号变动后元数据清理、桌面和 390/320px 布局、文本注入防护及查询前后字节不变。权限使用测试中间件，不代表真实 US03 已接入；截图已经逐张检查，不代替人工业务验收。

- [新测试 TAP](evidence/filter-tests.tap)
- [最终回归 TAP：82 pass / 3 历史 TODO](evidence/regression.tap)
- [公共文件及旧测试未改动的内容哈希](evidence/unchanged-baseline.json)
- [浏览器检查结果](evidence/browser-results.json)
- [桌面分组截图](evidence/desktop-grouped.png)
- [390px 截图](evidence/mobile-390.png)
- [320px 截图](evidence/mobile-320.png)

浏览器脚本需要已安装的 Playwright 和浏览器，不修改应用依赖。运行时通过 `PLAYWRIGHT_MODULE` 指定现有模块路径、`BROWSER_EXECUTABLE_PATH` 指定浏览器、`FILTER_EVIDENCE_DIR` 指定输出目录，再执行 `node scripts/check-task-filters-browser.cjs`；具体本机环境见 [现场记录](session-20261021.md)。

其他交付：[价值兑现说明](product-value.md)、[验收标准/影响面/人工记录表/群内交接草案](acceptance.md)。最终发布就绪 DoD、人工签字和 Release Tag 均未由本次工具操作代替。
