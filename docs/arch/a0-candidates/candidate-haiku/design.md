# Zibloo Timer 架构候选方案（candidate-haiku）

> A0 架构定稿候选 · 回应 PRD §4.2 技术选型待重评、§9 开放问题 8
> 需求基线:`docs/PRD.md` v0.2（本文不引入 PRD 之外的功能）

---

## Problem

Zibloo Timer 是一套代码同时交付「网页版 + 安卓 APK」的本地计时器，其首页是一只章鱼（Zibloo），三个计时领域（训练/专注/记事）是它的三种工作模式。这个组合带来三处让形状不显然的地方。

第一，§4.1 的三条可靠性要求（锁屏/后台不漂移、杀 App 后提醒仍触发、重启后规则不丢）本质上要求「计时与提醒的真相不由 App 进程持有」。任何「靠 `setInterval` 累加 tick」的方案在 Web 栈里都会在后端被节流时漂移，所以计时必须是**时间戳推导**而非累加，且必须在任意进程冷启动时能重建全部真相。这一条决定了整个状态模型，是本设计最硬的约束。

第二，§2.2 要求 Zibloo 的表现是「当前活动状态的纯映射，无持久数值」，而 §2.3（P2）又要求轻养成解锁「纯本地数据驱动的视觉内容」。纯映射与本地解锁数据必须能共存且不互相污染——映射函数的输入只能是领域状态 + 一个只读的解锁集合，绝不能读计时内部字段。

第三，§4.2/§9.8 明确把渲染方案与容器方案留白。章鱼是持续动画的复杂角色（细长卷曲触手、大圆头、眨眼、呼吸/漂浮），且 §6.2 说正式素材来自 3D 渲染稿导出的 PNG/WebP 透明素材（含各状态姿态）。这直接约束了渲染技术：素材是**位图序列**，不是矢量、不是 3D 运行时。

约束清单（Phase A 无既有系统可接地，此处是 PRD 约束的归纳）：
- 单代码库，双端产物；无云、无账号、无 iOS 首发。
- 首版即中英双语，文案不得硬编码，含通知文案。
- 计时逻辑、提醒调度逻辑、Zibloo 状态映射逻辑必须有单元测试（§4.3）。
- 可靠性三条必须真机验收，模拟器不算。
- P2 增加视觉解锁系统（纯本地）。
- 上架 Google Play 的可能性要保留（target API 34+）。

---

## Usage (caller's view)

### 快速上手（README 式）

```ts
// 依赖注入在 app/bootstrap.ts；下面每个调用方只 import 自己真正需要的模块。
import { createTimerService } from '../domain/timer/service';
import { createReminderService } from '../domain/reminder/service';
import { mapZiblooState } from '../domain/zibloo/state-mapping';
import { t } from '../i18n/t';

// 一个 App 就是三样东西的组合：计时服务、提醒服务、Zibloo 表现层。
const timers = createTimerService({ clock: systemClock, repo: sessionRepo });
const reminders = createReminderService({ clock: systemClock, repo: reminderRepo, alerter: nativeAlerter });

// 冷启动：先 reconcile，再订阅。这是 App 唯一允许的恢复入口。
await timers.reconcile();
const live = await timers.active();          // 可能为 null（被杀后重开、但仍该继续计时的会话）
const zibloo = deriveZibloo(live, await unlockStore.all());

// 提醒同样只有一条恢复路径。
await reminders.reconcile();                 // 重排所有 enabled 规则 → 原生闹钟
```

### 调用点 1：HIIT 运行页驱动 Zibloo 表现

UI 层永远不读计时引擎内部字段，只读 `TimerSnapshot` 并把它过一遍纯映射函数。

```tsx
// src/ui/screens/RunningScreen.tsx
function RunningScreen({ timerId }: { timerId: TimerId }) {
  const snapshot = useTimer(timerId);          // store 里的 TimerSnapshot，纯数据
  const zibloo = useMemo(() => mapZiblooState(snapshot, unlockStore.cached()), [snapshot]);

  useEffect(() => {
    // 到点语义：引擎保证每个 segment 切换都会调一次 onCue，UI 只负责播放。
    return timers.onCue(timerId, (cue) => audio.play(cue.voiceId, { vibrate: cue.vibrate }));
  }, [timerId]);

  return (
    <FullscreenStage>
      <ZiblooStage state={zibloo} cue={zibloo.currentCue} />
      <SegmentRail snapshot={snapshot} />   {/* 第 N / M 组 + 下一段预览 */}
    </FullscreenStage>
  );
}
```

关键点：`ZiblooStage` 只吃 `ZiblooPresentationState`，它不知道什么是 HIIT。映射是纯函数，单元测试直接喂快照、不需要 DOM。

### 调用点 2：创建一条重启后仍生效的提醒

规则只描述「什么时候响」，如何排程完全封装在 `reminder/service` 背后；调用方不碰 AlarmManager。

```ts
// src/domain/reminder/service.ts —— 唯一的提醒写入口
await reminders.create({
  name: t('reminder.default.takeMedicine'),   // 双语资源，调用方给 key+参数
  rule: { kind: 'daily', at: { hour: 8, minute: 30 } },
  notify: { sound: 'zibloo.attention', vibrate: 'standard', speak: false },
});

// service 内部一次事务完成：写 repo（真源）→ 重排该规则后续 N 次 → 原生排程。
// repo 是唯一真源；原生 alarm 只是「被重建出来的执行器」。
// BOOT_COMPLETED / MY_PACKAGE_REPLACED 到来时，native 侧不读任何 DB，
// 只调用已注册的单个 hook：
nativeBridge.onDeviceBoot(() => reminders.reconcile());
```

### 调用点 3：专注结束 → 历史写入 → 陪伴统计

专注结束是「副作用」，由引擎在 tick 推导出的 transition 里声明，由应用层一次性提交。

```ts
// src/app/session-effects.ts
timers.onEvent((event) => {
  switch (event.kind) {
    case 'segmentCompleted': {
      audio.play(event.cue.voiceId);          // 段切换叫声语义
      if (event.lastOfSession) {
        historyRepo.append(event.sessionRecord);      // 完整/提前结束/跳过组数
        companionship.add(event.focusedMs);          // 今日陪伴统计（§2.2）
      }
      break;
    }
    case 'reminderFired':
      ziblooSignal.emit('reminder');        // 让映射进入「提醒召唤」的最短路径
      break;
  }
});
```

**这三条调用点即规格**。下面的类型草图从它们反推得出；若两者冲突，改类型，不改用法。

---

## Shape

### 技术选型结论

| 决策点 | 结论 | 一句话理由 |
|---|---|---|
| 前端框架 | **React 18 + TypeScript + Vite** | 唯一具备成熟 i18n/测试/动画生态且团队（一个开发者 + agent）产出稳定的组合；Vue/Svelte 也可行但不改变下述任何边界 |
| 渲染/动画 | **Sprite-sheet 位图序列（PNG/WebP），CSS/JS 驱动帧选择；不做运行时 3D、不做 SVG 路径变形动画** | §6.2 明确正式素材是 3D 渲染稿导出的位图，渲染方案必须顺着素材走 |
| 容器 | **Capacitor（Android 首发）+ 自写极薄原生插件**（`ForegroundService` / `AlarmScheduler` / `BootReceiver`） | Capacitor 不接管可靠性子系统，可靠性由自写插件实现，这反而最符合 §4.2「候选而非硬约束」 |
| 状态管理 | **手写 tiny store（`useSyncExternalStore`）+ 纯函数 reducer 派生**，不引入 Redux/Zustand | 全局状态只有 `activeTimers / reminderList / settings / unlocks` 四类；引入框架的 reducer 语法只是给纯函数包一层 |
| 持久化 | **SQLite**：`sql.js`（web）/ `@capacitor-community/sqlite`（android）同源 schema；仓库接口单一 | 三个领域共享历史与提醒表，IndexedDB 多 store 无事务 |
| 测试 | **Vitest**（单元）+ **Playwright**（web 冒烟）+ 真机人工验收清单 | 纯函数多、DOM 少，Vitest 的 `jsdom` 都不是必需；可靠性的模拟器结果按 §4.1 不算数 |
| i18n | **`messages/zh-CN.json` + `en-US.json` + 类型化 `t(key, params)`**；日期/数字走 `Intl` | 文案零硬编码是可测的（§8 V9） |

**渲染方案的深入判断（这是 A0 最需要说清的一项）：**

- 章鱼形象：大圆头 + 超大闪亮眼 + 细长卷曲触手 + 头顶气泡，逐帧位图在大圆头 + 细触手（高频细节）下显存与内存占用大。
- 结论：**分层混合**。
  1. **身体/头部/大触手 = 精灵图序列**（少帧、慢速、循环）——这是主要体积来源；
  2. **眼睛 + 眨眼 + 眨眼辅助 = 独立小精灵**（眼白/瞳孔/闭眼线分层），高频眨眼因此极便宜；
  3. **呼吸 = CSS transform scale + 定时 opacity 交叉淡化**，不逐帧重绘；
  4. **漂浮/弹跳位移 = CSS transform / Web Animations API**（compositor-only，不触发 layout/paint）。
- 帧选择只在「切换姿态」时发生（一次性改 `background-position`），不做逐帧 `requestAnimationFrame` 重绘，因此**页面空闲时 JS 参与度近似为零**——这正是我们需要的：可靠性靠时间戳推导（零 CPU 也能正确），动画靠合成线程。
- 素材命名即状态契约：`zibloo/<pose>-<variant>@<fps>.<webp>`，由 `ZiblooStage` 按 `ZiblooPresentationState.pose` 查表；缺素材时降级到 `idle`，不崩溃。

**为何不用其它渲染方案：**
- **SVG 路径 morph / React Spring 驱动触手**：与 §6.2「基于 3D 渲染稿制作 PNG/WebP 素材」冲突——设计稿不是矢量的，美术交付的是位图；且触手形变需要物理引擎，帧一致性无法美术控制。
- **Canvas 2D 逐帧绘制**：与 CSS 合成器相比没有优势（同为手动帧选择），却丢掉了 DOM 层的可访问性、可测试性与 CSS 合成线程优化，还要求一套自己的场景图。
- **Lottie**：只能表达 AE 的矢量/位图关键帧，不支持「表情分层 + 复用姿态 + 按状态即时切换」的组合；且导出 pipeline 要引入 AE 依赖与付费插件。
- **运行时 3D（Three.js / Rive / 3D 渲染稿实时播放）**：实时渲染 3D 章鱼在低端机发热掉帧，且违背「后台不做动画」的降级要求（要额外做「完全停渲染」分支）；素材体积与首版复杂度都不划算。Rive 也需要美术重做矢量资产。

**容器方案的深入判断：**
- §4.1 要求的三条可靠性在 Android 上对应三个不同的**系统机制**，Web 栈一个都给不了：到点准时提醒 = `AlarmManager`（`setExactAndAllowWhileIdle` + `SCHEDULE_EXACT_ALARM`）；杀 App 后仍触发 = 上述 alarm（`AlarmManager` 本来就与 App 进程无关）；后台不被回收 + 前台通知 = `ForegroundService`；重启后恢复 = `BOOT_COMPLETED` 广播 + `MY_PACKAGE_REPLACED`。
- Capacitor 的价值是：WebView 承载 UI、原生壳与 build 流水线（APK 签名、target 34+、以后上 Play 都能直接做）；它的插件生态覆盖不到上述三件事，所以**必须自写插件**——这不是「被 Capacitor 限制」，而是 §4.1 的自然形状。
- 我们把原生代码压到三个插件类 + 一个 `WebView.onPause` 钩子里，全部经一个 TS 接口 `Alerter` 使用。Web 版用同一接口的浏览器实现（`setTimeout` + Notification API，仅网页开着才有效——网页版明确不承担 §4.1，可接受且需在设置里说明）。
- 备选 **TWA**：需已上架 Play，与 §1「不上架」冲突，弃。
- 备选 **React Native / Flutter**：角色渲染上限更高，但 §6.2 素材是位图、不需要 3D；代价是双端 UI 要写两遍或引入 RN-Web 兼容层，反而违背「同一套代码」。若未来上 iOS，Capacitor 只需 `cap add ios`（架构不排斥，见 §1）。

### 模块图

```
src/
├─ app/                        组合根:只有这里知道所有模块
│  ├─ bootstrap.ts             DI 装配;首屏调 timers.reconcile() / reminders.reconcile()
│  └─ session-effects.ts       引擎事件 → 音效/历史/陪伴统计 的唯一接线处
│
├─ domain/                     纯 TypeScript,零框架依赖,零平台依赖  ← 单测主场
│  ├─ clock.ts                 Clock 接口(systemClock / fakeClock)
│  ├─ ids.ts                   branded ids
│  ├─ segments.ts              HIIT/番茄 的段计划 → 段序列(纯)
│  ├─ timer/
│  │  ├─ types.ts              TimerId / TimerKind / TimerSnapshot / Cue / TimerEvent
│  │  ├─ engine.ts             纯函数:plan + 时间戳 → snapshot + events
│  │  ├─ session-store.ts      进行中会话的内存+DB 存取
│  │  └─ service.ts            TimerService:create/pause/resume/skip/end/reconcile/onCue/onEvent
│  ├─ reminder/
│  │  ├─ types.ts              ReminderRule / ReminderItem / NextFire / NotifyChannel
│  │  ├─ schedule.ts           纯函数:rule + now → NextFire / 多次 Occurrence(时区/夏令时正确)
│  │  ├─ repo.ts               ReminderRepo(唯一真源)
│  │  └─ service.ts            ReminderService:create/update/remove/reconcile/setEnabled
│  ├─ zibloo/
│  │  ├─ types.ts              ZiblooPresentationState / ZiblooPose / ZiblooCue
│  │  ├─ state-mapping.ts      纯函数 mapZiblooState(snapshot, unlocks) → presentation
│  │  └─ cues.ts               段语义 → 叫声 ID 的唯一映射表(§2.4)
│  └─ unlock/                  P2
│     ├─ rules.ts              纯函数:历史统计 → UnlockedPalette
│     └─ store.ts              只读缓存 + 重新求值
│
├─ platform/                   唯一允许 import 平台 API 的地方
│  ├─ alerter.ts               interface Alerter {scheduleNext, cancel, onFire, onDeviceBoot}
│  ├─ android/                 Capacitor 插件封装(TS 侧)
│  └─ web/                     浏览器实现
│
├─ persistence/                仓库实现,SQL schema 私有
│  ├─ db.ts                    打开/迁移(sql.js 或 @capacitor-community/sqlite)
│  ├─ schema.ts                建表 + 迁移版本  ← 泄漏边界:不上抛
│  └─ repos/                   history / reminder / settings / session 仓库实现
│
├─ i18n/
│  ├─ t.ts                     t(key, params)  ← 唯一取词入口
│  └─ messages/{zh-CN,en-US}.json
│
└─ ui/                         只 import domain + i18n + zibloo 组件,不看 repositories
   ├─ screens/                 Den(主页) / Running / Reminders / History / Settings
   ├─ components/zibloo/       ZiblooStage / EyeSprites / BubbleSlots
   └─ ...
```

依赖方向单向：`ui → domain`、`app → domain + platform + persistence`；`domain` 不依赖任何人（这是它能脱离浏览器做单测的原因）。`platform` 与 `persistence` 都实现 domain 定义的接口（依赖倒置），domain 从不 import 它们的实现。

### 核心类型草图

```ts
// ── clock: 时间戳推导的唯一时间源,禁 setInterval 累加 ─────────────────
export interface Clock {
  now(): number;                       // epoch ms,单调 + wall-clock
  wallClockAt(anchorWall: number): number; // 设备休眠/改时间后校正(见 reconcile)
}

// ── ids: branded,防止把 ReminderId 传进 TimerRepo ────────────────────
export type TimerId = string & { readonly __brand: 'TimerId' };
export type ReminderId = string & { readonly __brand: 'ReminderId' };
export type SegmentId = string & { readonly __brand: 'SegmentId' };

// ── segments: 三模式统一收敛到「段序列」,Zibloo 与引擎共用同一真相 ────
export type SegmentKind = 'work' | 'rest' | 'longRest' | 'prep';
export interface SegmentPlan {
  kind: SegmentKind;
  durationMs: number;
  // 预设模板/长休息/组数在此展开;调用方拿到的就是扁平序列
}
export interface SegmentSequence {
  readonly kind: 'hiit' | 'pomodoro' | 'note';
  readonly segments: readonly SegmentPlan[];
  readonly longRestEvery?: number;    // pomodoro:每 N 个番茄插入长休息
  /** 平面索引 → 段序号(1-based)与总段数;HIIT「第 N / M 组」由此得出 */
  segmentMeta(index: number): { ordinal: number; total: number };
}

export function buildHiitPlan(p: HiitConfig): SegmentSequence;   // not implemented
export function buildPomodoroPlan(p: PomodoroConfig): SegmentSequence; // not implemented

// ── timer/types ──────────────────────────────────────────────────────
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerSnapshot {
  readonly id: TimerId;
  readonly kind: 'hiit' | 'pomodoro' | 'note';
  readonly status: TimerStatus;
  readonly plan: SegmentSequence;
  readonly index: number;             // 当前段平面索引
  readonly anchorWallMs: number;      // 进入当前段的 wall-clock;剩余 = anchor - now
  readonly remainingMs: number;       // 仅 paused 时有意义;running 时是缓存值,非真相
  readonly elapsedMs: number;         // 已专注总时长(陪伴统计用)
  readonly startedAt?: number;
  readonly endedAt?: number;
  readonly completion: Completion;   // { kind:'full'|'early', skippedSegments:number }
  readonly tag?: string;              // pomodoro 标签
}

export interface Cue {
  readonly voiceId: string;           // 'zibloo.work.start' | 'zibloo.rest.start' | 'zibloo.done'
  readonly vibrate: VibratePattern | false;
  readonly speak?: { textKey: string; params?: Record<string, string> };
}
export type TimerEvent =
  | { kind:'segmentCompleted'; timerId:TimerId; index:number; cue:Cue; lastOfSession:boolean;
      focusedMs:number; sessionRecord:SessionRecord }
  | { kind:'sessionFinished'; timerId:TimerId; record:SessionRecord }
  | { kind:'sessionEndedEarly'; timerId:TimerId; record:SessionRecord };

// ── reminder: 规则 = 「什么时候响」,排程 = 领域内纯函数 ────────────────
export type ReminderRule =
  | { kind:'onceAt'; at:number }
  | { kind:'onceAfter'; delayMs:number }              // 「X 分钟后提醒我」
  | { kind:'daily'; at:LocalTime; }                   // 08:30 吃药
  | { kind:'weekly'; weekdays:Weekday[]; at:LocalTime }
  | { kind:'intervalHours'; everyHours:number; within:DayWindow }; // 喝水
export interface LocalTime { hour:number; minute:number; }
export interface DayWindow { fromHour:number; toHour:number; }   // toHour<from ⇒ 跨午夜

export interface ReminderItem {
  readonly id: ReminderId;
  readonly nameKey: string;           // 双语 key;自定义文字走 nameText
  readonly nameText?: string;         // PRD §9.6 待定:允许自定义时的暂存字段
  readonly rule: ReminderRule;
  readonly notify: NotifyChannel;     // { sound, vibrate:'light'|'standard'|'strong', speak:boolean }
  readonly enabled: boolean;
  readonly createdAt: number;
}

export type NextFire =
  | { kind:'at'; at:number }
  | { kind:'none'; reason:'disabled'|'oneShotPassed'|'ruleExhausted' }
  ; // 单一出口:排程器只认识「某时刻」或「不再有」,不认识规则语义

export function nextOccurrence(rule: ReminderRule, now:number): NextFire;   // not implemented
export function upcomingOccurrences(rule: ReminderRule, now:number, n:number): number[]; // not implemented

// ── zibloo: §2.2 映射,纯函数,零持久数值 ────────────────────────────
export type ZiblooPose = 'idle-float'|'idle-blink'|'train-exert'|'train-rest'
  |'focus-quiet'|'focus-stretch'|'alert-pop'|'celebrate'
  | 'unlocked-hat' | 'unlocked-bubbles';   // P2 装饰叠加,非替换

export interface ZiblooPresentationState {
  readonly pose: ZiblooPose;
  readonly intensity: 0|1|2|3;        // 0 静 → 3 全力;映射强度,不存数值成长
  readonly overlay?: ZiblooDecoration; // P2:已解锁装饰,来自 UnlockedPalette
  readonly bubble?: { key:string; params?:Record<string,string> }; // 问候语/到点文案
  readonly nextChangeHintMs?: number;  // 「下段 40s」等,只读派生
}

/** §2.2 映射表唯一实现。输入只有领域快照与只读解锁集合。 */
export function mapZiblooState(
  s: TimerSnapshot | null,
  unlocks: ReadonlySet<ZiblooDecoration>,
  nowMs?: number,
): ZiblooPresentationState;   // not implemented

// ── unlock: P2,纯本地数据驱动,断用回落不丢 ─────────────────────────
export type ZiblooDecoration = 'hat'|'bubbles'|'spray';
export interface UnlockProgress { completedSessions:number; streakDays:number; focusedHours:number; }
export interface UnlockedPalette { readonly decorations: ReadonlySet<ZiblooDecoration>; }
export function evaluateUnlocks(p: UnlockProgress): UnlockedPalette;  // not implemented
// 已解锁集合**只增不减**(持久化),回落仅是「当前不展示」——保证 V8「不丢失」

// ── unlock 语义之外的通用持久化 ──────────────────────────────────────
export interface SessionRecord {
  readonly kind:'hiit'|'pomodoro'|'reminder';
  readonly startedAt:number; readonly endedAt:number;
  readonly focusedMs:number;
  readonly completion:{ kind:'full'|'early'|'aborted'; skippedSegments:number };
  readonly tag?:string;
}
```

**关键不变式（编码进类型与命名，而非注释）：**

1. **时间戳推导**：`remainingMs` 只在 `paused` 时是真相；`running` 时真相是 `anchorWallMs - clock.now()`。这是类型层面「running 时 remainingMs 是缓存值」的直接体现——任何模块若想用它做累积都会被文档与类型签名同时挡下。
2. **repo 是提醒真源，原生 alarm 只是重建出的执行器**：`ReminderRule` 从不上抛给 `platform`；`Alerter` 只收 `at:number`。改一个 `platform` 实现不需要理解规则语义。
3. **单一真源的映射**：`Cue` 的「运动上扬/休息下沉/完成三连」只在 `zibloo/cues.ts` 一处定义，引擎按段 `kind` 取，UI 不再自行判断。
4. **`NextFire` 是收窄出口**：所有周期规则坍缩为「下一个绝对时刻」或「不再有」，使幂等重排简单到可以每次 `reconcile()` 全量重算（≤几百条，毫秒级）。
5. **解锁只增不减**：类型用 `ReadonlySet` 且 `evaluateUnlocks` 是纯函数，UI 只读；断用回落靠「不传 overlay」表达，不是删数据。

### 数据流（一个 HIIT 段的完整链路）

```
plan → TimerSnapshot(running, anchorWallMs)
     → mapZiblooState(snapshot) → pose='train-exert' → ZiblooStage 换精灵图位置
     → clock 到点 → reconcileDerived(now) 纯比较 anchor 与 now → TimerEvent.segmentCompleted
     → session-effects.ts: audio.play(cue) ; historyRepo.append ; companionship.add
     → 新 snapshot(index+1) → 循环或 TimerEvent.sessionFinished → celebration 姿态 + 三连叫
```
链路只有 4 个文件，符合「短调用链」。`session-effects.ts` 是唯一的接线处——加统计不再需要在引擎里塞回调。

### 可靠性设计（§4.1 的具体落点）

- **锁屏/后台不漂移**：前台 `ForegroundService`（`mediaPlayback` 前台类型即可，最小权限）保活 WebView；即使被回收，重新打开时 `reconcile()` 用 `anchorWallMs - now` 一次性推导，**中间不丢一秒**。引擎没有任何 `setInterval` 依赖。
- **到点准时**：`setExactAndAllowWhileIdle`，`SCHEDULE_EXACT_ALARM` 运行时申请（target 33+ 的权限模型），申请失败时降级 `setAndAllowWhileIdle` 并在 UI 提示「精确闹钟未授权」。
- **杀 App 提醒仍触发**：全部靠 `AlarmManager`，与进程无关；`onAlarm` 起一个临时 `BroadcastReceiver` 拉起通知（`Zibloo` 小图标 + 双语文案），不需要 App 存活。
- **重启不丢**：`BOOT_COMPLETED` + `MY_PACKAGE_REPLACED` → `nativeBridge.onDeviceBoot(() => reminders.reconcile())`。repo 是真源，所以重建就是全量重算，天然幂等。
- **时区/夏令时**：`daily`/`weekly` 规则存**本地时刻**（非 UTC 偏移），每次排程用设备当前时区换算绝对时刻；`intervalHours` 用绝对毫秒累加，不受时区影响。这条在 `schedule.ts` 单测里覆盖三个时区用例。
- **用户改系统时间**：`Clock.wallClockAt` 在 `reconcile()` 里检测「anchor 落在未来但段已过阈值」的异常，触发全量重排。

---

## Synthesis decision

*（由 arena 填写：本文为 runner 候选，基座/嫁接待综合。）*

本候选的立场差异点，供综合时对照：
- 主张**精灵图分层 + CSS 合成**这一混合方案，而非纯 SVG 或纯 Canvas；
- 主张**手写 tiny store** 而非 Zustand，把「派生而非同步」写进 store 契约；
- 主张 **repo 为真源、全量幂等重排**，而非增量维护 alarm；
- 主张把 `Alerter` 接口收到极窄（只认绝对时刻），让原生层不理解规则语义。

## Tradeoffs accepted

- 接受**手写 store 的样板代码**（约 60 行），换取「派生规则集中在一处、无法被绕过」；不引入 Zustand/Redux 是刻意的过早简化，若将来派生关系复杂到 store 本身难读，这是第一个该重新评估的点。
- 接受**精灵图体积**（P1 素材若含 5 姿态 × 8 帧，可能 3–6 MB），换取零逐帧 JS；WebP + 分层眼睛已把大头压掉，若首屏体积超标再评估 AVIF/按需加载，不在 v1 提前优化。
- 接受**原生代码虽少但不可省略**（3 个插件类 + 1 个 Receiver），换取 §4.1 的三条硬要求；把它藏进「平台适配层」而不是假装 Web 能做到。
- 接受**网页版不承诺 §4.1 可靠性**（浏览器定时器会被节流），换取不为 2% 用户维护第二套提醒引擎；网页版设置页明确标注这一差异，避免误导。
- 接受**锁定时区语义为「本地时刻」**，用户在飞行模式跨时区时提醒会落在新的本地时刻——这是用户期望的行为，但需在设置页写一句。

## Alternatives considered

- **备选一：Zustand/Redux 做全局状态 + 引擎内订阅**。接口深度上更浅，但把「剩余时间 = anchor - now」这条核心不变式变成每个 reducer 都可能写错的约定；引擎还要自己维护订阅者列表。选中的 tiny store + 纯 `reconcileDerived` 让剩余时间只有一个推导点。
- **备选二：SVG 路径 morph + 弹簧物理驱动触手**。隐藏了「形变」，但把美术控制权从「渲染稿导出」抢到代码里，与 §6.2 的位图素材冲突，且帧一致性无法验收。选中的精灵图让「素材规格」可独立验收（§9.3 本来就是待定项）。
- **备选三：Capacitor 社区通知/后台任务插件承担提醒**。省掉自写原生代码，但社区插件的调度精度与重启恢复行为不受我们控制，而 §4.1 是「最高优先级 ⭐」。选中的方案宁可自己写三段短原生，也不把最高优先级需求交给第三方维护节奏。
- **备选四：RN/Flutter + 共享逻辑层**。角色动画上限更高，但双端 UI 双份代码或引入 RN-Web 兼容层，违背「同一套代码」；位图素材下渲染优势用不上。

## Implementation reconciliation

*（实现阶段填写：已接受的偏离、接受来源、以及为何共享契约仍成立。）*

## Open questions and risks

- §9.6 提醒文字是否自定义？本稿已预留 `nameText`，但**长度上限与通知截断**未定——是否需要在 `ReminderItem` 上加约束？
- §9.3 素材规格未定，P1 需要哪些 pose 的最小集合？请确认 `idle/train-exert/train-rest/focus-quiet/alert-pop/celebrate` 六个是否够覆盖 §2.2 全表，还是需要 `focus-stretch` 与 `idle-blink` 独立帧。
- 网页版是否值得投入 `Notification API` + `Service Worker`，还是首版网页只做「前台可用 + 数据与网页版 APK 互通」？（注意：无账号即无跨设备同步，导出/导入才是互通手段。）
- P2 解锁阈值具体数值（如「累计 30 次专注」）需要产品拍板，否则 `evaluateUnlocks` 的常量无处可依。
- 风险：部分国产 ROM（MIUI/EMUI）对 `setExactAndAllowWhileIdle` 有额外限制或需自启动白名单；真机验收清单应覆盖至少一台国产 ROM。
- 风险：`SCHEDULE_EXACT_ALARM` 在 Android 14（target 34）默认不授予，需要在首启引导里申请，否则 §4.1 的「准时」在部分设备退化——是否接受首启多一步？

## Next implementation step

先实现 `domain/` 里三个纯函数模块（`segments`、`schedule`、`state-mapping`）及其 Vitest 用例——它们不依赖框架与平台，是整个设计的信任根，也是最快能暴露形状错误的地方。