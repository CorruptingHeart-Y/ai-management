# Sprint 1 Code Review

## Review Scope

本次静态审查基于 `develop@6f96b9d`，覆盖 Sprint 1 最终增量的成员领域模型、任务领域模型、成员与任务路由、JSON 数据层、前端页面与交互、样式、README 及全部自动测试。审查仅是 AI 辅助，不代表 DRI 已完成人工 diff 审查。

重点文件：

- `src/domain/member.js`
- `src/domain/task.js`
- `src/routes/members.js`
- `src/routes/tasks.js`
- `src/db.js`
- `public/app.js`
- `public/index.html`
- `public/style.css`
- `test/`
- `README.md`

## Findings

### Blocker

未发现。

### Major

未发现。

### Minor

1. `src/routes/tasks.js` 仍导出一份 `VALID_STATUS`，同时 `src/domain/task.js` 提供 `VALID_STATUSES`；前端也保留相同状态列表。三处当前值一致且测试覆盖通过，但后续 Sprint 可统一从一个共享契约生成，减少维护时不一致的风险。本轮不为此做结构性重构。
2. 页面顶栏“本地运行正常”是静态说明，不是实时健康检查。它不影响 Sprint 1 功能，但演示时应以实际页面操作和测试结果为准。

### Info

- 未发现冲突标记、调试输出、硬编码凭据、`node_modules` 或参考资料误提交。
- 数据层使用单一 JSON 文件，符合当前 Sprint 的最小范围；登录、权限、通知、评论、上传、统计等复杂功能均未加入。
- `experiment1-reference/` 仅通过本地 `.git/info/exclude` 排除，没有进入版本库。

## Sprint Scope Check

实现范围仅包含 US01 查看项目成员、US04 创建并分配任务、US05 更新任务状态，以及满足这三项所需的最小数据持久化、页面交互、测试和文档。未发现 Sprint 2 / Sprint 3 功能或不必要的框架与服务。

README 同时描述三个用户故事、统一数据约定、接口、运行测试方式和分支策略，不是单一 Story 的说明。

## Shared Model Check

- `Member` 统一为 `id`、`name`、`role`；`id` 要求唯一正安全整数。
- `Task` 使用 `id`、`title`、`description`、`assigneeId`、`status`，并保留辅助字段 `createdAt`。
- `assigneeId` 在创建任务时按当前 `members` 数据校验，真实关联 `Member.id`。
- 状态值统一为 `TODO`、`DOING`、`DONE`，后端拒绝其他值，前端显示待办、进行中、已完成。
- US01 与 US04/US05 共用同一数据文件；US01 集成没有覆盖任务路由、任务领域逻辑或原有测试。

## Test Coverage Summary

执行命令：`npm test`

- US01：15/15 通过。覆盖预置成员、唯一 id、空列表、自定义数据、非法成员数据、读取失败、与 US04 分配及持久化联调。
- US04：5/5 通过。覆盖正常创建、空标题、无效负责人、创建后读取和重新加载持久化。
- US05：4/4 通过。覆盖 TODO → DOING、DOING → DONE、非法状态及不存在任务。
- 合计：24/24 通过，0 失败。
- 已有真实浏览器记录覆盖成员展示、创建分配、刷新持久化、状态更新和再次创建任务的完整链路。

## Comment Assessment

- US01：注释充分。成员契约、只读接口、共享数据来源和错误边界均有说明。
- US04：注释充分。任务创建、负责人校验、id 生成、初始状态和数据持久化均有说明。
- US05：注释充分。状态枚举、合法性校验、不可变更新及 PATCH 路由均有说明。

以上是 AI 静态检查结论，最终是否满足课程要求仍由 DRI 人工确认。

## Human Review Checklist

- [ ] DRI 已阅读最终 diff
- [ ] DRI 确认无阻塞问题
- [ ] DRI 确认可进入 Sprint Review

## 后续复核

2026-10-08：原审查第33行的“顶部本地运行正常为静态文字”已在 `05c74994a4d46cf1a6da95c3bc1ddc0c35075509` 修复，并安全快进集成至 `codex/sprint1-final-deliverables`。页面复用成员列表原有 GET `/api/members` 请求，并校验 HTTP 成功、JSON 响应及成员数组结构；连接状态会反映检查中、响应正常或异常。五秒超时会中止请求并显示异常。此状态只说明成员接口成功响应，不代表全部业务功能健康。

最终实际npm test为35/35，0失败：原故事24项保留，新增服务状态11项（6个顶层及5个子测试）。新增覆盖初始状态、成功单请求、网络失败、有效空数组、HTTP/格式/契约异常与超时。隔离浏览器回归验证三种状态、创建分配、状态流转、刷新持久化和失败重试；正常、异常及重试阶段控制台error日志均为空。临时服务计数验证每次加载或重试一次成员请求。详见evidence/sprint1-integrated-browser-20261008.txt。

原Findings保留为历史；当前未解决的Minor仅为状态枚举重复定义。此次未改变后端接口、业务模型、持久化或依赖。人工Review清单仍未确认，不以本段AI复核替代。

## 2026-10-08 交付追溯补充

上面的清单是原审查阶段记录，不作为当前需要重新填写的模板。2026-09-22 DRI已确认最终人工Demo七项成功，技术Sprint Goal已实现。人工diff审查仍无独立确认记录，不将操作Demo替代代码审查。

修复前的交付整理未改功能代码，回归24/24通过，此结果保留作历史。最终版本另含上述05c7499修复及35/35回归。补充静态风险：创建与状态请求缺少完整网络失败捕获，任务读写异常缺少统一JSON错误响应，单JSON文件写入非原子且不提供多进程并发保证。这些未在本轮复现为功能故障，作为下一轮异常测试与架构边界建议，不在此次扩大修复范围。
