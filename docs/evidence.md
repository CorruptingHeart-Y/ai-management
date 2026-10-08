# Sprint 1 证据索引

## 已归档技术证据

| 证据 | 来源与用途 |
|---|---|
| evidence/us01-tests.tap | 2026-09-20实际TAP，24/24，US01 15、US04 5、US05 4 |
| evidence/us01-browser-results.json | 历史AI浏览器8/8，成员、分配、刷新、状态、空态错误、移动布局、文本安全 |
| evidence/us01-members.png | 桌面共享链路截图，包含四人成员、表单、已完成任务 |
| evidence/us01-members-mobile.png | 手机布局共享链路截图 |
| evidence/us01-verification.md | 历史验证方法与运行说明，保留原记录 |
| evidence/sprint1-final-test-20261008.txt | 本次npm test两次实际输出，环境EACCES后允许回环运行24/24 |
| evidence/sprint1-final-smoke-20261008.txt | 本次独立数据启动入口与API链路、重启持久化验证；不计入24测试或七项人工Demo |

US04和US05使用共享完整链路记录与截图作为支撑，未额外保有其独立命名截图，不能因此造一个不存在的路径。

## Git证据

US04：f143bd5、40b9b4e，合并442ee8e。
US05：8f74544、f6cad04、d3fa695，合并79948a5；合并消息记录真实共享文件冲突。
US01：8109119、d44e3c9、b6c136d；集成cc7c937，develop合并34b3df7，状态同步6f96b9d。
最终Demo状态文档更新：184ca75。
本轮采用Feature、integration与develop集成，没有GitHub PR，不补造地址。

## 人工Demo与证据界限

2026-09-22本轮DRI杨浩伟亲自完成最终人工Demo，七项操作检查全部通过，来源为用户在本任务中的确认。动作拆分描述为八步，检查统计仍为七项。没有独立Demo录像或截图归档，历史AI浏览器截图不冒充该日人工证据。

未见独立人工diff Review确认；未留存独立干系人反馈记录；AI记录存在原始会话缺口。技术目标已实现，但不宣称全正式DoD、独立现场会议或完整原始会话得到证明。

## 当前交付与保护

六份正式文档见../deliverables/final/，原始参考规划只在本地使用，不进入版本库。data/db.json包含用户未提交演示数据，本次测试和导出不覆盖、不提交；源代码ZIP使用Git基线的四人成员和空任务种子。

字段覆盖与质量核对见[sprint1-delivery-audit.md](sprint1-delivery-audit.md)，AI静态审查见[code-review.md](code-review.md)。
