# Sprint 1 Backlog

| User Story | Title | Priority | Owner | Branch | Status | Current Note |
|---|---|---|---|---|---|---|
| US01 | 查看项目成员 | Must | 彭佳成 | `feature/us01-members` | DEMO VERIFIED / PENDING DOD | 代码已集成；15/15 通过；2026-09-22 人工 Demo 成功；等待最终 DoD 确认 |
| US04 | 创建并分配任务 | Must | 朱传玺 | `feature/us04-create-task` | DEMO VERIFIED / PENDING DOD | 代码已集成；5/5 通过；2026-09-22 人工 Demo 成功；等待最终 DoD 确认 |
| US05 | 更新任务状态 | Must | 何健翔 | `feature/us05-task-status` | DEMO VERIFIED / PENDING DOD | 代码已集成；4/4 通过；2026-09-22 人工 Demo 成功；等待最终 DoD 确认 |

## Acceptance Criteria Summary

### US01

查看实验一确认的四名成员及分工；成员 id 唯一；成员列表同时作为 US04 的负责人来源。

### US04

填写标题、描述和负责人；拒绝空标题与不存在的成员；保存后能够重新读取，初始状态为 TODO。

### US05

支持 TODO、DOING、DONE；页面显示对应中文状态；拒绝非法状态；刷新后状态保持。

## Current Verification Notes

- US01 15/15、US04 5/5、US05 4/4；全量 24/24 通过、0 失败。
- 完整链路已验证：查看成员 → 创建并分配任务 → 刷新持久化 → TODO → DOING → DONE → 再次刷新。
- US01 集成提交 `cc7c937`，合入 `develop` 的提交 `34b3df7`，文档状态同步 `6f96b9d`。
- 2026-09-22：用户确认最终人工 Demo 七项全部通过，三个 Story 的 Demo 结果更新为成功。
- 上述是代码与自动验证状态，不等同于正式 DoD 或 Sprint Review 结论。

## Sprint Dependencies

US01 → US04 → US05

- US04 使用 US01 的 Member 数据作为负责人来源。
- US05 使用 US04 的 Task 模型和持久化数据。
- 三个故事共享同一 JSON 数据源。

## Out of Scope

登录注册、复杂权限、消息通知、评论、文件上传、统计分析、搜索、甘特图和拖拽看板均不在 Sprint 1 范围。
