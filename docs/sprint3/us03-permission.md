# US03 基础权限：功能交付与用户检查清单

日期2026-10-22，America/New_York。负责人杨浩伟，Codex辅助开发；分支feature/us03-permission，起点develop@1b6cae252fa3f6beacfdafe1e1f6e4c0fa4c775f（已包含US02）。本次用户要求“先完成US03，检查各种功能后再进行前端升级”；因此只做权限所需最小UI和请求接入，不更换样式、布局或框架，不合并develop/main，不打发布标签。

## 本次实现矩阵（供用户检查，非伪造PO会议签认）

| 入口/操作 | 未登录/失效token | member | admin |
|---|---|---|---|
| POST /api/auth/login | 按US02校验凭证 | 可登录 | 可登录 |
| GET /api/auth/me、POST /api/auth/logout | 401 | 当前会话 | 当前会话 |
| GET/HEAD members/tasks/stats/iterations | 401 | 200只读 | 200只读 |
| POST /api/tasks、PATCH /api/tasks/:id/status | 401 | 403且不落库 | 按业务校验创建/更新 |
| GET /api/users | 401 | 403 | 仅id/username/role，无哈希 |
| PATCH /api/users/:id/role | 401 | 403 | admin/member两枚举；非法400，未知账号404，最后管理员409 |
| 后续/api下新增入口 | 401 | 默认只允许GET/HEAD；其他方法403 | 仍受同一会话检查 |

这是一套保守角色矩阵，不实现逐任务所有者权限。User.id与Member.id没有关联，绝不以其相等当作授权条件。角色更新使用当前文件中的完整账号列表校验，写入成功后撤销目标账号全部会话；其他用户会话不受影响。自降级只有在还存在另一管理员时允许；同角色更新为幂等操作，不撤销会话、不重写文件。

## 生产入口与旧测试兼容边界

- `server.js`与`npm start`固定使用`createSecuredApp`，默认监听127.0.0.1；HOST可配置监听地址，PORT允许0用于隔离验证。没有AUTH_DISABLED/NODE_ENV/端口关闭鉴权的旁路。
- `createApp`保留旧免登录嵌入工厂契约，仅供已有回归和旧调用者；不可把它当作生产部署入口。旧测试不加token、不修改断言，新增权限测试全部使用`createSecuredApp`，并启动真实server.js证明环境变量不能绕过权限。
- `/api/auth`按US02检查会话；其余整个`/api`前置身份/角色中间件，静态文件在API检查之后，避免未来public/api文件绕过保护。未登录请求在读业务数据之前拒绝。
- 身份中间件每次从数据文件读取角色，不相信X-Role、请求body.role或浏览器存储的角色。非数组/无效/重复账号数据不放行。

## 角色写入的数据保护

新增db.updateData只用于角色更新：读取完整原对象，保留members/tasks/iterations/users哈希及未知扩展；畸形集合拒绝而非归一为空；临时文件写入、fsync后rename替换，失败清理临时文件，提交成功才撤销会话。

旧任务创建/状态写入路径没有重构，仍不提供多进程并发保证。因此本次不能把TD-S2-02/06全项目技术债标为清偿；仅新增角色路径具备上述保护。也不虚构数据库事务、持久化token或生产级身份系统。

## 最小前端功能

- session.js统一同源Bearer请求，401清除当前会话，403保留会话；不向外站发送token。
- 登录/登出/重载恢复状态；网络失败显示错误，不假装登出成功。账号切换时旧账号延迟响应和延迟JSON解析不能覆盖新账号页面。
- 工作台随会话变化刷新，普通成员创建/状态按钮禁用，管理员显示角色面板；登出清除列表、面板和未提交表单。用户名通过textContent输出。
- 未登录时不请求业务接口、不把预期401误报成服务故障，明确显示“请先登录”。这是权限功能提示调整，不是视觉升级。
- 统计页携带同一token，401提示回工作台登录，失败清空旧计数和分布，不能残留前一账号数据。
- 本分支尚未合入US11/US12，故没有伪造`/api/task-query`实现。`createSecuredApp({mountReadFeatures(app,db,readAccess){...}})`提供受全局策略保护的扩展挂载点；新增测试验证该机制，后续归并彭的真实mountTaskFilters时必须传入readAccess，不能用空next代替权限。

## 实际验证

环境Node v24.19.0、npm11.17.0，Windows；执行时HEAD=1b6cae2加本次未提交改动，归档提交由后续Git历史关联。

| 命令/检查 | 真实结果 |
|---|---|
| npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 | exit0，安装68个包 |
| npm test | **88 pass/0 fail/0 skip/0 TODO**：原69+后端权限13+前端会话6 |
| node --test test/sprint2-integration.test.js | 原5 pass/3历史TODO，未改文件 |
| 对比1b6cae2的旧test文件、data/db.json、package-lock.json | 全文零差异 |
| 后端生产入口 | 单独spawn server.js，PORT0/NODE_ENVtest/AUTH_DISABLEDtrue下仍401；有效管理员可访问 |
| 浏览器工具 | 实际完成管理员/成员两种状态、角色升降级、最后管理员拒绝、创建/改状态、登出清空、成员统计读取与返回后会话恢复 |

原始输出见[evidence/us03-20261022](evidence/us03-20261022/npm-test.txt)，浏览器截图[管理员](evidence/us03-20261022/admin.jpg)、[普通成员](evidence/us03-20261022/member.jpg)。浏览器操作为Codex工具验证，不是杨浩伟/何健翔的人工验收签字。定位负责人控件时精确标签匹配曾超时，读取实际DOM后按已观察ID完成操作；未作为功能缺陷隐藏或伪造通过。最后一次返回首页的控制台error记录为空。

三个历史TODO在独立质量准备分支e049307已补齐；本功能分支未混入它，因此全项目发布门禁和CI归并仍留后续集成，不能把88/88当作Sprint3发布DoD全部满足。

## 给用户的检查步骤（结果待你实际确认）

1. 访问本机独立预览；未登录时应看不到任务/成员数据，创建不可用。演示账号沿用US02，凭证按既有教学演示约定取得，不在本说明登记。
2. 以admin登录，核对成员、任务和统计；创建任务、更新状态后刷新检查持久化。
3. 打开角色管理，尝试移除唯一管理员：应提示拒绝；非法角色/账号请求也不落库。
4. 将某成员提升为admin，目标旧会话应失效，重登后能管理角色；再降级，重登后只读。
5. 以yanghaowei等member登录：能读取任务/统计，不能创建/改状态，账号管理面板隐藏；直接HTTP写请求也应403。
6. 登出、切账号、重启服务后检查失效会话及数据清理；若改角色失败，核对原文件和会话没有被误提交/撤销。

本机预览数据位于项目worktree外的`sprint3/us03-preview-20261022/db.json`，不是原桌面项目data/db.json；本次浏览器创建的任务仅存在于该演示文件。实际预览地址在本聊天交付，不把动态端口硬编码为产品配置。

## 人工复核与后续

何健翔检查本分支的会话复用、401/403矩阵、默认读策略、全部写入口、最后管理员、撤销时序、角色原子写入及兼容工厂边界；用户先检查功能，再决定前端视觉升级。人工签名/会议结论不在此预填。六项债、US11/US12正式接入、quality-prep和release-readiness归并、发布检查与Tag仍属后续任务。
