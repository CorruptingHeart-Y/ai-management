# US02 收尾交接与人工审查入口

日期2026-10-20（America/New_York）。来源分支feature/us02-login，完整基准SHA：6c487fa9d8333b76bae32e4900403b516e569e10。修复分支codex/us02-handoff，由Codex辅助杨浩伟帮朱传玺准备；本文件不宣称朱传玺、何健翔或PO已经接受修复，也不构成人工签名。

## 本次改动

- src/domain/user.js：移除演示明文密码注释，保留指向计划会表2的说明，哈希和运行逻辑不变。
- test/auth-handoff.test.js：独立新增5项测试，不改任何既有测试文件。
- package.json：npm test追加新增文件；既有文件全部保留。作为US02负责人统一出口的候选补丁，未直接改其远程分支。
- docs/sprint3：现场AI表5、原始回归日志、本文交接清单。

## 真实验证

执行版本为6c487fa加本次未提交改动；归档提交随后由Git历史关联，不将将来的提交号冒写为执行时HEAD。环境沿用本机Node/npm。所有HTTP测试注入临时文件，不使用真实db.json。

| 命令/检查 | 实际结果 |
|---|---|
| npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 | exit 0，安装68个包 |
| npm test | 69 pass/0 fail/0 TODO：原57+US02原7+本次5 |
| node --test test/sprint2-integration.test.js | 5 pass/0 fail/3 TODO，不能把退出码0解释成正式门禁已通过 |
| git diff原9份测试和data/db.json对比来源分支 | exit 0，全文无差异；四份Sprint1测试也保持不变 |
| rg扫描src/public/data中的两种演示明文 | 无匹配（exit 1是rg无匹配语义），演示材料和测试夹具保留教学凭证 |

原始输出：[安装](evidence/us02-handoff/npm-ci.txt)、[69项回归](evidence/us02-handoff/npm-test.txt)、[独立集成](evidence/us02-handoff/legacy-integration.txt)。

## 新增5项覆盖与边界

1. 四个预置账号均可登录、角色准确，登录/me响应不含哈希，token互不相同，登出只撤销当前会话。
2. 用同一文件重建应用后旧token失效，账号哈希仍保留，可重新登录。
3. 登录后创建及更新任务保留users、iterations和members；US02阶段members/tasks/stats/iterations仍免登录可读，符合US02不提前实施US03的约定。
4. 损坏JSON时登录及会话读取返回明确500 JSON错误，不覆盖损坏文件。
5. 首次账号写入前注入EIO，返回失败不签发token、文件逐字不变，恢复写入后可登录。此测试不证明写入中断或断电时的原子性。

## 交给何健翔/朱传玺的人工步骤（均待执行）

| 人工检查项 | 操作/预期 | 状态/签名 |
|---|---|---|
| diff审查 | 阅读6c487fa到修复分支的user.js、package.json、新测试及文档，确认未改旧断言、未增US03鉴权行为 | 待何健翔实际签字 |
| 登录成功/失败 | 由表2取得演示凭证，浏览器正确登录展示用户名/角色；错误密码提示失败且不建立会话 | 待执行 |
| 刷新与登出 | 登录后刷新保留有效会话；登出恢复表单；旧token调用me为401 | 待执行 |
| 重启与失效恢复 | 重启服务后浏览器刷新，旧token失效并恢复登录表单；重新登录成功 | 待执行 |
| 业务兼容 | 登录前后成员/任务/统计/迭代可访问；任务创建/状态更新与原数据保留 | 待执行 |
| 发布与范围裁决 | 确认US02只负责登录/会话，不将免登录业务路由误判为本故事缺少US03；本轮发布时必须补权限旅程 | 待PO裁决 |

人工记录至少追加真实时间、操作者、浏览器、所测SHA、观察结果、截图/问题与处置。不能用本次AI HTTP断言代替这些签字。

## 仍待接收与后续分工

朱传玺接收本修复后，按既有流程经何健翔人工审查/PO接受，再合入develop；杨浩伟随后从包含US02的develop建立feature/us03-permission。当前未修改develop/main，未打Release Tag，未开发US03。独立集成原3个TODO、CI及其他发布就绪工作仍按Sprint3分工处理，未在US02收尾中降低门禁或删除TODO。

US03接入应复用同一createApp内的会话存储，不创建第二套token；本次仍保留原内存会话与重启失效约定，不提前替权限负责人决定拦截点。前端网络错误的统一反馈仍属TD-S2-04处置范围，本次未声称已清偿。
