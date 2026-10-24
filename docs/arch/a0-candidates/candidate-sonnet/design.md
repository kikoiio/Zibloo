# Zibloo Timer — A0 架构定稿（candidate-sonnet）

> 候选设计，供 A0 arena 综合。需求基线：`docs/PRD.md` v0.2。本文回答 PRD §9 开放问题 8（A0 技术选型结论），并给出模块地图、用法优先的类型草图与取舍理由。
> 代码标识符用英文；正文用中文。

---

## 0. 结论速览（TL;DR）

| 维度 | 结论 |
|---|---|
| 前端框架 | **React 19 + TypeScript（strict）+ Vite**，渲染层 `src/app` + 领域层 `src/core` 分仓；不引入 SSR/框架路由，自写 40 行的栈式路由 |
| Zibloo 渲染 | **两轨制**：运行时 = 官方 3D 渲染稿导出的 **透明 WebP 姿态图 + CSS transform 编排（SVG 管表情）+ 程序化粒子**；发布包 = 同一张「Zibloo 状态映射表」编译出的 **CSS 关键帧**（由 3D 源一次性预渲染）。**Lottie 只作气泡/文字贴纸，不承载本体** |
| 原生可靠性 | **Capacitor（web + android 两端同仓）**；Android 侧为 **自有薄 Kotlin 插件 `ZiblooNative`**：`ForegroundService` + `AlarmManager.setAlarmClock` + `BOOT_COMPLETED` + 精确闹钟权限申请。**不依赖任何第三方本地通知插件** |
| 状态管理 | **Zustand（UI 草稿与瞬时状态）+ TanStack Query（持久数据读写）+ 领域 Store（事件溯源，单一 owner，sync 由上层编排）**。`core/` 不含任何框架 API |
| 测试 | **Vitest**（`core/` 单测：计时引擎、提醒调度、Zibloo 映射、持久化迁移）+ **fast-check** 属性测试（计时与闹钟的不变式）+ **Playwright**（web 冒烟）+ 安卓真机人工验收清单（V1–V3 拆成可复现步骤，落在 `docs/qa/p1-device-checklist.md`，PRD §4.1 明文规定模拟器不算数） |
| i18n | **自写 `createT()` 强类型消息函数 + typed key union**（不用 `i18next` 的运行时键字符串）；ICU MessageFormat 子集手写，locale 由 `settings.language` 单一来源驱动；`zh-CN` / `en` 两份资源在 **类型层互相兜底**（漏译编译失败） |

可靠性三条（§4.1）用一句话概括本设计的态度：

> **计时是纯函数（时间戳差），提醒是操作系统的（闹钟五元组），App 只是两者的视图与编辑器。**

---

## 1. 技术选型（PRD §4.2 / §9-8）

### 1.1 前端框架

**选 React 19 + TypeScript strict + Vite；拒绝 SSR。**

- 章鱼主页是**状态密集**的（运行中计时 → Zibloo 状态 → 播放哪段音效 → 通知降级），React 的组件模型 + `useSyncExternalStore` 对「订阅 store 的单一状态」最直接。
- **拒绝 Next.js / Remix / TanStack Start**：本项目无服务端、无 SEO 需求、离线优先；SSR 框架会把「路由、数据获取、缓存」三套约定塞进一个纯客户端 App，正是 red flag「Two ways to do one task」。网页版用 `vite build` 出静态资源即可。
- **拒绝 Svelte / Solid / Vue**：能力上都是合格的。选 React 的理由只有两条可辩护的：① 生态里「CSS 编排 + 姿态图 + Canvas 粒子」的现成范例最多，Zibloo 的动画调试会更快；② 用户可见源码即文档（本项目单开发者 + agent 开发，教程与范例密度是真实生产力）。这是一个**接近平手的取舍**，记录在 Tradeoffs。
- **拒绝 Flutter（Dart）与 React Native**：PRD §4.2 要求「同一套代码交付 Web + APK」，Flutter Web 的角色动画/文字/无障碍与网页版交付物质量都低于 DOM 轨道；RN 则需要 Expo Router + 双端手势/动画差异，可靠性层居然还需要自己写原生模块——那还不如 Capacitor 直接把 web 当唯一 UI 层。

### 1.2 Zibloo 渲染与动画方案（本 PRD 的核心不确定点）

PRD §6.2 规定：正式素材须基于**官方 3D 渲染稿**导出透明 PNG/WebP 各状态姿态；原型里的 SVG 只表方向。于是渲染方案的空间被这条约束压缩成四种：

| 方案 | 能力 | 风险 | 结论 |
|---|---|---|---|
| A. 手写 SVG 骨骼动画 | 文件小、可实时改形 | **重画一遍官方 3D 稿**，与 §6.2 直接冲突；渲染稿的渐变/高光/体积感用 SVG 复原不下来 | 废 |
| B. Canvas 2D / WebGL 实时渲染 | 表现力上限最高 | 主线程占用、锁屏恢复后的首帧预算、无障碍与可测试性差；对一个「23 张姿态图」的角色是杀鸡用牛刀 | 废（仅保留程序化粒子用 Canvas） |
| C. Lottie / Rive 运行时 | 动画细腻、可交互 | 需要**动画师重做 3D 的律动**，素材从「23 张图」变成「23 个 .json/.riv」；Rive 需付费导出与自定义 runtime；Lottie 运行时 ~60–100KB 且对 WebP 姿态组合无能为力 | 仅用于气泡/文字贴纸（1–2 个） |
| **D. 3D 渲染稿预渲染姿态图 + CSS transform 编排（推荐）** | 直接用官方稿，零重绘；GPU 合成在多数安卓机免费；**状态机 = 姿态 × 循环 × 表情 × 粒子** 四轴可独立测 | 姿态切换是「离散」的，靠交叉淡入/位移插值掩盖；需要美术按「姿态表」导出（见 §3.5） | **选** |

**具体形态（D 的细化）**

1. **姿态图**：每个 Zibloo 状态 → 1–3 张 1024×1024 透明 WebP（`body-{idle,cheer,rest,quiet,summon,celebrate}-{a,b}.webp`），总预算 ≤ 1.5MB（3 档分辨率，`<img srcset>` 按 devicePixelRatio 选）。
2. **律动**：对 `<img>` 施加 `translateY / rotate / scale` 的 CSS 关键帧（漂浮=±6px/3s、加油=scale 1→1.06 快节奏、放松=缓 breathe）。**所有关键帧由 `ZiblooMotionPreset` 常量表描述，由 3D 源预渲染成同名 CSS `@keyframes`**，这样网页版与 APK 完全一致，不依赖运行时动画库。
3. **表情**：眼睛/腮红/气泡是**叠加层**，用少量内联 SVG（3 个 path 字符集：眨眼 ∪、开心 ^ ^、专注 —），由状态映射输出 `expressionId` 决定。这正是 §6.2 允许的「SVG 表方向」的最小用法，不必重画本体。
4. **粒子（气泡/泡泡）**：Canvas 2D，`requestAnimationFrame` 单个实例，≤ 40 个粒子的池化渲染。仅在 `visibilityState === 'visible'` 且非 `prefers-reduced-motion` 时运行。
5. **降级**：`prefers-reduced-motion` → 冻结在姿态图静态帧；后台/锁屏 → 由原生通知承载文案与图标，**不做动画**（§2.2 明文要求）。

> 为什么这条方案值得写死在架构里：Zibloo 的「表现一致」是 §2.2 的要求，因此**表现必须是数据**（`ZiblooPresentation`），而渲染器只是把这份数据翻译成 DOM/CSS/Canvas 的终端。三个渲染终端（web DOM、web reduced-motion 静态、Android 通知）共用同一张映射表——这是单一真相。

### 1.3 Capacitor vs 备选（可靠性路径）

PRD §4.1 的三条硬要求是**操作系统级**的能力：

- 锁屏/后台计时不漂移 → **方案：计时不算 tick，永远由 `endedAt - now` 推导**（纯函数，任何进程状态都正确）。
- 杀 App 后提醒仍触发 → **必须**是 `AlarmManager` 级调度（系统持有 pending intent）。
- 重启后规则不丢 → **必须**有 `BOOT_COMPLETED` receiver 重新注册，且规则本身持久化。

逐项评估：

| 备选 | 取舍 |
|---|---|
| **Capacitor**（推荐） | web 代码直接是 UI 层；原生层只写一个 Kotlin 插件（~300 行），完全掌控 `AlarmManager` / `ForegroundService` / 权限；以后上架 Google Play 只需 Gradle target API/bundle 调整；iOS 预留在 `native/` 下加一个 Swift 插件即可。**唯一真实风险**：插件与 WebView 之间的状态同步（见 §3.4 的「镜像非真相」原则）。 |
| Tauri 2 (Android) | Rust + WKWebView/WebView2；Android 侧要写 Kotlin/JNI 桥，动画层与 Capacitor 等价，但**工具链（NDK、Rust 交叉编译、CI 体积）更重**，对单开发者 + agent 的迭代速度不利。 |
| Flutter + 原生 alarm 插件 | 一次性重写 UI 语言，网页版交付质量下降（见 1.1），且需要维护两套渲染管线（Flutter 渲染 + 3D 素材导出流程）。 |
| PWA + Web Push / Notification Triggers | **链路不可控**：Android Chrome 的 notification triggers 需站点工程 PWA，但「杀 App 后到点触发」依赖浏览器进程与系统保活；iOS 不支持；用户把网页「添加到主屏」也拿不到 `AlarmManager` 精度。**不满足 V2/V3 的验收可信度**。 |
| 原生 Kotlin (Jetpack Compose) + 独立 web 版 | 双份 UI 代码，直接违反 §4.2「同一套代码」。 |

**结论：Capacitor，且把「原生可靠性层」设计成一个有明确契约的薄适配器**（`core/native/alarms.ts` + Kotlin 插件），而不是把可靠性逻辑散在 React 组件里。

### 1.4 状态管理

**三层分离，按「是否持久、是否跨进程、是否有多个写者」决定归属：**

| 层 | 技术 | 承载什么 |
|---|---|---|
| 领域层（无框架） | 纯 TS 模块 + 一个事件溯源 Store（§3.3） | 会话（session）、提醒规则、历史事件、Zibloo 映射、解锁进度 |
| UI 草稿/瞬时状态 | Zustand（每个屏幕一个 store） | 参数编辑器（训练 30/15×8）、模态框开关、当前 tab |
| 持久查询 | TanStack Query（key = `['history', filter]` 等） | 历史列表/图表/统计的读取与失效 |

- **为什么不是 Redux Toolkit**：没有跨域中间件需求，reducer 板式代码对「事件 + 纯函数推导」的计时模型是噪音。
- **为什么不是 Jotai/Valtio**：Zibloo 状态由「当前会话」单一派生，粒度过细的 atom 会让「哪个 atom 是真相」变模糊，正好踩中 red flag「Split ownership」。
- **为什么 Query 只做读**：写一律走「dispatch 事件 → 触发 async save → persist 层原子写 → 事件通知 → Query invalidate」，**读路径唯一**，避免「组件自己写 JSON」。

### 1.5 i18n

- **不使用 i18next**：它在运行时用字符串 key 查表，漏 key 是运行期问题；本项目要求 V9「全部文案双语、无硬编码」，用**编译期类型**兜底更便宜。
- 结构：`src/i18n/messages/zh-CN.ts` 与 `en.ts` 导出同形状对象，`t` 的类型由 `zh-CN` 派生，`en.ts` 声明 `satisfies Messages` —— **漏译 = TypeScript 编译失败**。
- 插值用 ICU 子集 `{count, plural, =1{...} other{...}}`，自写 ~60 行 formatter（无依赖）。
- Zibloo 状态文案（如「Zibloo 正在陪你专注」）与通知文案**共用同一批 key**，并额外提供 `titleKey`/`bodyKey` 供 Android 侧取串（见 §3.4，插件只接收已翻译的字符串）。

### 1.6 测试

- **Vitest**：`core/` 全部为纯函数，node 环境直跑；使用 `vi.setSystemTime` + 注入 `Clock` 做确定性时间测试。
- **fast-check**：对 `TimerEngine`（任意事件序列下 `remainingAt` 单调、`plan` 结束不越界）、`ReminderSchedule`（任意规则 × 任意 now 的 `computeOccurrences` 与 `advance` 一致）做属性测试。
- **Playwright**：web 版 3 条冒烟（主页入口 → 跑一次 Tabata → 历史出现记录）。
- **Android 真机**：无法自动化（§4.1 明文），用**可勾验清单** `docs/qa/p1-device-checklist.md` 把 V1–V3 拆成 14 个可复现步骤（拔电重启、飞行模式、省电模式、MIUI 后台限制等）。

---

## 2. 模块地图

```
Timer/
├─ src/
│  ├─ core/                      ← 领域层：无 React / 无 DOM / 无 Capacitor 引用
│  │  ├─ time/                   Clock、epoch 工具、Duration（ms 整数）
│  │  ├─ timer/                  TimerPlan、TimerEngine、TimerSession、reducer（事件溯源）
│  │  ├─ reminders/              ReminderRule、computeOccurrences、ReminderScheduler 接口
│  │  ├─ zibloo/                 ZiblooState、ZiblooPresentation、mapZibloo(...)、ZiblooMotionPreset
│  │  ├─ unlock/                 UnlockSignal、UnlockCatalog、evaluateUnlocks(...)（P2）
│  │  ├─ history/                HistoryEvent、HistoryRepository 接口、stats 纯函数
│  │  └─ ports.ts                AlarmPort / TimerServicePort / NotifierPort / AudioPort / StoragePort
│  ├─ adapters/                  ← 端口的具体实现（web / native 两套）
│  │  ├─ web/                    BroadcastChannel 会话、Web Notifications、IndexedDB、WebAudio
│  │  └─ native/                 Capacitor ZiblooNative 插件封装、WebView 音频
│  ├─ state/                     ← 应用服务层：唯一写入口
│  │  ├─ appStore.ts             事件 + selector + dispatch
│  │  ├─ persist.ts              localStorage / IndexedDB / NativePreferences（按平台）
│  │  ├─ sync.ts                 dispatch → persist → nativePort.syncReminders → notify
│  │  └─ queries.ts              TanStack Query hooks（只读）
│  ├─ app/                       ← 视图层（每个屏幕一个目录，含 Zustand 草稿 store）
│  │  ├─ shell/                  TabBar、StackRouter、SafeArea
│  │  ├─ home/                   章鱼主页：ZiblooStage、TentacleEntry×3、QuickTimerBubbles
│  │  ├─ run/                    运行页：RunTimerScreen（三模式共用，按 kind 渲染插槽）
│  │  ├─ train/ focus/ notes/    三模式的**参数编辑器**（不是运行页）
│  │  ├─ history/ chart/ settings/
│  │  └─ zibloo/                ZiblooStage（DOM/CSS 渲染器）、BubbleParticles、ExpressionLayer
│  ├─ i18n/                      messages/zh-CN.ts、en.ts、t.ts、format.ts
│  └─ main.tsx
├─ native/android/               Capacitor Android 工程（Kotlin）
│  └─ app/src/main/java/.../zibloo/
│     ├─ ZiblooNativePlugin.kt      Capacitor 插件入口（仅 8 个方法）
│     ├─ TimerForegroundService.kt  前台服务 + 常驻通知（计时运行中）
│     ├─ AlarmScheduler.kt          AlarmManager.setAlarmClock / setExactAndAllowWhileIdle
│     ├─ AlarmReceiver.kt           闹钟到点 → 发通知 + 唤醒 WebView（若存活）
│     ├─ BootReceiver.kt            BOOT_COMPLETED / MY_PACKAGE_REPLACED → 重建全部闹钟
│     └─ ReminderStore.kt           SharedPreferences JSON（规则镜像，写完即 fsync）
├─ tools/
│  └─ render-mascot.ts            3D 姿态 → WebP + CSS keyframes 的构建期脚本（美术交付校验）
└─ docs/…
```

**模块边界与不变式**

| 模块 | 拥有什么 | 明确不做 |
|---|---|---|
| `core/time` | `Clock`（可注入）、ms 整数、monotonic 与 epoch 的区分 | 不含 `Date.now()` 字面调用 |
| `core/timer` | 计划与运行的**全部状态转移**，时间戳推导 | 不知道 UI、不知道通知、不自己存盘 |
| `core/reminders` | 规则的**下次应触发时刻** `nextTriggerAt(rule, after, tz)` | 不调用 `AlarmManager`，只产出「期望的闹钟集合」 |
| `core/zibloo` | 状态映射（§2.2 表的唯一实现）与表现数据 | 不 import React/CSS/图片 |
| `state/sync` | **唯一**编排点：把领域事件写成持久化、把提醒写成原生闹钟 | 不含业务规则 |
| `adapters/native` | Capacitor 通道 + 重试 + 幂等 | 不含「提醒应该几点响」的判断 |
| `native/android` | 调度、唤醒、通知呈现、权限 | 不计算规则（只持有规则镜像并调用 `nextTriggerAt` 的结果） |

> **关键约束（防漏）**：`core/**` 不允许 import `react`、`capacitor`、`zustand`；由 ESLint `no-restricted-imports` 在 CI 里强制。`adapters/**` 不允许被 `app/**` 直接调用——只允许 `state/**` 调；同样 lint 强制。原因为这两条边界最容易在「先让它跑起来」的实现中被绕过（见 red flag「Importable internals」）。

---

## 3. 用法优先（caller's view）

> 先把三个真实调用点写出来，类型由它们推导出来，而不是相反。

### 3.1 调用点一：主页点「训练 → Tabata」，跑完一组，Zibloo 跟着换姿态

```tsx
// src/app/train/TrainSetup.tsx —— 参数编辑器只是「草稿」，然后 dispatch 一个 start
const draft = useTrainDraft();                        // Zustand：{ work:20, rest:10, rounds:8, cue:'voice' }
const { start } = useAppActions();

function onPressStart() {
  start({
    kind: 'train',
    plan: trainPlanFromDraft(draft),                  // core/timer：纯函数 → TimerPlan
    cue: draft.cue,                                   // 'voice' | 'chime' | 'off'
    label: null,
  });
  router.push('/run');                                // 运行页不接收参数：它只读 currentSession
}
```

```tsx
// src/app/run/RunTimerScreen.tsx —— 三模式共用；不 setInterval 累计秒数
export function RunTimerScreen() {
  const session = useAppStore(s => s.running);        // TimerSession | null
  const now = useNow(200);                            // 200ms 对齐刷新：仍由时间戳推导，见 README
  if (!session) return null;

  const snap = snapshotOf(session, now);              // core/timer：纯函数
  const zibloo = mapZibloo({
    activity: { kind: 'timer', session, snapshot: snap },
    unlock: useUnlockedDecorations(),                 // P2：只影响装饰，不影响状态
    locale: useLocale(),
    reducedMotion: usePrefersReducedMotion(),
  });                                                 // → ZiblooPresentation

  return (
    <>
      <ZiblooStage presentation={zibloo} variant="run" />
      <RingProgress percent={snap.progress} />
      <SegmentHeader text={t(`run.train.${snap.segmentKind === 'work' ? 'work' : 'rest'}`, {
        round: snap.round, rounds: snap.totalRounds,
      })}/>
      <Controls onSkip={skipSegment} onPause={pause} onEnd={end} />
    </>
  );
}
```

```ts
// src/app/run/useSessionCues.ts —— 叫声/语音由「本帧 vs 上一帧」的段 id 变化驱动
// 语义映射在 core/zibloo 的 motion preset 里，宿主只播放
const cueFor: Record<SegmentBoundary, CueKind> = {
  workStart: { tone: 'zibloo', variant: 'rise2' },   // 两声上扬
  restStart: { tone: 'zibloo', variant: 'fall2' },   // 两声下沉
  finished:  { tone: 'zibloo', variant: 'cheer3' },  // 欢快三连
};
```

要点：
- **运行页不接收会话参数**。它只读 `running`，因此「杀掉 App 再打开」「从后台返回」「从通知点进来」全走同一条渲染路径（red flag：「Two ways to do one task」）。
- **`useNow` 只是刷新节拍，不持有时间**。倒计时正确性只由 `session` 与 `now` 决定。

### 3.2 调用点二：创建一条「每天 08:30 吃药」的提醒（跨杀 App、跨重启）

```tsx
// src/app/notes/ReminderEditor.tsx
const { saveReminder } = useAppActions();

async function onSave(form: ReminderForm) {
  const now = clock.now();                                          // Clock 可注入
  const draft: ReminderDraft = {
    id: form.id ?? newReminderId(now),
    name: form.name,                                                // '吃药'
    enabled: true,
    rule: { kind: 'daily', timeOfDay: { hour: 8, minute: 30 }, timeZone: activeTimeZone() },
    presentation: { sound: 'zibloo', vibrate: 'standard', speakText: true },
  };
  await saveReminder(draft);                                        // 无返回值：失败通过 AppError 抛出
  router.back();
}
```

`saveReminder` 内部（`state/sync.ts`，`action` 的完整语义）：

```ts
async function saveReminder(draft: ReminderDraft): Promise<void> {
  const rule = validateReminderDraft(draft);          // 边界校验一次，之后内部信任类型
  const next = planAlarms([...rulesExcept(draft.id), rule]);  // core/reminders：{ alarms, unschedulable }
  await persist.reminders.put(rule);                  // ① 先落盘规则（真相）
  await nativePort.syncAlarms({ wholeSet: next.alarms });// ② 再镜像到系统（幂等：全量替换）
  invalidate(['reminders']);
}
```

- **② 是「全量替换」而不是「增量增删」**：闹钟集合是系统侧的**镜像**，每次同步用 `alarmsCancelAll + schedule(set)` 表达；重复执行、半途崩溃、重启后重建都收敛到同一状态（幂等）。代价是可感知的毫秒级重排，换来「永远不会出现幽灵闹钟」。
- **`unschedulable` 非空**（如 Android 精确闹钟权限被拒）时，`syncAlarms` 返回 `{ degraded: true, reason }`，UI 在提醒列表顶部显示警告条并提供跳转系统设置的按钮。**这是唯一允许把「不可调度的规则」留在盘上的情况**，并且它必须是可见的。

### 3.3 调用点三：杀 App / 重启后恢复

```ts
// main.tsx 引导顺序（一次，不分支）
async function bootstrap(): Promise<void> {
  const boot = await bootApp({                          // core/boot
    storage: pickStorage(),                             // IndexedDB(web) | Preferences(native)
    version: APP_DATA_VERSION,                          // 迁移器按版本链式升级
  });
  appStore.hydrate(boot);                               // 规则、未完成会话、历史窗口、设置
  await reconcile(boot);                                // 见下
  await nativePort.ensurePermissions();                 // 通知/精确闹钟/电池优化白名单
  await nativePort.syncAlarms({ wholeSet: planAlarms(boot.reminders).alarms });
}
```

`reconcile(boot)` 的语义（**不依赖任何「App 是否被杀」的知识**）：

```ts
export type ReconcileOutcome =
  | { kind: 'none' }
  | { kind: 'timerFinishedWhileAway'; session: TimerSession; finishedAt: EpochMs }
  | { kind: 'timerStillRunning'; session: TimerSession };              // 时间戳说还没到 → 继续跑

export function reconcile(boot: BootSnapshot, now: EpochMs): ReconcileOutcome {
  const s = boot.running;
  if (!s) return { kind: 'none' };
  const snap = snapshotOf(s, now);
  return snap.ended
    ? { kind: 'timerFinishedWhileAway', session: s, finishedAt: snap.endedAt! }
    : { kind: 'timerStillRunning', session: s };
}
```

- `timerFinishedWhileAway` → 写入历史事件（`completion: 'completed'`，`startedAt/endedAt` 来自时间戳），再 dispatch `{ t: 'session/event', event: { t: 'end', at: snap.endedAt, reason: 'completed' } }`，由 reducer 迁移到 `celebration` 活动 → Zibloo 进入 `celebrating`，播放一次欢快三连。
- 重启后 `nativePort` 侧的闹钟由 `BootReceiver` 重建；Web 侧 `reconcile` 是**冗余但幂等**的第二道保险（即使在 Android 上 BootReceiver 首次加载失败，用户下次打开 App 也会修复）。

### 3.4 调用点四（P2）：解锁判定

```ts
const signals = unlockSignals(stats, streak);           // core/unlock：纯函数
const { unlocked, showcase } = evaluateUnlocks(UNLOCK_CATALOG, signals);
// 断用后：unlocked 不变（已解锁保留），showcase 由「当前 streak」派生 → 回落
```

---

## 4. Shape（类型草图）

约定：所有时间点是 **epoch 毫秒整数**（`type EpochMs = number & { readonly __brand: 'EpochMs' }`），时区只在「规则 → 下一次触发时刻」这一步进入（`core/reminders`）。

### 4.1 时钟与端口（先立边界）

```ts
export interface Clock {
  /** epoch ms。测试可注入固定值。 */
  now(): EpochMs;
  /** 单调时钟，仅用于测量经过时间（避免系统时间被改导致的漂移判断）。 */
  monotonicMs(): number;
}

/** 计时引擎只需要 now；其余端口由状态层使用。 */
export interface AlarmPort {
  /** 幂等：全量替换系统闹钟集合。失败返回 degraded，而不是 reject。 */
  syncAlarms(input: { wholeSet: readonly PlannedAlarm[] }): Promise<AlarmSyncResult>;
  getPermission(): Promise<'granted' | 'denied' | 'unsupported'>;
  requestPermission(): Promise<'granted' | 'denied'>;
  /** 用户点通知时带回的 reminderId（原生 → Web 的方向用事件，不用轮询）。 */
  onAlarmFired(listener: (e: { reminderId: ReminderId; firedAt: EpochMs }) => void): Unsubscribe;
}

export interface TimerServicePort {
  /** 让系统在计时期间保持本 App 存活（Android: 前台服务 + 常驻通知；Web: no-op）。 */
  start(input: { sessionId: SessionId; startedAt: EpochMs; endsAt: EpochMs; title: string; body: string }): Promise<void>;
  update(input: { endsAt: EpochMs; title: string; body: string }): Promise<void>;
  stop(input: { sessionId: SessionId }): Promise<void>;
}

export interface NotifierPort {
  show(input: { id: NotificationId; title: string; body: string; channel: ChannelId }): Promise<void>;
  cancel(id: NotificationId): Promise<void>;
}

export interface AudioPort {
  /** 只有三个语义，映射到叫声变体；宿主不知道"两声上扬"是什么。 */
  playCue(cue: ZiblooCue): Promise<void>;
  speak(text: string, locale: Locale): Promise<void>;
  stop(): Promise<void>;
}

export interface StoragePort {
  /* 仅 KV 语义，具体后端由 adapters 决定 */
  get<T>(key: StorageKey): Promise<T | undefined>;
  put<T>(key: StorageKey, value: T): Promise<void>;        // 原子写（Native: commit + fsync）
  delete(key: StorageKey): Promise<void>;
  transaction(run: (tx: StorageTx) => Promise<void>): Promise<void>;
}
```

- **`AlarmPort.syncAlarms` 是全量集合**，这是本设计有意为之的接口深度：调用者不需要知道「增删改」的差异，也不需要维护本地闹钟 id 与系统 id 的映射（原生侧自己按 `reminderId` 生成 request code，规则为 `reminderId.hash % 2^31`）。
- **`NotifierPort`/`TimerServicePort` 都接收已翻译字符串**（`title/body`），i18n 的边界在调用方；原生层不感知语言。

### 4.2 计时引擎（核心：时间戳推导，永不累计 tick）

```ts
// core/timer/types.ts
export type SessionId = string & { readonly __brand: 'SessionId' };
export type SegmentId = string & { readonly __brand: 'SegmentId' };
export type TimerKind = 'train' | 'focus';

export interface TrainPlan {
  readonly kind: 'train';
  readonly work: Duration;          // ms
  readonly rest: Duration;          // ms
  readonly rounds: number;
  readonly prepare: Duration;       // 可选倒计时准备段；0 表示无
}

export interface FocusPlan {
  readonly kind: 'focus';
  readonly focus: Duration;
  readonly shortBreak: Duration;
  readonly longBreak: Duration;
  readonly pomodorosUntilLongBreak: number;
  readonly autoStart?: 'disabled' | 'nextSegment';
}

export type TimerPlan = TrainPlan | FocusPlan | QuickPlan;   // QuickPlan = 单一 work 段

/** 计划的派生（纯）：给出有序段列表。段时长是事实，不随时间变化。 */
export type Segment = {
  readonly id: SegmentId;
  readonly kind: 'prepare' | 'work' | 'rest' | 'longRest';
  readonly duration: Duration;
  readonly round: number;           // 1-based；prepare 段为 0
  readonly totalRounds: number;
};

export function segmentsOf(plan: TimerPlan): readonly Segment[]; // not implemented
// 训练：prepare? + (work,rest)×rounds 去掉末尾 rest
// 专注：focus, (shortBreak, focus)×n, longBreak, ...

/** 运行中会话：唯一可变的部分是「事件序列」，其余全部由它 + now 推导。 */
export interface TimerSession {
  readonly id: SessionId;
  readonly plan: TimerPlan;
  readonly startedAt: EpochMs;
  readonly events: readonly TimerEvent[];   // 追加式；见下
  readonly label?: FocusLabel | null;
}

export type TimerEvent =
  | { t: 'start';  at: EpochMs }
  | { t: 'pause';  at: EpochMs }
  | { t: 'resume'; at: EpochMs }
  | { t: 'skip';   at: EpochMs; fromSegmentId: SegmentId }
  | { t: 'end';    at: EpochMs; reason: 'user' | 'completed' | 'discarded' };

/** 快照：给定会话与当前时刻，得出渲染所需的一切。纯函数。 */
export interface TimerSnapshot {
  readonly sessionId: SessionId;
  readonly phase: 'running' | 'paused' | 'ended';
  readonly segment: Segment;
  readonly segmentIndex: number;
  readonly segmentStartedAt: EpochMs;
  readonly segmentEndsAt: EpochMs;
  readonly remainingMs: Duration;         // max(0, endsAt - now)
  readonly elapsedMs: Duration;
  readonly progress: number;              // 0..1 本段内
  readonly round: number;
  readonly totalRounds: number;
  readonly next: { segmentKind: Segment['kind']; duration: Duration } | null;
  readonly ended: boolean;
  readonly endedAt: EpochMs | null;
  /** 自上次 snapshot 以来跨越的段边界（用于叫声），snapshot 本身不带，见 diffSnapshots。 */
}

export function snapshotOf(session: TimerSession, now: EpochMs): TimerSnapshot; // not implemented
// 要点（不变量）：
// I1. 暂停时 remainingMs = pausedAt 冻结的 remaining（同样由事件推导，不看 tick）
// I2. 多段跨越：一次 snapshotOf 必须能跨过多个段（后台 20 分钟后返回）；
//     实现是对 segmentsOf(plan) 做前缀和 + 事件偏移的二分查找，O(log n)
// I3. 时间戳回拨（用户改系统时间）：用 monotonic 修正量做保护，见 open question

export type SegmentBoundary = 'workStart' | 'restStart' | 'finished';
export interface SnapshotDiff { readonly boundaries: readonly SegmentBoundary[]; }

/** 纯函数：两次快照之间发生了什么。宿主用它决定播哪个叫声。 */
export function diffSnapshots(prev: TimerSnapshot | null, next: TimerSnapshot): SnapshotDiff; // not implemented
```

**为什么是事件序列而不是 `remainingMs` 可变字段**：暂停/继续/跳过会互相叠加，若用可变字段，每个平台适配器都要正确保存它；事件序列是**可幂等重放的日志**，崩溃后重启从日志重建，不依赖任何时钟在内存里活着。这是 red flag「Split ownership」在数据层的解答。

### 4.3 提醒规则与调度

```ts
// core/reminders/types.ts
export type ReminderId = string & { readonly __brand: 'ReminderId' };
export type TimeZoneId = string;                         // IANA，如 'Asia/Shanghai'

export type ReminderRule =
  | { kind: 'once';    at: EpochMs }
  | { kind: 'daily';   timeOfDay: { hour: number; minute: number }; timeZone: TimeZoneId }
  | { kind: 'weekly';  weekdays: readonly Weekday[]; timeOfDay: { hour: number; minute: number }; timeZone: TimeZoneId }
  | { kind: 'interval'; everyMs: Duration; window?: { fromHour: number; toHour: number }; timeZone: TimeZoneId };

export interface Reminder {
  readonly id: ReminderId;
  readonly name: string;                  // 用户自定义名称（§9-6：P1 支持短文本）
  readonly enabled: boolean;
  readonly rule: ReminderRule;
  readonly presentation: { sound: 'zibloo' | 'chime' | 'silent'; vibrate: VibrateLevel; speakText: boolean };
  readonly createdAt: EpochMs;
}

/** 规则的「到期时刻」序列。纯函数，时区/夏令时在内部处理，调用方无需知道。 */
export function nextTriggerAt(rule: ReminderRule, after: EpochMs): EpochMs | null;   // not implemented
export function occurrencesBetween(rule: ReminderRule, from: EpochMs, to: EpochMs): readonly EpochMs[]; // not implemented

/** 所有规则 → 系统闹钟集合（一条规则可产生多条，例如为精确性展开未来 7 天）。 */
export interface PlannedAlarm {
  readonly reminderId: ReminderId;
  readonly triggerAt: EpochMs;
  readonly title: string;                 // 已翻译
  readonly body: string;                  // 已翻译
  readonly presentation: Reminder['presentation'];
}

export function planAlarms(reminders: readonly Reminder[], now: EpochMs, locale: Locale): PlanAlarmsResult;
// not implemented
// 返回 { alarms: readonly PlannedAlarm[]; unschedulable: readonly { id: ReminderId; reason: 'missingPermission' | 'pastOnce' }[] }
// 不变量：
// A1. planAlarms 结果确定（纯），同一输入多次调用一致 → 可做幂等 sync
// A2. once 规则在过去 → unschedulable(pastOnce)，永不静默丢弃
// A3. interval 规则在 window 内展开，最多 LOOKAHEAD_LIMIT 条，避免闹钟数量爆炸
```

### 4.4 Zibloo 状态映射（§2.2 的唯一实现）

```ts
// core/zibloo/types.ts
export type ZiblooState = 'idle' | 'training' | 'focusing' | 'summoning' | 'celebrating';
export type ZiblooMood = 'content' | 'cheer' | 'calm' | 'alert' | 'joyful';
export type ZiblooExpressionId = 'blinkRight' | 'sparkleLeft' | 'happy' | 'focused' | 'oWide';
export type ZiblooMotionPreset =
  | { id: 'float';     periodMs: Duration }
  | { id: 'cheerPump'; periodMs: Duration }
  | { id: 'breathe';   periodMs: Duration }
  | { id: 'summonPop'; durationMs: Duration }
  | { id: 'celebrateSpin'; durationMs: Duration };

export type ZiblooCue =
  | { tone: 'zibloo' | 'chime'; variant: 'rise2' | 'fall2' | 'cheer3' | 'single' }
  | { tone: 'none' };

export interface ZiblooPresentation {
  readonly state: ZiblooState;
  readonly bodyAssetId: ZiblooBodyAssetId;      // 'idle-a' | 'cheer-b' | ...
  readonly expression: ZiblooExpressionId;
  readonly motion: ZiblooMotionPreset;
  readonly decoration: readonly ZiblooDecorationId[];   // P2 解锁装饰，按展示顺序
  readonly cue: ZiblooCue;                              // 同状态下语义固定
  readonly particles: 'bubbles' | 'none';
  readonly a11yLabelKey: ZiblooMessageKey;              // i18n key，不拼字符串
  readonly notification: { titleKey: ZiblooMessageKey; bodyKey: ZiblooMessageKey } | null;
  // 后台/锁屏：渲染器读它，不推导（降级规则在映射层，不在渲染层）
}

export type ActivityInput =
  | { kind: 'none' }
  | { kind: 'timer'; session: TimerSession; snapshot: TimerSnapshot }
  | { kind: 'reminderFired'; reminder: Reminder; firedAt: EpochMs }
  | { kind: 'celebration'; finishedAt: EpochMs; sessionKind: TimerKind };

export interface MapZiblooInput {
  readonly activity: ActivityInput;
  readonly unlock: readonly ZiblooDecorationId[];   // P2；P1 恒为 []
  readonly locale: Locale;
  readonly reducedMotion: boolean;
}

/** §2.2 表格的唯一实现。纯函数；无 IO、无时间调用（时间从 snapshot/activity 传入）。 */
export function mapZibloo(input: MapZiblooInput): ZiblooPresentation; // not implemented
// 映射规则（逐行对应 PRD 2.2）：
//   activity none                       → 'idle'        float/blinkRight/bubbles
//   timer(train) running                → 'training'    work→cheerPump+rise2 ; rest→breathe+fall2
//   timer(focus) running                → 'focusing'    breathe, expression 'focused'
//   timer(*) ended                      → 'celebrating' celebrateSpin + cheer3（由 celebrate 事件触发）
//   reminderFired                       → 'summoning'   summonPop + single + notification
// 不变量：
// Z1. 同输入必同输出（unit test 直接对表）
// Z2. reducedMotion → motion 冻结为 { id:'none' } 的等价物（在 preset 里不携带时间维度）
// Z3. notification 字段与 state 一一对应（同一张表），用于 Android 通知文案
```

### 4.5 持久化与解锁（P2）

```ts
// core/persist/types.ts
export const APP_DATA_VERSION = 3;

export interface BootSnapshot {
  readonly running: TimerSession | null;
  readonly reminders: readonly Reminder[];
  readonly history: readonly HistoryEvent[];      // 启动时只读最近 N 天，其余按需分页
  readonly settings: Settings;
  readonly unlock: UnlockState;
}

export function bootApp(input: { storage: StoragePort; version: number; clock: Clock }): Promise<BootSnapshot>; // not implemented
// 迁移：v1→v2→v3 链式 pure 函数；失败时备份到 `__backup__` 并以默认值启动，同时上报 AppError

// core/unlock/types.ts (P2)
export interface UnlockSignal {
  readonly totalSessions: number;
  readonly bestStreakDays: number;
  readonly currentStreakDays: number;
  readonly distinctFocusLabels: number;
}

export interface UnlockCatalog {
  readonly items: readonly {
    readonly id: ZiblooDecorationId;
    readonly requires: (s: UnlockSignal) => boolean;   // 纯谓词，可单测
  }[];
}

export function evaluateUnlocks(c: UnlockCatalog, s: UnlockSignal): {
  readonly unlocked: readonly ZiblooDecorationId[];      // 单调增长，持久化
  readonly showcase: readonly ZiblooDecorationId[];      // 由 currentStreak 派生，可回落
}; // not implemented
```

### 4.6 事件、动作与同步（唯一写入口）

```ts
// state/appStore.ts
export type AppEvent =
  | { t: 'session/started'; session: TimerSession }
  | { t: 'session/event'; sessionId: SessionId; event: TimerEvent }
  | { t: 'session/finished'; sessionId: SessionId; at: EpochMs; completion: Completion }
  | { t: 'reminder/saved'; reminder: Reminder }
  | { t: 'reminder/deleted'; id: ReminderId }
  | { t: 'settings/updated'; patch: Partial<Settings> }
  | { t: 'unlock/evaluated'; unlocked: readonly ZiblooDecorationId[] }
  | { t: 'boot/hydrated'; snapshot: BootSnapshot };

/** 动作：把「用户意图」翻译为事件 + 副作用，副作用只在 sync.ts 里串起来。 */
export interface AppActions {
  start(input: { kind: TimerKind; plan: TimerPlan; cue: CuePreference; label: FocusLabel | null }): void;
  pause(): void;
  resume(): void;
  skip(): void;
  end(): void;
  saveReminder(draft: ReminderDraft): Promise<void>;
  deleteReminder(id: ReminderId): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
}
```

**数据流（一句话）**：`用户意图 → actions → 事件 → appStore.reduce（纯） → 1 个 selector 派生出 ZiblooPresentation 与 TimerSnapshot → 渲染器`，而持久化/闹钟同步是 `sync.ts` 订阅同一事件流的副作用，**不参与推导**。

---

## 5. 网页版与 APK 的差异表（不藏在代码里）

| 能力 | Web | Android (Capacitor) |
|---|---|---|
| 计时正确性 | 同上（纯时间戳） | 同上 |
| 标签页切后台/浏览器最小化 | 计时仍正确；刷新由 visibility 恢复 | — |
| 计时期间的「保活」 | 无（不可靠），退化为「打开即正确」 | `ForegroundService` + 常驻通知 |
| 到点提醒 | Web Notifications（需页面存活）+ 页内提示 | `AlarmManager` 精确闹钟，App 不在也响 |
| 重启后提醒 | N/A（无服务端） | `BootReceiver` 重建 |
| 存储 | IndexedDB | `Preferences`（Kotlin 侧镜像）+ IndexedDB（Web 侧真相） |
| 语音/叫声 | WebAudio（首次交互后解锁） | WebView WebAudio，`AudioPort` 不暴露平台 |
| 震动 | `navigator.vibrate`（可选） | `Vibrator`（强度分级） |

- **网页版对 §4.1 不做承诺**：文档与 UI 必须在网页版明确说明「锁定屏幕/关闭标签页后提醒不可靠，请使用安卓 App 或让页面保持打开」。这不是妥协，是 PRD §4.1 的验收对象就限定在真机安卓（V1–V3 均标「真机人工验收」）。
- Android 上 WebView 的 IndexedDB 不是真相，`ReminderStore.kt` 才是系统视角的镜像；两者在每次 `syncAlarms` 时收敛（防「App 被系统静默杀进程导致 Preferences 未写」）。

---

## 6. Rationale

### Problem

需求基线 PRD v0.2 把「章鱼即主页」提到信息架构的中心（§3.1），同时把三条可靠性要求（§4.1：锁屏不漂移、杀 App 后仍响、重启不丢）定为**最高优先级**并限定真机验收。这两件事在技术上互相拉扯：角色系统要求**连续、高帧率的视觉反馈**（动画/姿态/粒子），可靠性要求**进程可以随时死掉而逻辑仍然正确**。架构的难点不在任何单个功能，而在于让「视觉连续性」与「进程不可靠」在**同一个状态模型**下共存，并且只交付一份 web 代码。PRD 同时明确把渲染方案与技术选型留空（§4.2、§9-8），所以本设计的核心任务是**把这两条约束收敛成一个可测试的形状**：计时是纯函数，角色表现是纯映射，只有「调度」交给操作系统。

### Usage（caller's view）

见 §3（四个调用点：主页发起训练、运行页渲染、保存每日提醒、启动恢复、P2 解锁）。类型草图由它们反推得出：`RunTimerScreen` 不需要参数就直接使用 `running`，推出「会话必须持久化且单例」；`saveReminder` 不返回闹钟 id，推出「`AlarmPort` 全量幂等同步」；`bootstrap` 不需要判断「是否被杀」，推出「`reconcile` 只看时间戳」。

### Shape

**数据先行**：三种计时域收敛为一个 `TimerPlan` 联合 + 一个全局唯一的 `TimerSession`（事件序列）。

- **训练/专注共用 `TimerEngine`**，差别只在 `segmentsOf(plan)` 的分段策略；运行页三种域共用同一渲染器，按 `plan.kind` 插槽化 UI。`notify` 域的提醒**不是会话**（无运行时状态需要每秒推导），它只产出 `PlannedAlarm` 并交给系统——这是三个域中唯一「不需要运行中状态机」的域，因此不硬套会话模型。
- **计时引擎的单一不变量**：`TimerSnapshot` 是 `(session, now)` 的纯函数。后台、锁屏、跨重启、UI 卡顿、时钟跳变，正确性只依赖这一个等式。tick 只负责「重算」，从不负责「累加」（per single-source-of-truth：剩余时间不存字段，只存段定义与事件）。
- **时间进入系统的边界只有两处**：`Clock` 与 `nextTriggerAt(rule, after)`。前者被测试注入，后者承载时区/夏令时政策。这是 per boundary-discipline：外部输入（系统时间、用户输入规则）在边界校验一次，内部全是类型。
- **`AlarmPort.syncAlarms({wholeSet})` 是接口深度的关键**：把「闹钟 id 映射、去重、取消、崩溃恢复、全平台重排」全部藏在原生侧，Web 侧只算「期望集合」。调用者学一个方法就够了（per encode-lessons-in-structure：用集合而非增量，无法表达「漏取消」这个错误）。
- **Zibloo 映射是「一张表 + 一个纯函数」**：`ZiblooPresentation` 是渲染器的**唯一输入**，渲染器不读 store、不判断状态（per boundary-discipline）。P2 的解锁只是往 `decoration` 里加元素，**不会引入新的状态分支**——这是把「轻养成」对 P1 的耦合压到最低的刻意的类型设计。
- **状态的写者唯一**：`appStore` 的 `reduce` 是唯一状态转移函数；`sync.ts` 是唯一副作用编排点；Android 侧 `ReminderStore` 是镜像（不参与业务推导）。per separate-before-serializing-shared-state：Web 与原生之间没有「都写同一状态」，只有「Web 写，原生读 + 幂等全量对齐」。
- **接口深度判断**：本设计的公共表面是 5 个纯函数（`segmentsOf`、`snapshotOf`、`nextTriggerAt`、`planAlarms`、`mapZibloo`）+ 2 个动作接口（`AppActions`、`AlarmPort`）+ 1 个插件（`ZiblooNative`，8 个方法）。它们背后隐藏着：分段与多段跨越算法、时区与日期的边界处理、事件溯源重放、闹钟全量对齐与重启重建、九张姿态的编排。**暴露给调用者的复杂度**刻意只到「给时间，拿快照」与「给规则，拿到触发时刻」这一级。

### Synthesis decision

*（由 arena 在综合阶段填写）*

### Tradeoffs accepted

- **接受姿态图（离散姿态）而不是连续骨骼动画**，以换取直接使用官方 3D 渲染稿、零重绘成本、以及「状态即数据」的可测试性。代价是姿态间过渡依赖交叉淡入/位移，不做真正的形变；如果未来需要更细腻的形变，需要引入 Rive 并重做素材（届时 `ZiblooPresentation` 的 `motion` 字段可扩展，不影响映射层）。
- **接受自写一个 Kotlin 插件**（~300–400 行），以换取对 `AlarmManager`/前台服务/权限的完全掌控。代价：Android 侧的原生代码必须纳入 code review 与构建，不能只做 web。
- **接受自写 i18n 与路由**（各约 60 行），以换取编译期漏译检测和零运行时依赖。代价：没有 i18next 的命名空间/懒加载/复数规则大全；本项目双语 + 少量复数够用。
- **接受 AlarmPort 全量替换**，以换取幂等与崩溃安全。代价：每次保存提醒都会重排所有闹钟（毫秒级），并且在系统日志里会看到一批 cancel/schedule。
- **接受「网页版不承诺锁屏可靠性」**，以换取单一代码库与真实的可靠性验收（安卓真机）。代价：网页版需要明确的提示文案，并且在浏览器关闭时提醒会丢失。
- **接受 `core/` 的纯函数不直接调用 `Date.now()`**，全走注入的 `Clock`，换取可测试性。代价：每次类型穿透都要多传一个参数——这是**刻意的**，而不是遗漏。
- **接受事件溯源带来的存储增长**，以换取重放正确性；`TimerSession.events` 上限很小（暂停/继续/跳过各几次），不需要压缩。

### Alternatives considered

1. **「可变剩余时间 + setInterval 每秒递减」的传统计时器模型**（大量计时器教程与 P0 原型的写法）。这是最容易让 AI 实现者写出的形状，但在锁屏后 tick 被系统节流时直接违反 §4.1。它把「时间」变成了一个可被多方修改的字段（split ownership），每个适配器都要正确保存它。**弃**：接口暴露的复杂度更低，但把最核心的不变量（不漂移）交给了每个调用者去维持。
2. **把提醒也建模为「会话」的一种（用同一个引擎驱动到达时刻）**。看似统一，但提醒的本质是「操作系统持有的 pending alarm」，不需要每秒快照；而且它需要 App 不在场时也工作，这与会话必然在内存中有 `running` 状态相冲突。**弃**：统一让 `TimerSession` 承担了两种截然不同的生命周期，接口变大而没藏住复杂度（shallow module）。
3. **第三方本地通知插件 `@capacitor/local-notifications`** 直接用于提醒调度。它能覆盖一次性/重复提醒，但 ① 重启后重建与「规则 → 闹钟集合」的全量对齐仍需自己实现；② 精确闹钟权限、省电白名单、渠道管理与通知文案的本地化都要自己补；③ 系统回调到 WebView 的路径在 App 被 kill 后不可用。**弃**：它并没有把「调度」这件事藏起来，只是把 `AlarmManager` 换了层壳；而 `AlarmPort` 一个方法就能藏住全部。
4. **Canvas/WebGL 自绘 Zibloo**（把渲染稿当作纹理做 2D 骨骼或 shader 动画）。表现力更好，但帧预算、无障碍、可截图验收、可测试性全部变差，且与「P0 原型是 HTML/SVG」的迭代路径割裂。**弃**：它对「章鱼作为导航载体」这件事没有帮助，反而增加了运行时的不确定性。
5. **Flutter 单栈**（一套 Dart 跑 Android + Web）。可靠性层同样要写原生插件，但网页版的文本渲染/动画/包体无法达到「与安卓一致」的观感要求，且失去 DOM 生态。**弃**。

### Implementation reconciliation

*（实现阶段填写）*

### Open questions and risks

1. **姿态图数量与导出规格**：本设计假设每状态 1–3 张 1024² WebP，总预算 ≤1.5MB。如果美术只能给出「一张图 + 变体参数」，则需改为在构建期用脚本（`tools/render-mascot.ts`）生成变体，此时「3D 源」必须是可重导出的工程文件。**问题：P1 前能否锁定「姿态表」？**（PRD §9-3）
2. **系统时间回拨**：`snapshotOf` 完全依赖 epoch，若用户把时间往回调，倒计时会「变长」。建议在 `Clock` 内加 `monotonic` 修正，但需要明确「跨重启时 monotonic 归零」的处理——**问题：接受「改系统时间会改变剩余时长」这一已知行为吗？**（安卓闹钟同样如此）
3. **精确闹钟权限**（Android 14）：`SCHEDULE_EXACT_ALARM` 或 `USE_EXACT_ALARM` 的选择影响上架审核；P1 不上架，但 P3 可能上架。**问题：是否接受 `USE_EXACT_ALARM`（无需用户手动授权，但对审核要求更严）？**
4. **国产 ROM 保活**：MIUI/ColorOS 等会限制自启动与精确闹钟。`BOOT_COMPLETED` 在这些系统上可能需要「自启动权限」。**问题：P1 的可靠性验收是否限定特定机型/系统？**
5. **WebAudio 在 Android WebView 中的解锁**：叫声需要一次用户手势才能播放，而「到点提醒」时用户不在场——此时由原生通知（而非 WebAudio）发声。**问题：Android 的闹钟响铃是否应该由 Kotlin 侧播放（MediaPlayer 循环 15 秒），而不是依赖 WebView？**（本设计倾向前者，`PlannedAlarm.presentation.sound` 交给原生；但样音文件要随 APK 打包。）
6. **i18n 与通知**：当用户切换语言时，系统里已注册的闹钟的 `title/body` 是旧语言。当前方案依赖「切换语言 → 触发一次全量 `syncAlarms`」，需要确认这是可接受的重排。

### Next implementation step

先写 `src/core/timer`：`segmentsOf` + `snapshotOf` + `diffSnapshots` 三件纯函数与它们的属性测试（覆盖后台跨越多个段），因为运行页、叫声、Zibloo 训练/专注状态全依赖这一个等式——它正确之后，其余模块都可以并行填充。
