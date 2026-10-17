# Sprint 1 源代码交付说明

项目：第7组爱管理　课程：软件项目管理实验二蜂鸟
本轮杨浩伟担任DRI，按实验要求兼任PO、SM，负责Sprint范围协调、会议组织、集成与最终验收；彭佳成保留产品与范围专项职责，协助用户故事梳理及验收，其余成员职责不变。

## 正式材料与版本

正式提交目录为deliverables/submission，仅有六份最新版DOCX及第7组_Sprint1源代码.zip；总压缩包为deliverables/第7组_软件项目管理实验二_Sprint1最终提交.zip。六份Word位于外层总提交包内；源码ZIP不包含这些DOCX或deliverables/submission目录。deliverables/final用于维护Word与TXT副本，原实验指导书也在该目录作为只读参考，但不进入正式提交或源码包。此次依原版表3至表8规范化，TXT同步正文，仅供过程维护。

仓库：https://github.com/CorruptingHeart-Y/ai-management
交付分支：codex/sprint1-final-deliverables。main和develop不改变。
服务状态修复提交：05c74994a4d46cf1a6da95c3bc1ddc0c35075509。
ZIP中源文件清单.txt记录本次打包的完整Git提交和各文件SHA256；代码、README、docs及种子数据来自同一已提交版本。ZIP不包含Git历史，分支与提交请在仓库核对。

## 包内容与数据保护

包含server.js、src、public、test、package.json、package-lock.json、.gitignore、.github、README、docs证据与个人交付历史。service-status.js、对应测试及最新测试入口均保留。
种子数据仅包含四名正式成员与空tasks数组，不包含本地未提交的人工Demo数据。不包含node_modules、.git、参考规划、缓存或环境私密文件。六份Word从正式材料目录取得，源码包不重复收录Word。

## 安装与运行

使用Node.js 18或以上，在解压工程根目录依次执行npm ci、npm test、npm start；默认访问http://localhost:3000。Express依赖由package-lock.json锁定，测试使用Node内置node:test。
可通过PORT更换端口，DATA_FILE指定独立演示文件；未设置DATA_FILE时数据写入data/db.json。重复启动不清空已有任务，请勿覆盖团队演示数据。

## 验证与适用范围

原US01 15项、US04 5项、US05 4项，共24项；新增服务状态11项（6个顶层及5个子测试），最终全量35/35，0失败。原24/24及2026年9月22日DRI人工Demo七项继续作为历史证据，最新测试和隔离浏览器记录见docs/evidence。
服务连接状态只说明成员接口的最近一次有效响应，不代表全部业务健康。静态提示Minor已修复，状态枚举重复仍为非阻塞改进项。
本轮实现成员查看、任务创建分配、状态更新与JSON持久化。登录、权限和统计属后续范围；单JSON文件不提供生产级并发及事务保证。人工代码审查已由实际参与成员确认完成：彭佳成合并前审查US01，朱传玺审查US04，何健翔审查US05；杨浩伟集成后检查三个故事的整体代码。三个故事通过本轮Review及DoD，审查基本未发现需要修改的问题。独立历史审查日志未完整归档，属于归档不足，不代表审查未发生；自动测试和Demo仍作为独立证据类型。
