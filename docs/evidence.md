# Sprint 1 Evidence Checklist

## US01

- [x] 功能运行截图：[桌面](evidence/us01-members.png)、[手机](evidence/us01-members-mobile.png)
- [x] 测试证据：[全量 TAP](evidence/us01-tests.tap)、[浏览器 8 项记录](evidence/us01-browser-results.json)
- [x] US01 测试：15/15 通过
- [x] Feature 提交：`8109119`、`d44e3c9`、`b6c136d`
- [x] 集成分支提交：`cc7c937`
- [x] 合入 `develop`：`34b3df7`
- [x] 状态同步：`6f96b9d`
- [ ] 人工 diff review：待 DRI 确认
- [ ] 最终 DoD：待 DRI 确认

## US04

- [x] US04 测试：5/5 通过
- [x] Feature 提交：`f143bd5`、`40b9b4e`
- [x] 已集成 `develop`：`442ee8e`
- [x] 完整链路中已验证创建任务、分配负责人和刷新持久化
- [ ] 独立运行截图：TBD
- [ ] 人工 diff review：待 DRI 确认
- [ ] 最终 DoD：待 DRI 确认

## US05

- [x] US05 测试：4/4 通过
- [x] Feature 提交：`8f74544`、`f6cad04`、`d3fa695`
- [x] 已集成 `develop`：`79948a5`
- [x] 完整链路中已验证 TODO → DOING → DONE 及刷新后保持
- [ ] 独立运行截图：TBD
- [ ] 人工 diff review：待 DRI 确认
- [ ] 最终 DoD：待 DRI 确认

## Integrated Sprint Increment

- [x] 查看项目成员
- [x] 创建任务
- [x] 分配负责人
- [x] 刷新后任务仍存在
- [x] 修改为进行中
- [x] 修改为已完成
- [x] 刷新后状态仍保持
- [x] 状态更新后仍能继续创建任务
- [x] 全量测试通过：24/24，0 失败
- [ ] 最终 Sprint Review Demo 截图 / 录屏：TBD

测试命令：`npm test`

最终集成审查记录见 [code-review.md](code-review.md)。现有 US01 截图和浏览器记录能够支撑完整链路事实，但不替代正式 Sprint Review 的现场确认。

## Pull Request 说明

本轮未使用 GitHub PR，采用 Feature 分支、`integration/us01-merge` 及本地/分支集成审查流程。不得补造 PR 地址。

## Remaining Human Evidence

- DRI 最终 diff 阅读与无阻塞确认
- 三个 Story 的正式 DoD 确认
- Sprint Review 现场演示结果与干系人反馈
- 如课程要求，补充最终 Demo 截图或录屏路径
