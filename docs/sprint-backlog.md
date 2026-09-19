# Sprint 1 Backlog

| User Story | Title | Priority | Acceptance Criteria Summary | Development Tasks | Owner | Branch | Status |
|---|---|---|---|---|---|---|---|
| US01 | 查看项目成员 | Must | 查看预置成员；展示姓名和分工；成员 id 唯一；为 US04 提供负责人来源 | Member 数据结构、预置数据、成员展示、关键路径测试 | 彭佳成 | `feature/us01-members` | TODO |
| US04 | 创建并分配任务 | Must | 标题、描述、负责人可填写；负责人有效；空标题和无效负责人被拒绝；保存后可重新读取 | Task 数据结构、负责人选择、输入校验、持久化、创建测试 | 朱传玺 | `feature/us04-create-task` | IN PROGRESS |
| US05 | 更新任务状态 | Must | 支持 TODO / DOING / DONE；页面显示中文状态；非法状态被拒绝；刷新后状态保持 | 状态操作、中文展示、状态持久化、非法状态测试 | 何健翔 | `feature/us05-task-status` | IN PROGRESS |

US04 和 US05 的代码及关键测试已经进入 `develop`，但人工 diff 审查、演示证据和最终 DoD 验收仍未完成，因此暂不标记为 Done。US01 独立分支暂按当前安排保留为 TODO。

## Current Verification Notes

- 合并后的 `npm test`：12/12 通过。
- 集成提交：`e8da461`。
- 当前仅确认代码级测试结果；浏览器演示截图、人工 diff review 和 DoD 验收仍为 TBD。

## Sprint Dependencies

US01 → US04 → US05

- US04 依赖 US01 提供统一成员数据；
- US05 依赖 US04 的统一 Task 模型；
- 三个故事共享同一 Member / Task 数据定义。

## Out of Scope

- 登录注册
- 复杂权限
- 消息通知
- 评论
- 文件上传
- 统计分析
- 搜索
- 甘特图
- 拖拽看板
