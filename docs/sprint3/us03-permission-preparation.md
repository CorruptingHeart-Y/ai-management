# US03 基础权限：杨浩伟开工准备与交接契约草案

2026-10-21；依据用户提供的《实验四任务最终版》，不是新的PO会议记录。当前develop=e57d62fd3507877d251626536302cb2510455d4e，US02仍在feature/us02-login@6c487fa，收尾在codex/us02-handoff@34a0604，未合入develop。本次只准备契约，不创建正式feature/us03-permission，不抢改公共入口。

## 三条验收标准草案

1. **身份有效**：除登录入口外，需要保护的API对缺失/伪造/登出失效/重启失效token返回401；有效会话能读取被授权资源。不从客户端传入的role或userId推断权限，不泄露密码哈希。
2. **角色与越权**：按PO冻结的角色矩阵执行操作；已登录但无权限返回403，且数据文件逐字不变。管理员的角色管理、非法角色、未知用户、最后管理员保护及角色变化后旧token的处理须有明确测试。
3. **全路由与页面一致**：成员、任务、状态更新、统计、迭代、筛选/逾期查询及新增角色管理路由均在清单中；界面禁用/隐藏未授权入口并解释原因，直接HTTP越权仍被拒绝。全量回归、主旅程及异常/权限旅程通过，既有断言不删减。

## 必须先交接或裁决的设计点

- User与Member不是同一个实体。US02中User id=1是admin，而Member id=1是彭佳成；**绝不能用user.id===assigneeId来判断“自己的任务”**。若要任务所有者权限，需先确定memberId显式关联与迁移；建议本轮先按admin/member角色矩阵执行，不临时发明关联。
- 建议矩阵（待朱传玺冻结，尚未实现）：登录入口匿名可用；业务只读接口admin/member可用；角色管理仅admin；任务创建与状态更新是否member可用须PO逐项决定。没有“有token就能改所有数据”的隐含默认。
- 角色管理拟新增独立router/domain/test，不复用Member.role。候选路由与字段待契约owner确认，本文不假称正式API已经存在。
- 现有US02 tokenStore在createApp内部、业务路由之后创建；US03需要复用同一Map并调整装配顺序，避免另建一套会话导致US02登录token不能用于权限。
- 原七份测试与原五项集成断言大量使用免登录HTTP；而US03要求实际运行时鉴权。必须由owner明确“测试工厂兼容模式/测试注入”与生产启动强制鉴权的边界，不能按端口、NODE_ENV或全局fetch伪造放行来保绿，也不能悄悄改旧断言。此项在共享入口交接前确认。

## 与US11/US12的真实交集

已检查彭佳成分支e4830b7：新增src/features/task-filters.js导出mountTaskFilters(app,db,readAccess,options)，强制传入readAccess；挂载/api/task-query。US03应向其传入统一身份/只读策略，不能传无条件next()假装完成权限，也不能只保护/api/tasks而漏掉查询入口。筛选/逾期页面及其fetch请求需要携带同一会话token，401与403显示不同反馈。成员/迭代下拉加载也要使用授权请求。

## 文件影响面与出口

| 文件 | US03阶段预计改动 | 与谁交叉/当前处理 |
|---|---|---|
| src/app.js、src/db.js、data/db.json、package.json | 会话复用、策略挂载、用户角色持久化、测试入口 | 先朱后杨；US02未合入前本次全部不改，真实db永不作测试夹具 |
| src/routes/tasks.js | 原任务功能语义保持；鉴权优先在统一中间件处理 | 不替彭修改旧任务接口，避免三方抢改 |
| src/middleware/、角色管理新增router/domain | 身份解析、权限拒绝、角色管理 | 待正式开工新增，由杨负责 |
| server.js、test/helpers.js | 生产鉴权开关/测试兼容策略若采用需显式审核 | 涉及原测试可重复性，不能隐式绕过；待PO确认方案 |
| public/auth.js、public/app.js、index.html、stats.js、task-filters-page.js | token传递、权限UI、401/403恢复 | 朱的US02前端与彭筛选前端有交集，杨在统一集成窗口归并 |
| test/permission.test.js、test/techdebt.test.js | 新增权限矩阵与数据保护断言 | 不改既有测试；测试名和覆盖清单在契约冻结后落实 |
| .github/workflows/、scripts/ | 全量递归发现测试、计数及阻塞策略 | 杨负责，本次已独立实现，不依赖公共业务文件写权限 |

## 改进措施落实

Sprint1：公共契约已建立；历史AI/人工证据仍有缺口，不追造；独立集成窗口本次继续执行。Sprint2：每次补丁附影响面；人工diff由何健翔当场签名；新门禁明确展示TODO/skip/cancel并实测拒绝。T+120停止新功能；没有真实课堂T0/已过分钟数证据，不编造计时。

## 正式开工条件

朱接收US02收尾、完成何所提P1文档修复并关闭有条件复核，US02合入develop；fetch后确认祖先关系与实际基线，再创建feature/us03-permission。角色矩阵/挂载点冻结且公共文件出口已交接后才实施。integration/sprint3为后续正式合入分支，本次不先制造未经确认的集成结果。
