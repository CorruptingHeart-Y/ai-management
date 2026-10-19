# PO / DRI 决策记录（答复杨浩伟《Sprint 2 工程准备记录》的 4 项待决）

决策人：何健翔（本轮 DRI，兼 PO 与 Scrum Master）
日期：2026-10-17　时区：Asia/Shanghai
对象：`docs/sprint2/README.md`「需何健翔决策后才继续的动作」第 1—4 条
边界：本文件只做**范围、契约口径、出口与时间盒**的决定；人工 diff 审查签名、浏览器验收结论、正式 DoD 与是否推送 develop 的最终时刻，都不由本文件代替。

---

## 决策 1（G0 起点）：起点 SHA 用 `b87fe43`，代码基线内容等于 `f9c0edd`

- **批准**：以 `codex/sprint2-baseline-prep` 的 `b87fe43` 作为**分支起点**；`f9c0edd`（服务状态移植提交）是**代码基线内容**。两者不是二选一：`b87fe43` = `f9c0edd` + 一个只含门禁脚本/准备文档/集成测试的提交。
- **工程零差异（我实跑 `git diff` 核对）**：`f9c0edd..b87fe43` 共 45 个文件变更，全部位于 `docs/`、`scripts/verify-sprint2.cjs`、`test/sprint2-integration.test.js`；`src/`、`public/`、`data/`、`package.json`、`package-lock.json`、`server.js`、`test/helpers.js` 与四份原测试**零差异**，`package.json` 的 `test` 脚本两处完全相同。
- **依据**（我复验过，不是转述）：4 份原测试全文哈希与 `baseline-test-hashes.json` 全部 `MATCH`；逐文件运行为 35 pass / 0 fail；服务状态 6 个文件与最终交付版本一致。
- **为什么起点不用 `f9c0edd`**：①`baseline-test-hashes.json`、`verify-sprint2.cjs`、集成测试都在 `b87fe43`，以 `f9c0edd` 起步等于让三个人各自手工搬一遍门禁，反而制造冲突；②三份 feature 必须能跑同一套门禁，否则"某人的分支上没有门禁"会让 G2/G3 的结论不可比；③起点不一致会在后续合并里持续产生"文档差异"噪声，而工程零差异说明用 `b87fe43` 不会带进任何未验证代码。
- **例外情形**：若教师明确要求"基线只能含代码、不得含过程文档"，则改用 `f9c0edd` 建 `integration/sprint2`，再把 `b87fe43` 的 `docs/sprint2/`、`scripts/`、集成测试作为**第一个集成提交**并入，工程仍零变化。这两种做法的工程结论完全等价，差别只在文档归属。
- **事实来源**：确认以本地最新正式材料（`316d923` / 远程 `4dd3476`）与源码包 `e3b147b` 为 Sprint 1 事实依据；不把 `develop` 的 24/24 当作本轮回归基线。
- **边界三条**：
  1. 不把准备成果直接推 `develop`。`develop` 在三个故事合并前保持不动，本轮集成走 `integration/sprint2`。
  2. 我已在本地基于 `b87fe43` 建 `integration/sprint2-us10` 验证 US10；正式 `integration/sprint2` 由你按同一 SHA 创建（或由我把本地分支改名后交你推送），起点 SHA 记为 `b87fe43`。
  3. 起点批准 ≠ DoD 通过。G5 浏览器链路、G6 人工审查仍待你与各故事负责人做。

## 决策 2（共享出口）：逐文件指定出口

| 文件 | 出口 | 理由 |
|---|---|---|
| `data/db.json`、`src/db.js`、`package.json`、`src/domain/task.js`、`src/routes/tasks.js` | 朱传玺 | 维持你文档中的既有指定，不另立 |
| `src/app.js` | **何健翔** | 路由装配点，US10 已在此挂载 `/api/stats`；US07 的迭代路由也在同一处加一行，避免两人并排改同一个 `createApp` 函数体 |
| `public/app.js`、`public/index.html`、`public/style.css` | **杨浩伟**（集成窗口统一归并） | 三个故事都要动前端，唯一能避免三方冲突的做法是"各交片段、一人归并"。各故事负责人只提供自己的函数块/HTML 区块，不直接改这三个文件 |
| `public/service-status.js` | **冻结**，本轮不改 | 依赖成员响应契约，改动会牵连已通过的 11 项状态测试；确需改先报我 |
| `.github/`（CI 配置）、`scripts/` | 杨浩伟 | 门禁与脚本归你，他人只提需求 |
| 各故事新增文件（`routes/stats.js`、`public/stats.html`、`test/stats.test.js` 等） | 各自负责人 | 新增文件不进"唯一出口"清单，冲突面为零 |

配套约定：`index.html` 里指向 `stats.html` 的导航链接由杨浩伟在集成窗口**一次性**加，三人都不碰。

## 决策 3（契约口径）：逐条裁决

### 3.1 `priority` 枚举与默认值——维持契约，不改默认

- 枚举 `HIGH / MEDIUM / LOW`，默认 `MEDIUM`，**不改 null**（临场改默认值会让朱传玺已写好的校验与测试返工，收益不抵成本）。
- 补偿要求：页面必须把"中"显式渲染出来（徽标/文字），不得出现"表单空白、数据是中"的错觉；表 4 与表 6 写明"未选即视为中"。
- 统计口径按 `MEDIUM` 计，并在自评"质量"维度如实写这条语义局限（评审意见第 1 条的结论：接受，不修）。

### 3.2 属性更新接口——本轮不做，登记技术债

- 本轮**不新增** `PATCH /api/tasks/:id`。理由：契约已冻结、开发窗口 85 分钟、US06 的创建路径尚未验证完；临场加接口会把"集成不破坏旧功能"的风险推高。
- 代价与处置：US06 只支持"创建时设置"；表 4 验收标准写清；评审被问时按"本轮范围声明"回答；登记为技术债 `TD-S2-08`（功能缺口），偿还计划放 Sprint 3。

### 3.3 截止时间与逾期判定

- `dueDate` 为纯日期字符串 `YYYY-MM-DD`；**一律用字符串字典序比较，不构造 `Date`**，避免 +08:00 下差 8 小时。
- "今天"取运行环境的本地日期；逾期 = `dueDate < 今天`（不含今天当天）。

### 3.4 迭代引用与迭代实体

- `Iteration` 最小字段 `{ id: number, name: string }`，本轮不加起止日期。
- `iterationId` 非空且迭代不存在 → `400 "非法迭代: <id>"`；空值语义 = 未分配。
- `GET /api/iterations` → `200 Iteration[]`，空则 `[]`。

### 3.5 统计口径（US10，已实现并自测）

- 响应：`{ total, byStatus, byPriority, byAssignee, byIteration }`，`Cache-Control: no-store`。
- 容错：`status` 缺失/非法按 `TODO`；`priority` 缺失/非法按 `MEDIUM`；`iterationId` 空 → 未分配；引用不存在 → 「未知迭代 #id」；负责人不存在 → 「未知成员 #id」；0 任务成员与空迭代仍保留在结果里。
- 空库返回 200 与全 0，不返回 500；数据文件损坏返回 500，不返回半截数据。

### 3.6 `TD-S2-01`（readData 丢 iterations）：**US07 合入前必须关闭**

- 我已独立复现，与你结论一致：临时数据写入 `iterations` 后 `readData` 只回 `members`/`tasks`，写回即丢。
- 关闭条件：①`src/db.js` 的 `readData` 返回 `iterations`；②补一条"写入后集合保留"的回归断言；③`/api/stats` 的 `byIteration` 显示真实迭代名而不是「未知迭代 #id」（这条我这边现成，可直接验）。
- 证据：`docs/evidence/sprint2-us10-api-demo-20261017.txt`。修复人朱传玺，时限 T+105 集成窗口开始前。

## 决策 4（时间盒）：课堂 T0 与各窗口

| 节点 | 相对时间 | 动作 |
|---|---|---|
| T0 | 计划会开始（全程约 10 分钟处） | 记录起点 SHA、宣布范围裁剪（US02/US03 退回）与 DoD |
| T+40 | 计划会结束 | 契约冻结，三份 feature 按契约开工 |
| T+90 | **强制冻结** | 停止接收新功能；未完成转"未完成" |
| T+105—135 | 集成窗口 | 按 US06→US07→US10 逐个合入，每次跑原 35 回归 |
| T+135—155 | Sprint 评审 | 7 步演示，先证旧功能未破坏 |
| T+155—170 | Sprint 回顾 | 改进措施逐条打勾 |
| T+170—180 | 交付 | 7 项交付物核对 |

- 本轮 `integration/sprint2` 由你创建并记录起点 SHA；三份 feature 必须对齐同一 SHA 再提交。
- 若到 T+90 三份故事仍未齐，按"已合入多少算多少"评审，不延期、不改断言、不跳过失败。

---

## 附：US10 在 `b87fe43` 上的现状（决策 1 的执行结果）

- 本地分支 `integration/sprint2-us10` = `b87fe43` + US10 四个提交，`git am` 全部无冲突。
- 逐文件运行：基线 35 + US10 12 + 你的集成测试 5 = **52 pass / 0 fail / 3 todo**。
- 原四份测试哈希 `MATCH`，未改一行断言。
- 你的门禁静态检查结果：`test/stats.test.js` 已就位；仍缺 `test/task-attrs.test.js`、`test/iterations.test.js` → 门禁状态从"缺 3 份"变为"缺 2 份"。
- 提醒（G4）：你自己的 `test/sprint2-integration.test.js` 有 3 个 TODO；按 `verify-sprint2.cjs` 的判定，**added 一轮出现 todo 也会 BLOCKED**。三份故事测试齐了之后，这 3 个 TODO 需要转成真实断言才能过门禁——要么你补，要么在门禁里显式区分"已知待办"与"静默跳过"（我倾向后者会削弱门禁，建议前者）。

---

## 附二：记录口径（表 2／表 3／表 6 直接抄这段，避免各人写各人的）

> Sprint 2 起点：`b87fe43`（`codex/sprint2-baseline-prep`，2026-10-17）。代码基线内容与 `f9c0edd` 完全一致；
> `f9c0edd..b87fe43` 的差异仅 `docs/`、`scripts/verify-sprint2.cjs`、`test/sprint2-integration.test.js`，
> `src/`、`public/`、`data/`、`package.json`、锁文件、四份原测试零差异。Sprint 1 回归基线 35/35，四份原测试 SHA256 未变。

三个 feature 的开工命令统一为：

```bash
git fetch origin
git checkout -b feature/us06-task-attrs   b87fe43   # 换成 us07-iteration / us10-stats
```

这样三条分支的 `git diff b87fe43..HEAD` 只包含自己的故事改动，合并时不会夹带文档噪声。

---

## 执行更新（2026-10-19）：US06 已合入，US07 仍缺

| 项 | 状态 |
|---|---|
| 集成分支 | `integration/sprint2`：`b87fe43` → merge US06（`45d0f6a`）→ merge US10，均 `--no-ff` 保留历史 |
| 冲突 | 仅 `package.json` 的 `test` 脚本一处，双方测试文件全部保留（未用 ours／theirs 覆盖） |
| 回归 | 58 pass / 0 fail / 3 todo；原 35 项哈希全部 `MATCH` |
| 跨故事联调 | 17/17 通过（US06 建任务 → US10 计入 → 非法 400 不落库 → US05 改状态 → 统计联动） |
| 门禁 | 仍 `BLOCKED`：缺 `test/iterations.test.js`（US07 未推送）；`sprint2-integration.test.js` 的 3 个 TODO 需转真实断言 |
| 待彭佳成 | US07 迭代归属与其 `iterations.test.js`；另需朱传玺关闭 `TD-S2-01`（`readData` 补 `iterations`） |
