# Sprint 2 工程准备记录

执行日期：2026-10-17，Asia/Shanghai。质量协调：杨浩伟；PO / DRI / SM：何健翔。执行工具：Codex。所有本次代码操作在隔离 worktree 内进行，本记录不构成 PO 接收或人工审查通过。

## 当前结论

| 基线 | 完整 SHA | npm ci | npm test |
|---|---|---|---|
| 本地/远程 develop | 6f96b9d767c315ba21e806b95d15ad0ab8ea6e99 | exit 0 | 24 pass / 0 fail |
| origin/codex/sprint1-final-deliverables | 4dd34763a0e263e2f74d49cb2019597f4de313a6 | exit 0 | 35 pass / 0 fail |
| 本地 codex/sprint1-final-deliverables | 316d923cf3aeaecf0281fefe7ae9f6f19a631f4c | exit 0 | 35 pass / 0 fail |
| 准备分支基线移植提交 | f9c0eddbaed28de4f6f3683885bb21db32ee4f03 | exit 0 | 35 pass / 0 fail |

环境：Windows PowerShell，Node v24.19.0，npm 11.17.0。命令：`npm ci --no-audit --no-fund`、`npm test`。24=US01 15+US04 5+US05 4；新增服务状态11（6顶层+5子测试），合计35。不是35个顶层测试。

首次 git fetch 受元数据权限阻止，随后使用获准的提升权限执行 `git fetch origin` 成功；远程引用未发生变化。未运行 reset / clean / stash。原工作区保留 data/db.json 修改、源代码交付说明删除、两份未跟踪DOCX。保护副本、初始status、binary diff及完整refs bundle存放于隔离目录上层 protection，不提交用户演示数据。

## 最小同步方案（已验证，尚未获准正式接收）

从 develop 建立 `codex/sprint2-baseline-prep`，仅 cherry-pick -x 05c74994a4d46cf1a6da95c3bc1ddc0c35075509。工程差异恰为 package.json、public/app.js、public/index.html、public/style.css、public/service-status.js、test/service-status.test.js。后端、锁文件、种子数据及原三份测试均无差异；与本地最终交付工程文件比较一致。旧四份测试全文以SHA256固定，未改断言。

真实冲突：docs/code-review.md 在 develop 不存在，源提交修改此文件，出现 modify/delete。使用本地316d923的最新文件解决，保留 -x 来源说明。首次继续提交因未配置身份失败，随后仅以命令级 Codex <codex@localhost> 工具身份提交；未更改全局身份，未冒用杨浩伟。另同步最新 dod、review、retrospective、source-delivery、服务状态审查辅助文档；未引入远程旧DoD结论。Git历史不重写，原分支与提交均保留，bundle保留原始完整refs；cherry-pick是带来源的新提交，不宣称所有交付祖先已合入。

develop 尚缺的文档、证据、六份报告及包清单见 evidence/2026-10-17/develop-to-final-files.txt。最小准备分支不批量导入DOCX/ZIP/导出脚本；正式提交材料TXT快照在 baseline-facts，事实以本地316d923与源码包 e3b147be77fd8c1bf2613a352bb7c6d6b1081d5b 为依据。源码包关键代码和DoD/审查文档与本地提交一致。远程最终分支之后的11个本地提交为交付和事实修订，未见工程代码/原测试差异。

Sprint 1事实：9月22日最终Review七项人工Demo通过；三故事负责人合并前审查、杨浩伟集成后整体审查已由实际参与者确认，独立历史日志不完整。服务状态修复为10月8日评审后修复，不追溯为9月22日演示，也不冒称已获独立人工审查。本次未新增会议或人工验收事实。

## 已执行与当前门禁

- 新集成测试：5 pass / 0 fail / 3 TODO。覆盖旧请求完整链路、全部成员分配、两次状态转换与重启持久化，损坏JSON的POST/PATCH，写入前EIO的POST/PATCH。EIO不代表写到一半失败、断电或并发安全。
- `node scripts/verify-sprint2.cjs --baseline-only`：exit 0，原35+新增5通过，3 TODO；明确仅准备检查。
- `node scripts/verify-sprint2.cjs`：exit 1，真实阻止三份故事测试缺失。TODO不算通过。当前不能宣称Sprint 2门禁通过。
- 临时数据探针复现：db.readData丢弃额外iterations顶层集合，写回后集合消失。详见技术债TD-S2-01。
- 本次浏览器人工链路：未执行，待杨浩伟/PO实际操作并签名；HTTP测试不等于浏览器或人工验收。本次人工diff审查：待执行；Codex静态检查不能代签。

索引：[集成契约与窗口](integration-plan.md)、[质量门禁与DoD](quality-gates.md)、[技术债](technical-debt.md)、[执行与证据](evidence/README.md)、[AI现场记录](ai/session-20261017.md)。

## 需何健翔决策后才继续的动作

1. 批准接收上述代码基线方案，并确认本地最新正式材料作为事实来源；决定是否及何时将准备成果推进 develop。当前未push、未改develop/main。
2. 指定 src/app.js、public/app.js、public/index.html、public/style.css、public/service-status.js及CI配置的共享出口；已指定的五个公共文件继续只由朱传玺统一提交。
3. 确认优先级枚举/默认值、日期格式/时区/空值、迭代ID/不存在引用、统计口径及旧数据迁移。下文列的是待定契约，不擅自决定接口。
4. 给出本轮T0和Review时间，确认T+90停止接收新功能及后续集成/回归窗口。

批准基线、公共契约及入口负责人明确后，才从被批准的SHA创建正式 integration/sprint2。三个feature应对齐该SHA、提交自身测试与当场AI/人工审查记录，再按US06→US07→US10逐个合入并逐次回归；当前没有创建正式integration分支，也没有代开发故事。
