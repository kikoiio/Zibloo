# 文档索引

| 类型 | 状态 | 更新 | 链接 |
|---|---|---|---|
| 意图 | evergreen | 2026-11-05 | [intent.md](intent.md) |
| 架构(当前实现) | evergreen | 2026-11-05 | [architecture.md](architecture.md) |
| 决策 0001 技术栈 | superseded | 2026-11-04 | [0001](decisions/0001-sveltekit-capacitor-kotlin-alarms.md) → [0009](decisions/0009-web-only.md) |
| 决策 0002 角色与品牌 | accepted | 2026-10-22 | [0002](decisions/0002-character-and-brand-b2-c3.md) |
| 决策 0003 2D 姿态帧 | accepted | 2026-10-24 | [0003](decisions/0003-2d-pose-frames.md) |
| 决策 0004 叫声预设 | accepted | 2026-10-24 | [0004](decisions/0004-voice-presets-chirrup-breeze.md) |
| 决策 0005 五列看板 | superseded | 2026-10-30 | [0005](decisions/0005-board-home.md) → [0007](decisions/0007-single-board.md) |
| 决策 0006 看板只留计时与热点 | accepted | 2026-11-01 | [0006](decisions/0006-drop-reminders.md) |
| 决策 0007 一块看板 | superseded | 2026-11-01 | [0007](decisions/0007-single-board.md) → [0008](decisions/0008-source-grouped-board.md) |
| 决策 0008 按来源分组的大看板 | superseded | 2026-11-01 | [0008](decisions/0008-source-grouped-board.md) → [0010](decisions/0010-unified-discovery-feed.md) |
| 决策 0009 仅网页端 | accepted | 2026-11-04 | [0009](decisions/0009-web-only.md) |
| 决策 0010 跨来源发现流 | accepted | 2026-11-05 | [0010](decisions/0010-unified-discovery-feed.md) |
| 研究:架构候选 | accepted | 2026-10-24 | [2026-10-24-architecture-candidates](research/2026-10-24-architecture-candidates.md) |
| 品牌参考图 | lookup | 2026-10-22 | [reference/brand/](reference/brand/) |

对外产品说明与运行方式见仓库根 [`README.md`](../README.md)。

## 意图对照现状

核对日期:2026-11-05。标签:已实现 / 部分 / 未实现 / 未验证。

| 意图 | 现状 | 证据 |
|---|---|---|
| 打开即跨来源发现流:搜索、排序、收藏,计时在紧凑工具条 | 已实现:GitHub Actions 浏览器冒烟和手机宽度无横向溢出均通过;真实来源收取仍受 CORS 限制 | `src/routes/+page.svelte`、`src/state/board.svelte.ts`、[决策 0010](decisions/0010-unified-discovery-feed.md)、[CI 运行](https://github.com/kikoiio/Zibloo/actions/runs/42041916190) |
| Trending 的卡片热度、抽屉笔记 | 已实现(无 token 补全、无周榜语言分榜;无侧栏、日报、观察名单、热点设置) | `src/core/trending/`、`src/routes/TrendDrawer.svelte` |
| 看板单个可调时长计时器 | 已实现:默认 25 分钟,支持开始、暂停、继续和结束 | `src/routes/+page.svelte`、`src/state/runs.svelte.ts` |
| 训练模板、专注循环、多张计时卡片 | 当前看板不提供;底层计时引擎仍保留相关计划类型 | `src/core/timer/` |
| 专注任务标签、连续天数 | 未实现 | 无对应字段 |
| 提醒 / 记事 | 已不做 | [0006](decisions/0006-drop-reminders.md) |
| 历史列表 + 今日陪伴 | 已不做 UI;完成仍写入 Dexie | `src/core/history/history.ts` |
| 中英、E/G/静音、备份导入导出 | 已不做 UI;默认中文与叫声仍生效 | `src/i18n/`、`src/state/settings.svelte.ts` |
| 震动强度、语音播报 | 未实现 | 设置页无对应控件 |
| Zibloo 五姿态帧映射 | 已实现 | `src/core/zibloo/mapping.ts`、单测 |
| 产品验收 V1–V5 | 部分:网页 CI 覆盖类型检查、单元/属性测试、构建和网页冒烟;真实来源收取未验 | [网页 CI](../.github/workflows/ci.yml);`docs/intent.md`;`scripts/smoke.mjs` |
| 计时可靠性 | 页面可见时播放提示音;后台可能被浏览器节流,关页后不会触发 | `src/state/runs.svelte.ts`、`src/state/timer.svelte.ts` |
| 当前平台范围 | 仅网页端;其他平台暂停 | [决策 0009](decisions/0009-web-only.md) |
| 轻养成解锁 | 未实现(`overlay` 恒空) | `mapZibloo` |

网页类型检查、单元测试、构建和冒烟由 [CI 工作流](../.github/workflows/ci.yml) 验证;真实来源收取仍受来源站点的 CORS 策略影响。
