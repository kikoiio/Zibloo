---
status: accepted
date: 2026-10-24
---

# 首版技术栈应选哪条路径?

四份并行候选(opus / fable / sonnet / haiku)回答同一问题:在 [`intent.md`](../intent.md) 的可靠性与角色约束下,首版用什么框架、渲染、壳层、持久化与原生闹钟方案。交叉评审后综合进 [0001](../decisions/0001-sveltekit-capacitor-kotlin-alarms.md)。全文曾存于 `docs/arch/a0-candidates/`(至 `b3ee91d`)。

## 共识(四份相同)

Capacitor + 自写薄 Kotlin 插件,拒绝社区通知插件承担 V1–V3;计时是时间戳推导纯函数,永不累加 tick;Zibloo 是纯映射 + 可替换渲染器;提醒以规则表为唯一真源,原生调度全量幂等重排。

## 候选差异

| 候选 | 主张 | 未采用的部分 |
|---|---|---|
| fable | 公开接口最小,不变量进类型;交叉评审 29/30,作基座 | capacitor-sqlite 被 Dexie 替换 |
| sonnet | `syncAlarms({ wholeSet })`、开机重建、原生 MediaPlayer、精确闹钟降级可见 | 事件溯源 store + Zustand + TanStack Query |
| opus | 通知与前台动画共用一份 `ZiblooPresentation`;规则表为真源 | Lottie 主渲染 |
| haiku | 原生层只收绝对时刻;缺素材降级 idle | sql.js 双后端;分层精灵图被 2D 原图姿态帧覆盖 |

## 综合

基座 fable,嫁接 sonnet 的闹钟同步与原生发声、opus 的单一呈现语义与 Dexie、haiku 的接口收窄。渲染在同日改走 2D 姿态帧,见 [0003](../decisions/0003-2d-pose-frames.md)。
