# Sprint 3 质量准备成果与交接状态

日期2026-10-21（America/New_York）。分支codex/sprint3-quality-prep，起点origin/develop@e57d62fd3507877d251626536302cb2510455d4e。负责人杨浩伟，Codex辅助执行；不是正式integration/sprint3，不含US02、US03、US11/12或何的release-readiness分支，不宣称这些功能已经集成或验收。

## 实际完成

- 原三个集成TODO已在当前真实API契约上增加断言：组合合法/非法输入与失败不落库；状态流转与统计逐项一致；属性/迭代/分配在重启后完整保留。test/sprint2-integration.test.js前五项断言全文未变，原七份故事测试全文未变。
- scripts/verify-sprint3.cjs固定原七份文件哈希和原五项集成前缀，单独跑原57项，再递归发现test目录所有新增*.test.js（包括日后auth/filter/e2e），逐轮打印tests/pass/fail/cancelled/skipped/todo及总计。缺汇总、原文件改动、零测试、失败、取消、TODO或skip一律exit1；没有baseline-only等绕过参数。
- 新增六项门禁策略测试，另用临时TODO+skip测试文件实跑完整门禁，Node正常结束时门禁仍返回exit1。探针结束后删除本次创建的临时文件，不遗留pending项。
- .github/workflows/quality.yml在push/PR和手动触发时，以Node22/24执行依赖安装与新门禁；失败也保存实际输出artifact，无部署步骤，无写仓库权限。
- 六项技术债已有逐项证据/建议和状态；US03已有三条验收草案、挂载交集、User/Member区别及待PO裁决点。

## 实测结果（执行于起点SHA+本次准备改动）

| 检查 | 实际结果 | 原始输出 |
|---|---|---|
| npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 | exit0，安装68个包 | evidence/quality-prep-20261021/npm-ci.txt |
| npm test（现有package入口） | 57 pass/0 fail/0 TODO | npm-test.txt |
| node scripts/verify-sprint3.cjs | 原57+新增14=71 pass；fail/cancel/skip/TODO均0；exit0 | sprint3-gate.txt |
| node scripts/verify-sprint2.cjs | 原35+故事及集成30=65 pass/0 TODO；exit0 | sprint2-gate.txt |
| 临时TODO+skip负向探针 | 71 pass/1 TODO/1 skip；**预期被拒绝exit1** | negative-todo-skip.txt |
| 尝试--baseline-only绕过 | **预期被拒绝exit1** | negative-bypass.txt |
| 临时技术债审计 | 调查完成；TD03/06/08仍OPEN，其中06实际复现静默结构覆盖 | techdebt-audit.txt |

新增14=集成8（原5+补3）+门禁策略6，不把这14个都写成新增业务故事。用户任务的原62项口径是57个故事测试+原5个集成测试；本次保留原62并新增9项真实测试，合计71。

表内相对日志路径除首行外均位于evidence/quality-prep-20261021。日志中的SHA是执行时HEAD（e57d62f），dirty=true记录尚未提交的实际改动；归档提交号由后续Git历史关联，不倒填未来SHA。

## 约束与待接收

本次未改data/db.json、src/db.js、src/app.js、package.json、src/domain/task.js、src/routes/tasks.js及原七份测试，未抢US02阶段公共出口。没有改朱/彭/何远程feature分支，没有合并develop/main，没有创建Release Tag。

三条无断言占位按用户已交办的“补三个TODO”补成真实断言；原有断言一行不删。本改动如需团队解释“测试只增不改”边界，应由何在diff审查记录中明确，不把本次工具实现解释成新的PO签认。

CI通过只代表当前checkout的自动质量，不代表US03权限旅程已完成，也不代表TD-S2-06等发布阻塞缺陷关闭。CI必须在GitHub真正运行后才能填写远程通过状态；本记录写入时仅本机Node24实跑，Node22和GitHub运行结果待远程确认。

正式US03仍等US02合入develop及出口交接；参见[权限准备](us03-permission-preparation.md)。六项债的[处置台账](technical-debt-disposition.md)中带债是待PO接受的建议，未自动裁决。人工diff/浏览器复核均未代签，T+120冻结与发布Tag按实际课堂时间/评审结果执行。

CI实现参照官方动作说明：[checkout](https://github.com/actions/checkout/tree/v4)、[setup-node](https://github.com/actions/setup-node/tree/v4)、[upload-artifact](https://github.com/actions/upload-artifact/tree/v4)。
