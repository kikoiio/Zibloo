# 文档索引

| 类型 | 状态 | 更新 | 链接 |
|---|---|---|---|
| 意图 | evergreen | 2026-10-30 | [intent.md](intent.md) |
| 架构(当前实现) | evergreen | 2026-10-30 | [architecture.md](architecture.md) |
| 决策 0001 技术栈 | accepted | 2026-10-24 | [0001](decisions/0001-sveltekit-capacitor-kotlin-alarms.md) |
| 决策 0002 角色与品牌 | accepted | 2026-10-22 | [0002](decisions/0002-character-and-brand-b2-c3.md) |
| 决策 0003 2D 姿态帧 | accepted | 2026-10-24 | [0003](decisions/0003-2d-pose-frames.md) |
| 决策 0004 叫声预设 | accepted | 2026-10-24 | [0004](decisions/0004-voice-presets-chirrup-breeze.md) |
| 研究:架构候选 | accepted | 2026-10-24 | [2026-10-24-architecture-candidates](research/2026-10-24-architecture-candidates.md) |
| 真机验收 | evergreen | 2026-10-30 | [runbooks/device-acceptance.md](runbooks/device-acceptance.md) |
| 品牌参考图 | lookup | 2026-10-22 | [reference/brand/](reference/brand/) |

对外产品说明与运行方式见仓库根 [`README.md`](../README.md)。

## 意图对照现状

核对日期:2026-10-30。标签:已实现 / 部分 / 未实现 / 未验证。

| 意图 | 现状 | 证据 |
|---|---|---|
| 小窝主页 + 三模式入口 + 快捷计时 | 已实现(入口为卡片,不是触手 / 气泡) | `src/routes/+page.svelte` |
| 训练模板、参数、运行控制、自定义预设 | 已实现 | `src/routes/training/+page.svelte`、`src/core/timer/` |
| 专注时长 / 短休息 / 长休息循环 | 已实现 | `src/routes/focus/+page.svelte`、`expandSegments` |
| 专注任务标签、连续天数 | 未实现 | 无对应字段 |
| 提醒 once / daily / weekly / interval | 已实现(无编辑表单,可删再建) | `src/core/reminders/`、`src/routes/reminders/+page.svelte` |
| 历史列表 + 今日陪伴 | 部分(无周图表、无类型筛选、无提醒类记录) | `src/core/history/history.ts`、`src/routes/history/+page.svelte` |
| 中英、E/G/静音、备份导入导出 | 已实现 | `src/i18n/`、`src/state/settings.svelte.ts`、`src/core/data/transfer.ts` |
| 震动强度、语音播报 | 未实现 | 设置页无对应控件 |
| Zibloo 五姿态帧映射 | 已实现 | `src/core/zibloo/mapping.ts`、单测 |
| V1–V3 可靠性 | 部分:模拟器 CI 通过;真机未验证 | `.github/workflows/android-emulator.yml`;runbook 结果栏空 |
| 轻养成解锁 | 未实现(`overlay` 恒空) | `mapZibloo` |
| 签名 APK / 发布页 / 图标定稿 | 未实现 | 无 Release,启动图标为 Capacitor 默认 |

开发暂停于首版收口前:真机验收未做。
