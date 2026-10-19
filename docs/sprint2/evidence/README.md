# 真实证据索引及后续留档要求

2026-10-17为本次执行日期（Asia/Shanghai）。历史Sprint1材料单列，不能冒充本轮新人工检查。

| 路径（2026-10-17/下） | 对象/命令 | 真实结果 |
|---|---|---|
| refs.txt、branch-inventory.json | fetch后本地/远程全部分支、SHA、测试文件、脚本 | 逐分支静态核查，非所有分支均实跑 |
| develop-npm-ci.txt / develop-npm-test.txt | develop@6f96b9d npm ci --no-audit --no-fund / npm test | exit 0/0；24通过 |
| remote-final-npm-ci.txt / remote-final-npm-test.txt | origin交付@4dd3476，同命令 | exit 0/0；35通过 |
| local-final-npm-ci.txt / local-final-npm-test.txt | 本地交付@316d923，同命令 | exit 0/0；35通过 |
| prep-npm-ci.txt / prep-npm-test.txt | codex/sprint2-baseline-prep@f9c0edd，同命令 | exit 0/0；35通过 |
| integration.tap | 同准备SHA+未提交新增测试；node --test --test-reporter=tap test/sprint2-integration.test.js | exit 0；5通过、3 TODO；包含预期故障栈 |
| preparation-gate.tap | 同准备SHA+未提交准备文件；node scripts/verify-sprint2.cjs --baseline-only | exit 0；35+5通过、3 TODO，仅准备 |
| formal-gate-blocked.txt | node scripts/verify-sprint2.cjs | exit 1；三份故事测试缺失，正式门禁阻塞 |
| data-loss-diagnostic.txt | 临时文件createDb read/write探针 | iterations读取/写回保留均false，未触碰真实db |
| submission-zip-check.txt / submission-verification.json | 正式submission源码ZIP对照本地提交/manifest | 源码基线e3b147b，核心工程及DoD/审查匹配；不代表整包重跑npm |
| develop-to-final-files.txt | git diff --name-status origin/develop 本地最终分支 | 完整缺失/变化文件清单 |
| final-verification.txt | 工作区保护、引用保护、哈希与diff检查 | 结束前实测结果 |

本次所有npm输出都来自隔离worktree，不是原工作区。初始命令的时间与SHA在本次工具输出中；脚本门禁自己输出UTC ISO时间、分支、SHA、dirty和命令，UTC需按+08:00阅读。日志对应执行时的f9c0edd+未提交准备变更；归档提交SHA另由Git历史索引，不把未来提交号倒写成测试时版本。

## 人工与冲突记录状态

本次浏览器人工检查：未执行。操作者/日期/SHA/浏览器/结果/截图：待实际执行填写。必须走成员展示→旧请求兼容创建→含属性/迭代创建→负责人显示→TODO/DOING/DONE→统计核对→刷新→数据保留，并检查网络失败、无效输入及恢复。AI HTTP检查不能填写为人工Demo通过。

本次人工diff审查：未执行。审查人/日期/分支与起止SHA/文件范围/发现/处置/复审结论：待真实审查填写。已知准备diff：develop→准备分支的六个工程文件、新集成测试/独立门禁及最新事实文档。原四份测试应全文一致。

真实冲突C-S2-01：develop@6f96b9d cherry-pick 05c7499，docs/code-review.md modify/delete；Codex采用本地316d923同名最新文档解决，形成f9c0edd。工程文件无冲突。人工接受该处理：待杨浩伟及PO查看。无任何故事feature冲突处理记录，不补造。

后续每次接收以单独记录保存：实际日期、feature/集成起止SHA、分支、测试命令与退出码、旧35/新增pass/fail/TODO/skip分别计数、浏览器操作者、人工diff审查人、冲突双方SHA/解决方式、未关闭缺陷、逐故事DoD和PO结论。缺项显式待办，禁止预填通过。
