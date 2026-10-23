# 主流程与权限异常：实际浏览器核验

执行日期：2026-10-23，America/New_York；截至11:16已执行完毕。执行者：Codex浏览器操作与测试辅助。受测代码：`codex/sprint3-closeout-assets@fbd6f4540ee0248a6e42b4f664e3ba1b451e9aa4`，本轮未修改业务源码、测试断言或展演材料。结果为工具辅助验收证据，不等同于何健翔本人签字或PO发布裁决。

## 环境与方法

在隔离worktree运行`node scripts/start-demo.cjs`，实际服务入口为`server.js`，地址`http://127.0.0.1:50968/`。数据文件为新建临时目录`ai-management-demo-JJDQ4E/demo-db.json`，没有复用生产或原工作区数据。通过实际浏览器页面填写、选择、点击、刷新和导航；接口安全异常另由真实生产入口E2E补足，未用页面stub冒称后端验证。

## 浏览器已执行结果

以下16项均已观察到预期结果；编号对应证据文件前缀，并非新增node:test条目。

| 编号 | 操作及预期 | 实际结果与证据 |
| --- | --- | --- |
| 01 | 未登录不显示业务数据；错误密码不能登录 | 任务/成员为登录提示，创建禁用；错误密码显示“用户名或密码错误”。`01-invalid-login.txt/png` |
| 02 | 管理员登录、空标题报错 | 显示管理员、4成员和角色管理；空提交显示“任务标题不能为空”，无任务产生。`02-empty-title.txt` |
| 03 | 新建属性任务A、默认任务B，刷新保留 | A负责人杨浩伟、高、2000-01-01、Sprint3；B负责人彭佳成、中、无截止/迭代。刷新后两者保留。`03-created-refreshed.txt/png` |
| 04 | 搜索A+高优先级+杨浩伟+Sprint3，开启迭代分组 | 仅A、Sprint3分组1条，排除B。`04-combined-filter.txt/png` |
| 05 | 仅逾期 | A为待办时显示1条。`05-overdue-before.txt` |
| 06 | A TODO→DOING | 任务页显示进行中。`06-doing.txt` |
| 07 | 统计与实际状态一致 | total2、TODO1、DOING1、DONE0；优先级1高1中；负责人及迭代一致。`07-stats-doing.txt/png` |
| 08 | 登出 | 清空列表/角色区域，恢复登录提示和禁用创建。`08-logout.txt` |
| 09 | 普通成员登录 | 创建禁用、不出现角色管理；显示可更新状态，原任务可读。`09-member-permissions.txt/png` |
| 10 | 成员将A DOING→DONE并刷新 | DONE保留，负责人及其他属性保留。`10-member-done-refreshed.txt` |
| 11 | DONE后统计 | total2、TODO1、DOING0、DONE1。`11-stats-done.txt/png` |
| 12 | DONE任务排除逾期 | 仅逾期0，显示没有符合条件的任务。`12-done-excluded-overdue.txt` |
| 13 | 管理员尝试降级最后管理员 | 显示“不能移除最后一名管理员”，未登出或获得错误成功提示。`13-last-admin-denied.txt/png` |
| 14 | 刷新账号确认拒绝没有落盘 | admin角色恢复显示管理员。`14-admin-role-unchanged.txt` |
| 15 | 登出后访问筛选页面 | 登录失效提示；列表和成员/迭代选项不含先前数据。`15-anonymous-filter.txt/png` |
| 16 | 登出后访问统计 | 提示返回工作台登录、计数为破折号，不泄露先前统计。`16-anonymous-stats.txt/png` |

全部截图和DOM快照位于[evidence/browser-20261023](evidence/browser-20261023/)。本次读取浏览器warning/error日志为空；不将其扩大解释为覆盖所有网络、设备或浏览器。

## 后端权限与异常补证

本轮实际再次执行`npm test`，日志`evidence/browser-20261023/npm-test.txt`：受保护原七文件57/57，其他递归测试82/82，合计139/139，fail/cancel/skip/TODO全0。既有生产入口双旅程均通过，未新增或改写其断言。

`test/e2e/exception-journey.test.js`实际覆盖匿名/伪造token401、错误凭证401、缺登录字段400、成员读取200及账号读取403、伪造X-Role/请求体角色越权403、无效标题/负责人/优先级/日期/迭代400、无效查询400、不存在对象404、角色变更撤会话401、畸形JSON/集合500且原字节不变。`main-journey.test.js`覆盖真实服务重启后的会话失效及任务持久化。上述为HTTP自动检查，不冒称均由浏览器点击触发。

## 结论与边界

本次检查未发现阻断主流程或上述权限异常的缺陷。仍能看到工作台标题与说明保留Sprint1字样，统计页保留Sprint2字样，属于待前端升级统一的展示问题；未据此改动页面。属性编辑和完整迭代管理等原规划缺口仍按发布边界处理。本次结果不能替代人工diff审查、业务方认可、表8签字、真实会议或发布批准。
