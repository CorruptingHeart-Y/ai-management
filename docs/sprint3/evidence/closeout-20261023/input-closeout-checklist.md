# 杨浩伟 · Sprint 3 集成收口清单

整理：朱传玺（DRI，供杨浩伟收口使用）　日期：2026-10-23　依据：`git fetch --all` 后的远端真实状态

> 目标一句话：把三个 Sprint 增量正式集成到 `integration/sprint3`，全量回归 + E2E 跑通，技术债 6 项逐项登记，打 Release Tag v1.0.0。

---

## 一、现状快照（远端，已核实）

| 分支 | 内容 | 相对 develop（1b6cae2） |
|---|---|---|
| `develop` | US02 已合入 | 基线 `1b6cae2` |
| `feature/us03-permission` | US03 权限（`892d9c4`） | 领先 1 / 落后 0（可直接合） |
| `feature/us11-us12-filter` | US11/12 筛选/逾期（`e4830b7`） | 领先 1 / **落后 3**（基于旧 e57d62f） |
| `feature/release-readiness` | 何健翔 E2E＋发布文档（`beda781`） | 领先 5 / **落后 3**（基于旧 e57d62f） |
| `codex/sprint3-integration-fixes` | 集成候选：US03+US11/12+门禁+技术债（`b24986e`） | 领先 7 / 落后 0，**137/137 测试绿** |
| `main` | 仍是最初提交 `dfd7b81` | 未更新 |

---

## 二、四个缺口（按紧急度）

1. **何健翔的 E2E 测试＋发布文档没进集成候选**（最关键）。
   `feature/release-readiness` 上有 `test/e2e/main-journey.test.js`、`test/e2e/exception-journey.test.js`、`docs/sprint3/release-notes.md`、`user-guide.md`、`release-readiness.md`、`review-log.md`、`improvement-tracking.md`，这些是发布就绪 DoD 的硬材料，但该分支基于**旧 develop（e57d62f）**，落后 3 提交，且 `codex/sprint3-integration-fixes` 里**没有**这些文件。

2. **集成成果挂在 `codex/` 命名分支上**，没落到任务书要求的 `integration/sprint3`。

3. **没有 Release Tag v1.0.0**；`main` 还是初始提交。

4. **技术债 6 项「清偿/降级/带债」决定未登记台账**（`docs/sprint2/technical-debt.md` 目前仍是 7 项「未修复」状态）。

---

## 三、建议收口顺序（附验证）

> 核心矛盾：何健翔的 E2E/文档基于旧基线，而 US03/US11-12 在旧基线之上新增了鉴权与筛选。E2E 主旅程大概率要补「登录」这一环才能跑通，因此先把 release-readiness rebase 到 develop 对齐，再统一集成。

1. **对齐 release-readiness**：`git checkout feature/release-readiness && git rebase develop`（或 `git merge develop`），解决与 US02 前端（`public/session.js` 等）的冲突；确认 `test/e2e/*` 里主旅程是否需要补登录步骤。

2. **合 US03**：`git checkout develop && git merge --no-ff feature/us03-permission`（领先 1 落后 0，冲突风险低）。

3. **合 US11/12**：`git checkout feature/us11-us12-filter && git rebase develop` 后再 `--no-ff` 合入 develop。

4. **合 release-readiness**（rebase 后）进 develop。

5. **落 `integration/sprint3`**：从 develop 拉（或直接沿用 `codex/sprint3-integration-fixes` 作为集成底，把 release-readiness 的 E2E/文档 cherry-pick 或 merge 进来）。**决策点：是沿用 codex 分支继续，还是从 develop 重排一遍**——见第四节。

6. **全量回归＋E2E**：
   - `npm test`（门禁脚本 `verify-sprint3.cjs`，当前 137/137，收口后复跑）
   - `node --test test/e2e/main-journey.test.js test/e2e/exception-journey.test.js`（何健翔 E2E，需在集成后确认能跑）

7. **技术债登记**：用 `scripts/audit-techdebt.cjs` 逐项补「清偿/降级/带债」决定与理由、复验命令、剩余风险，更新 `docs/sprint2/technical-debt.md` 或 `docs/sprint3/` 台账。

8. **打 Tag**：在 `integration/sprint3` 上 `git tag -a v1.0.0` 并 push。

9. **main 更新 + 导出**：决定是否把发布版本合入 main（任务书未强制，交付物是源代码 zip；若合入须在评审通过后由你执行）。

---

## 四、需要你拍板的两个决策点

- **A. 集成底选哪个**：`codex/sprint3-integration-fixes` 已经 137/137 绿且包含全部后端+前端+技术债，只缺何健翔的 E2E/文档。若沿用，成本最低，只需把 release-readiness 的 E2E/文档 rebase 后合进来即可；若从 develop 重排，要重做 US03/US11-12 的合并，风险重复。
- **B. E2E 主旅程要不要补登录**：US02/US03 合入后，核心旅程从「免登录」变成「登录态＋权限」，何健翔的 E2E 主旅程用例需要确认是否仍能直接跑通，还是需要先登录再走旅程。这直接影响「端到端主旅程跑通」这条 DoD 的判据。

---

## 五、验证基线（供复验）

- develop：`1b6cae2`；US02：`6c487fa`；US03：`892d9c4`；US11/12：`e4830b7`；release-readiness：`beda781`；集成候选：`b24986e`。
- 集成候选 `npm test` 结果：**TOTAL 137 / 137 pass / 0 fail**，门禁显式通过（`AUTOMATED_QUALITY_GATE_PASS`），原始 7 个测试文件哈希受保护未改动。
