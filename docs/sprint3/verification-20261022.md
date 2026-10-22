# 2026-10-22 实际回归与原规划核对

执行人：AI 测试/回归助手，按杨浩伟本次“OK，那你测试吧”授权执行。无人工验收签字；没有作出发布就绪裁决。

## 被测版本与结果

| 版本 | 完整 SHA | 命令 | 实际结果 |
| --- | --- | --- | --- |
| develop | 1b6cae252fa3f6beacfdafe1e1f6e4c0fa4c775f | npm ci --no-audit --no-fund；npm test | 安装成功，69 pass / 0 fail / 0 TODO / 0 skip |
| feature/us03-permission | 892d9c4540ed71f5fc3c681426a73a72cb511e80 | 同上 | 安装成功，88 pass / 0 fail / 0 TODO / 0 skip |
| 隔离组合验证 | 58d82d2626346d8e1f834f6c65682b56be9bdd00 | 同上 | 安装成功，88 pass；默认脚本未收录筛选和集成文件 |
| 隔离组合验证及本次新增测试 | 上述组合提交 + test/secured-composition.test.js | node --test test/filter.test.js test/filter-mount.test.js test/secured-composition.test.js | 23 pass / 0 fail / 0 TODO / 0 skip |
| 同上 | 同上 | node --test test/sprint2-integration.test.js | 5 pass / 0 fail / 3 TODO / 0 skip |
| 同上，发现全部测试文件 | 同上 | PowerShell: $tests=@(rg --files test -g '*.test.js'); node --test @tests | 119 tests：116 pass / 0 fail / 3 TODO / 0 skip |

组合分支 codex/us03-filter-verification 仅用于本地验证：以 US03 为父提交合并 feature/us11-us12-filter@e4830b702a452da6ec776b546cf17e670654a4d6，保留双方历史。没有修改 main/develop，也不是获批的 integration/sprint3。

测试通过 createSecuredApp 与 mountTaskFilters 的现有扩展口挂载真实查询路由；未改业务实现。验证创建任务→组合筛选/逾期→DOING→DONE→统计一致→重新创建服务读取同一文件；成员读与写拦截、伪造身份、角色变更撤销会话，以及昨日/当日/未来/无日期/DONE 的逾期边界。重新创建实例验证了应用重启后的会话失效与持久化，未模拟主机掉电。

## 实际发现：不能据测试绿灯认定原规划全部完成

命令 node scripts/probe-original-scope.cjs，输出见证据 JSON；它是现状探测，不是通过的需求验收。

1. US05：member 修改任务状态实际 403。当前 US03 采用成员只读策略，与原规划“团队成员更新任务状态”不符，需 PO 明确权限矩阵后调整；尚未通过该项验收。
2. TD-S2-06：临时文件中的 tasks 对象集合被归一为空列表，查询返回 200 空结果；再创建任务返回 201 并丢失原 sentinel。仍存在静默覆盖异常数据风险。角色管理的结构校验未覆盖任务写入链路。此项应作为发布前缺陷处理。
3. TD-S2-08：修改任务属性 PATCH /api/tasks/1 返回 404；现状只有创建时设属性。
4. US06 原规划的 acceptanceCriteria 字段随创建返回 201，但字段未保存。
5. US07 创建含目标/日期的迭代 POST /api/iterations、已有任务更换迭代 PATCH /api/tasks/1 均为 404。现状支持读取预置迭代、创建任务时归属，不能宣称完整迭代维护。
6. 三个原集成 TODO 仍在此被测组合中。已有独立质量准备分支的替代测试/CI 尚未合入，不得把别的分支证据算成此版本通过。
7. 筛选模块依然通过测试装配挂载，生产 server.js 没有自动挂载它；真实正式集成仍待执行。旧 createApp 兼容工厂不执行 US03 全局权限，不能用其旧回归结果替代受保护服务验收。

需求范围可按 PO 决定裁剪，但必须在发布边界中明示；未实现项不计为原需求已满足。本次未修复业务功能，也未升级前端视觉。建议先裁决 US05 权限、处理 TD06 数据完整性风险并完成实际集成，再开始前端升级，避免 UI 固化错误契约。

## 证据与保护

原始输出位于 evidence/verification-20261022。安装、回归、组合测试、TODO 计数和探测 JSON 均为本次执行所得，探测记录 UTC 2026-10-22T17:20:20Z（纽约 13:20）。旧测试中模拟异常的堆栈属于其错误路径输出，以最终计数判断断言结果。

git diff origin/develop -- 对原七份业务测试、auth/auth-handoff、sprint2-integration 和 data/db.json 为空：本组合没有修改它们。用户主工作区的业务数据及已有未提交文件保持原状。所有写入探测均使用测试帮助函数生成的临时文件并执行清理。测试输出从既有工作树移入本目录，未将噪声留在 US03/develop 检查工作树。

本次未执行新的浏览器人工链路检查，也无人工 diff 签字；US03 先前浏览器证据不代表本次组合已通过人工验收。何健翔仍需审查并签字。

## 表 5：本次真实 AI 交互记录

| 时间 | 角色 | 输入摘要 | 输出与实际处置 |
| --- | --- | --- | --- |
| 2026-10-22 13:16–13:20 America/New_York，本轮执行 | 测试/回归 | 用户在原规划差距讨论后要求“OK，那你测试吧” | 复跑 develop 69、US03 88；新建本地隔离组合分支与三项严格集成测试；复现权限和异常数据问题并保存原始证据。未修业务、未合入 develop、未代签验收。 |
| 本轮结果归档时 | 测试/回归 | 依据本轮实际执行继续汇总 | 全发现模式 116 pass、3 TODO；如实列出原需求差距与默认脚本漏测，建议先处理权限契约与数据完整性，再升级 UI。用户尚未作下一步处置决定。 |
