# US10 状态统计 · 实现说明与集成清单

> 负责人：何健翔（本轮 DRI）
> 分支：`feature/us10-stats`　基线：Sprint 1 `develop`（35/35 全绿）
> 契约依据：《实验三_Task字段与接口契约》（朱传玺，2026-10-17）
> 状态：接口、页面、测试均已完成并在本地跑通（47/47，0 失败）；**待集成**。

## 1. 做了什么

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/domain/stats.js` | 新增 | 纯函数 `buildStats(data)`，统计口径集中在这里，不依赖 Express |
| `src/routes/stats.js` | 新增 | `GET /api/stats`，只读、`Cache-Control: no-store`、读失败返回 500 |
| `test/stats.test.js` | 新增 | 12 项：9 项领域逻辑 + 3 项 HTTP 行为 |
| `public/stats.html` | 新增 | 独立统计页（不碰 `index.html`，从工作台的「返回工作台」链接互通） |
| `public/stats.js` | 新增 | 取数 + 渲染，全部 `textContent`，不拼 `innerHTML` |
| `src/app.js` | **改 2 行** | 挂载 `/api/stats`（第 9 行 require、第 28 行 use） |
| `package.json` | **改 1 处** | `test` 脚本追加 `test/stats.test.js` |

设计上的三个取舍，评审时会被问，先说清楚：

1. **只读接口，不写数据文件**。统计不参与 US06/US07 的写路径，因此不会和它们抢 `db.json`，也不会因为统计把演示数据改坏。
2. **口径集中在 `buildStats`**，路由只负责取数与异常。以后字段再变（比如 US06 加了 `priority` 的第四档），只改一处、只改一组断言。
3. **前端独立成页**。契约第 7 节把 `public/app.js` 标成三人共用、集成阶段归并——独立页把这条冲突从"三人都改一个文件"降成"加一个链接"，代价是评审时要多点一次页面。

## 2. 接口约定

`GET /api/stats` → `200`

```json
{
  "total": 6,
  "byStatus":  { "TODO": 3, "DOING": 1, "DONE": 2 },
  "byPriority":{ "HIGH": 2, "MEDIUM": 3, "LOW": 1 },
  "byAssignee":[ { "memberId": 1, "name": "彭佳成", "role": "产品与范围负责人", "count": 2 } ],
  "byIteration":[ { "iterationId": null, "name": "未分配", "count": 2 },
                  { "iterationId": 1, "name": "Sprint 1", "count": 2 } ]
}
```

- 响应头 `Cache-Control: no-store`：统计必须反映当前数据，不能被浏览器缓存成旧数字。
- 数据文件损坏/读取失败 → `500 {"error":"统计数据暂时无法读取，请稍后重试"}`，**不返回半截数据、不伪造 0**。
- 空任务库 → `200` 且各计数为 0（这是正常业务状态，不是错误）。

## 3. 统计口径（重要，自评与评审都会用到）

| 规则 | 处理 |
|---|---|
| `status` 缺失或非法 | 按 `TODO` 计（与创建默认值一致），保证 `TODO+DOING+DONE == total` |
| `priority` 缺失或非法 | 按 `MEDIUM` 计（契约默认值） |
| `iterationId` 为 `null`/空串/缺失 | 归入「未分配」组，且该组固定排第一 |
| `iterationId` 引用不存在的迭代 | 单独成组「未知迭代 #id」，**不静默丢弃** |
| 负责人不存在的任务 | 单独成组「未知成员 #id」 |
| 成员的 0 任务 | 仍然出现，`count: 0`（否则看不出"谁手上没活"） |
| 没有任务的迭代 | 仍然出现，`count: 0`（否则看不出"哪个迭代是空的"） |
| 字符串 id（如 `"2"`） | 归一化为数字，不产生假的「未知成员」 |

前两条是容错，后四条是**故意不做的"漂亮化"**：把脏数据藏起来，评审时问一句"为什么总数对不上"就答不出来。

## 4. 测试与证据

- 全量 47 项、0 失败：基线 35 项（15+5+4+11）原样通过 + US10 新增 12 项。
- 日志：`docs/evidence/sprint2-us10-test-20261017.txt`
- 接口联调（6 条演示数据）：`docs/evidence/sprint2-us10-api-demo-20261017.txt`

复跑命令（仓库根目录）：

```bash
npm ci
npm test
```

> 注：本次在受限沙箱里 `node --test` 的多文件模式无法 spawn 子进程，所以日志是按文件逐个在进程内跑出来的，结论等价。你在本机直接 `npm test` 即可。

## 5. 集成步骤（给杨浩伟，5 分钟）

1. `git checkout develop && git pull`，然后 `git merge feature/us10-stats`。
2. 预期只有两处冲突可能：
   - `src/app.js`：只要保留 `createStatsRouter(db)` 的 require 与 `app.use('/api/stats', ...)` 两行；若朱传玺也改了这个文件，两边的 `app.use` 都保留即可。
   - `package.json` 的 `test` 脚本：把 `test/stats.test.js` 与 US06/US07 的新测试文件一起列进去（用空格分隔，别覆盖别人的）。
3. `npm ci && npm test` → 期望 47 + US06/US07 的新增项，**0 失败**。
4. 浏览器开 `http://localhost:3000/stats.html`，跑第 6 节的回归点。
5. 在 `README.md` 的 API 表补一行 `GET /api/stats`（README 归 DRI 定稿，我来加，不占你的时间）。

## 6. 回归要点（杨浩伟照着点一遍，200 秒）

| # | 操作 | 期望 |
|---|---|---|
| 1 | 打开 `/stats.html` | 四张 KPI 卡有数字，不出现「—」 |
| 2 | 对照 `GET /api/tasks` 的条数 | `任务总数` == 任务数组长度 |
| 3 | 回工作台把一条任务从 TODO 改成 DONE，再回统计页点「刷新」 | 待办 −1、已完成 +1，总数不变 |
| 4 | 停掉服务后刷新页面 | 出现红色错误条与「刷新重试」，KPI 显示「—」而不是 0 |
| 5 | 打开 `/index.html` | 工作台一切照旧（US01/US04/US05 未被影响） |
| 6 | 新建一个不填优先级、不填迭代的任务 | 统计里它计入 `MEDIUM` 与「未分配」，总数 +1 |

第 4 条专门验证"故障不能显示成 0 任务"——这是统计类功能最容易糊弄、也最容易被追问的地方。

## 7. 已知边界（写进自评"质量"维度的不足）

1. `src/db.js` 目前 `readData()` 只返回 `members`/`tasks`，会丢掉 `iterations`，所以迭代名称暂时回退成「未知迭代 #id」。**等朱传玺按契约补 `iterations` 后自动恢复**，我的代码不用改。
2. `priority` 默认 `MEDIUM` 使"没选"与"选了中"在统计上不可区分（见契约评审意见第 1 条）。
3. 统计是实时全表扫描：课程数据量下没问题，数据量大时要加缓存或物化视图——已登记为技术债。
4. 未做权限控制（US02/US03 本轮退回 Backlog），任何能看到页面的人都能看统计；当前数据本来也不敏感。
