---
status: superseded
date: 2026-10-24
superseded_by: 0009
---

# SvelteKit 静态站 + Capacitor Android + 自写闹钟插件

## 上下文

[`intent.md`](../intent.md) 要求双端同一套代码,以及锁屏不漂移、杀进程仍响、重启不丢。Web 栈给不了 `AlarmManager` / `ForegroundService` / `BOOT_COMPLETED`。候选比较见 [2026-10-24 研究](../research/2026-10-24-architecture-candidates.md)。

## 决定

- 前端:**Svelte 5 + SvelteKit static adapter**。主页是常驻角色,状态到表现的纯映射适合细粒度响应式。
- 壳:**Capacitor(仅 Android)+ 自写插件 `zibloo-alarms`**(`AlarmScheduler`、`BootReceiver`、`AlarmReceiver`、`TimerForegroundService`、`ReminderStore`)。到点叫声由原生 MediaPlayer 播放。
- 状态:**Svelte 5 runes 模块化 store**,无全局状态库。
- 持久化:**Dexie / IndexedDB** 存历史与提醒;原生侧 SharedPreferences JSON 镜像闹钟载荷,供开机重建。
- 测试:Vitest + fast-check 测纯函数;Playwright 网页冒烟;当时另有真机验收清单(已随 0009 清理)。
- i18n:自写 typesafe `t()` + zh-CN / en,漏译编译失败。

实施时 Capacitor 为 8.x(候选稿写的 6 已过时),`compileSdk` / `targetSdk` 36。

## 后果

- 网页版不承诺 V1–V3;页面存活期内与 App 共用同一套纯函数。
- 接受自写 Kotlin 插件与一份原生闹钟镜像的维护成本。
- 核心层零框架依赖;若日后换 React,迁移面只在 UI。
- 不变式变更等于变更 V1–V3,须改意图与本决策,不随手改。

2026-10-30:本文的 V1–V3 是当时的可靠性(锁屏计时、杀进程后提醒、重启后提醒还在)。产品验收后来改成意图里的编号,可靠性改成同一页的条目。主页改为看板见 [0005](0005-board-home.md)。提醒产品下线见 [0006](0006-drop-reminders.md)。

2026-11-04:平台范围改为仅网页端,Android / Capacitor 开发暂停;当前决策见 [0009](0009-web-only.md)。本文保留作为历史记录。
