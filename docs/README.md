# 文档索引

| 类型 | 状态 | 更新 | 链接 |
|---|---|---|---|
| 意图 | evergreen | 2026-11-03 | [intent.md](intent.md) |
| 架构(当前实现) | evergreen | 2026-11-03 | [architecture.md](architecture.md) |
| 决策 0001 技术栈 | accepted | 2026-10-24 | [0001](decisions/0001-sveltekit-capacitor-kotlin-alarms.md) |
| 决策 0002 角色与品牌 | accepted | 2026-10-22 | [0002](decisions/0002-character-and-brand-b2-c3.md) |
| 决策 0003 2D 姿态帧 | accepted | 2026-10-24 | [0003](decisions/0003-2d-pose-frames.md) |
| 决策 0004 叫声预设 | accepted | 2026-10-24 | [0004](decisions/0004-voice-presets-chirrup-breeze.md) |
| 决策 0005 五列看板 | superseded | 2026-10-30 | [0005](decisions/0005-board-home.md) → [0007](decisions/0007-single-board.md) |
| 决策 0006 看板只留计时与热点 | accepted | 2026-11-01 | [0006](decisions/0006-drop-reminders.md) |
| 决策 0007 一块看板 | superseded | 2026-11-01 | [0007](decisions/0007-single-board.md) → [0008](decisions/0008-source-grouped-board.md) |
| 决策 0008 按来源分组的大看板 | accepted | 2026-11-01 | [0008](decisions/0008-source-grouped-board.md) |
| 研究:架构候选 | accepted | 2026-10-24 | [2026-10-24-architecture-candidates](research/2026-10-24-architecture-candidates.md) |
| 真机验收 | evergreen | 2026-11-03 | [runbooks/device-acceptance.md](runbooks/device-acceptance.md) |
| 品牌参考图 | lookup | 2026-10-22 | [reference/brand/](reference/brand/) |

对外产品说明与运行方式见仓库根 [`README.md`](../README.md)。

## 意图对照现状

核对日期:2026-11-03。标签:已实现 / 部分 / 未实现 / 未验证。

| 意图 | 现状 | 证据 |
|---|---|---|
| 打开即一块看板:热点按来源分块,计时在计时块 | 已实现(静态网页生产构建不能代收非 CORS 来源) | `src/routes/+page.svelte`、`src/state/board.svelte.ts` |
| Trending 的卡片热度、抽屉笔记 | 已实现(无 token 补全、无周榜语言分榜;无侧栏、日报、观察名单、热点设置) | `src/core/trending/`、`src/routes/TrendDrawer.svelte` |
| 看板上多张同时倒计时,章鱼跟最近开始的一张 | 已实现 | `src/state/runs.svelte.ts` |
| 训练模板、参数、运行控制、自定义预设 | 部分:看板上有模板卡片;无独立训练页、无自定义预设表单 | `src/routes/+page.svelte`、`src/core/timer/` |
| 专注时长 / 短休息 / 长休息循环 | 部分:看板上有时长卡片;无独立专注页 | `src/routes/+page.svelte`、`expandSegments` |
| 专注任务标签、连续天数 | 未实现 | 无对应字段 |
| 提醒 / 记事 | 已不做 | [0006](decisions/0006-drop-reminders.md) |
| 历史列表 + 今日陪伴 | 已不做 UI;完成仍写入 Dexie | `src/core/history/history.ts` |
| 中英、E/G/静音、备份导入导出 | 已不做 UI;默认中文与叫声仍生效 | `src/i18n/`、`src/state/settings.svelte.ts` |
| 震动强度、语音播报 | 未实现 | 设置页无对应控件 |
| Zibloo 五姿态帧映射 | 已实现 | `src/core/zibloo/mapping.ts`、单测 |
| 产品验收 V1–V5 | 部分:实现与自动检查已接入 CI;本次工作流结果待回填;真机未验 | `docs/intent.md`;`scripts/smoke.mjs` |
| 可靠性 1–4 | 部分:模拟器 CI 覆盖杀进程计时完成与重启后开看板;本次工作流结果待回填;真机未验 | `.github/workflows/android-emulator.yml`;[`runbooks/device-acceptance.md`](runbooks/device-acceptance.md) |
| 轻养成解锁 | 未实现(`overlay` 恒空) | `mapZibloo` |
| 签名 APK / 发布页 / 图标定稿 | 未实现 | 无 Release,启动图标为 Capacitor 默认 |

真机验收未做。
