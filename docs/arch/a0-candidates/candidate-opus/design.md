# Zibloo Timer A0 架构定稿 — 候选设计(Opus)

> 本文档是 architect 并行探索的一份候选设计包。需求唯一基准:`docs/PRD.md`。
> 结构按 `rationale-template.md` 组织;代码标识符保持英文,正文为中文。

## Problem

Zibloo Timer 是一个「章鱼即主页」的计时器应用,需一套代码同时交付 Android APK 和网页版,首版不做云账号、不做 iOS。架构的非平凡之处集中在三处:

1. **可靠性是最高优先级(§4.1)**:锁屏/后台计时不漂移、杀 App 后提醒仍触发、重启后提醒规则不丢,且必须真机人工验收。这意味着计时逻辑不能依赖 JS 主线程的 tick,提醒必须下沉到平台原生的闹钟级调度,Web 与 Android 在此能力上天然不对称,架构必须把「原生可靠性层」隔离为可替换的边界,而不是让它渗进业务代码。
2. **Zibloo 是产品灵魂而非装饰(§2.2)**:角色表现必须是「应用状态 → 呈现状态」的纯映射,同一状态表现一致,且要有单元测试覆盖(验收 V5)。这要求状态映射是一个无副作用的纯函数模块,与渲染方案解耦,否则渲染方案一旦更换(原型 SVG → 正式 3D 渲染稿素材),映射逻辑会被拖下水。
3. **PRD 刻意留白技术选型(§4.2、开放问题 8)**:「章鱼即主页」提高了角色渲染/动画要求,Capacitor + Web 栈是候选而非硬约束。本候选的任务就是把这个决策做实,并给出被否决的备选。

约束:单代码库双端;首版双语 i18n;计时/调度/状态映射三大逻辑必须单测;P2 加纯本地的视觉解锁;分里程碑交付,P1 即要真机验收可靠性,因此 P1 的架构骨架必须一次到位,不能先跑 Web 假实现再补原生层。

## Usage (caller's view)

先写三个真实调用点,类型草图由此推导。

### 调用点 1:HIIT 训练运行中驱动 Zibloo 呈现

```ts
// features/training/TrainingSessionScreen.tsx
import { createSessionClock } from "@/core/timer";
import { mapZiblooState } from "@/core/zibloo";
import { ZiblooPresenter } from "@/zibloo/ZiblooPresenter";

function TrainingSessionScreen({ plan }: { plan: HiitPlan }) {
  // clock 内部只记录锚点时间戳;UI 用 rAF/interval 读快照,后台时由原生层接管
  const clock = useMemo(() => createSessionClock(buildHiitTimeline(plan, Date.now())), [plan]);
  const [snapshot, setSnapshot] = useState(clock.now());

  useEffect(() => {
    clock.onPhaseBoundary((snap) => {
      void sessionAudio.cue(snap.phase);            // 段切换叫声(上扬/下沉)
      history.append(buildRecord(snap));            // 完成/跳过时落历史
    });
    return clock.start();
  }, [clock]);

  // Zibloo 是纯映射:输入 app 状态,输出呈现描述;渲染器可换,映射不变
  const presentation = mapZiblooState({ kind: "session", snapshot });
  return (
    <>
      <ZiblooPresenter presentation={presentation} />
      <Hud snapshot={snapshot} onPause={() => clock.pause()} onSkip={() => clock.skipPhase()} />
    </>
  );
}
```

### 调用点 2:创建一条重启不丢的每日提醒

```ts
// features/reminders/useReminderEditor.ts
import { reminderScheduler } from "@/core/reminders"; // 平台无关门面

async function saveReminder(draft: ReminderDraft) {
  const rule = parseReminderRule(draft); // 边界校验,产出领域类型(union)
  const id = await reminderScheduler.upsert({ name: draft.name, rule, channels: draft.channels });
  // upsert 内部:先持久化规则(单一事实源),再向平台调度器注册,幂等。
  // Android: AlarmManager.setExactAndAllowWhileIdle + BootReceiver 恢复;
  // Web: 退化为 Notification + 页面存活期间的检查器,能力差异藏在接口后面。
  return id;
}
```

### 调用点 3:App 启动(含开机重启后)恢复全部调度

```ts
// app/bootstrap.ts — Android 的 BootReceiver 与 Web 启动走同一个入口
import { reminderScheduler } from "@/core/reminders";
import { unlockStore } from "@/core/progression";

export async function bootstrapApp(origin: "user-launch" | "device-boot") {
  const restored = await reminderScheduler.resyncAll(); // 读本地规则表,重注册全部闹钟,幂等
  await unlockStore.recomputeStreak();                  // P2:断用回落,已解锁内容保留
  i18n.activate(await settings.getLocale());            // zh / en,首版即双语
  return restored; // { scheduled, expired } — 过期未触发的提醒按策略补发或标记错过
}
```

三个调用点共同确定了设计骨架:`core/timer`(时间戳推导的计时引擎)、`core/zibloo`(纯映射)、`core/reminders`(持久化优先的平台门面)、`core/progression`(本地解锁)、平台能力层在 `platform/` 下按端实现,接口不暴露任何平台类型。

## Shape

### 技术选型结论

| 决策点 | 结论 | 理由(被否决项见 Alternatives) |
|---|---|---|
| 前端框架 | **React 18 + TypeScript(strict)+ Vite** | 生态与 i18n/测试栈最成熟;团队与 agent 工具链熟悉度最高;Vite 同时产出 Web 构建与 Capacitor 的 web assets。 |
| 角色渲染/动画 | **Lottie(lottie-web)为主,静态 WebP 兜底**;Zibloo 呈现层与动画载体解耦 | 正式素材来自 3D 渲染稿(PRD §6.2)。3D 稿 → After Effects/Blender 序列 → Lottie JSON 是体积最小、状态切换最易参数化的路径;后台/锁屏按 §2.2 降级为通知,不在后台渲染动画。 |
| 壳层 | **Capacitor 6(仅 Android 目标)** | 满足 §4.1 的唯一现实路径:AlarmManager/BOOT_COMPLETED 必须走原生插件,Capacitor 允许同一代码库出 Web;targetSdk 34 满足未来上架条件。 |
| 原生可靠性层 | **一个自研 Capacitor 插件 `zibloo-alarms`(Kotlin)**,封装 AlarmManager + BootReceiver + 前台 Service;Web 端为同接口的降级实现 | 现有社区插件(local-notifications)语义不匹配「闹钟级精确调度 + 重启恢复 + 规则单一事实源」,且是 transport 泄漏风险;自研薄插件把平台细节关在一个模块里。 |
| 状态管理 | **Zustand(会话/UI 状态)+ Dexie(IndexedDB,持久化唯一事实源)** | 持久状态只写 Dexie,运行期状态只放 Zustand,读边界合并 —— 避免 split ownership。不引入 Redux(模板过重)。 |
| 测试栈 | **Vitest(单测,注入 fake clock)+ fast-check(时间线属性测试)+ Playwright(Web UI 冒烟,CI)** | 三大逻辑(计时/调度/映射)纯函数化,可用注入时钟确定性单测;真机可靠性按 §4.1 人工验收,不试图自动化。 |
| i18n | **react-i18next + ICU MessageFormat,语言资源 JSON 按命名空间分包;CI 脚本校验 key 完备性(hand-synced list 防线)** | 首版即双语,所有可见文案(含 Zibloo 状态文案)进资源文件。 |
| 音频 | **Howler.js(Web)+ 插件内 MediaPlayer(Android 后台到点叫声)** | 叫声语义(上扬/下沉/三连)是数据驱动的 cue 表,非硬编码分支。 |

### 模块地图

```
src/
  core/                    # 纯领域层,零平台依赖,零 import from platform/ 或 ui/
    timer/                 # 计时引擎:时间线展开 + 锚点时间戳推导
    zibloo/                # §2.2 状态映射:纯函数 app 状态 → 呈现描述
    reminders/             # 规则解析、下一次触发时刻计算、调度门面
    history/               # 会话/提醒记录、今日陪伴统计的纯计算
    progression/           # P2:解锁条件求值(纯函数)+ 回落规则
    i18n/                  # 文案 key 类型、命名空间契约
  platform/
    alarms/                # Capacitor 插件接口 + Web 降级实现(同一 TS 接口两实现)
    audio/                 # 叫声 cue 播放(Howler / 原生)
    notify/                # 后台/锁屏时的通知呈现(§2.2 降级规则的唯一家)
  persistence/             # Dexie schema、迁移、导出;schema 不外泄(边界内解析为领域类型)
  state/                   # Zustand stores:把 core 的纯结果投影为 UI 可订阅状态
  zibloo/                  # ZiblooPresenter:Lottie 播放器,消费呈现描述,无业务逻辑
  features/                # training / focus / notes / history / settings 页面与交互
  app/                     # bootstrap、路由、底部导航(小窝/历史/设置)
android/                   # Capacitor 工程 + zibloo-alarms Kotlin 插件(AlarmManager/BootReceiver/ForegroundService)
```

单一事实源分配(每块状态只有一个写者):

- 提醒规则与调度状态 → `persistence` 的规则表;`core/reminders` 是唯一写入口。
- 运行中会话 → `core/timer` 的 `SessionClock` 实例(内存),历史落盘后才由 `persistence` 持有。
- Zibloo 呈现 → **无状态**,每次由 `mapZiblooState` 现算(§2.2「无持久数值」直接落在架构上)。
- 解锁内容 → `persistence`;当前展示姿态由 `core/progression` 从 streak 现算,断用回落即重算结果变化,已解锁记录不动(§2.3)。

### 核心类型草图

```ts
// ── core/timer ─────────────────────────────────────────────
// 不变式:引擎永不累加 tick。所有剩余时间 = f(锚点时间戳, now)。
// 后台/锁屏时 JS 可能挂起,恢复后读 now() 自动得出正确值 → 满足 §4.1 不漂移。

/** 时间线:把计划(运动/休息×组数、番茄循环)展开成不可变段序列 */
export interface Phase {
  readonly index: number;
  readonly kind: "work" | "rest" | "longRest" | "focus";
  readonly label: string;            // i18n key,非字面文案
  readonly durationMs: number;
}

export interface SessionTimeline {
  readonly kind: "hiit" | "pomodoro" | "quick";
  readonly phases: readonly Phase[];
  readonly totalMs: number;
}

/** 构建时间线:纯函数,可单测 */
export function buildHiitTimeline(plan: HiitPlan, startedAtMs: number): SessionTimeline {
  throw new Error("not implemented");
}

export interface SessionSnapshot {
  readonly timeline: SessionTimeline;
  readonly phaseIndex: number;
  readonly phase: Phase;
  readonly phaseEndsAtMs: number;    // 锚点:本段绝对结束时刻
  readonly remainingMs: number;      // = phaseEndsAtMs - now,推导值
  readonly paused: boolean;
  readonly finished: boolean;
}

export interface SessionClock {
  /** 注入时钟便于测试;实现内部只存 { startedAtMs, pausedAccumMs } 等锚点 */
  now(): SessionSnapshot;
  start(): () => void;               // 返回 unsubscribe
  pause(): void;                     // 幂等
  resume(): void;                    // 幂等
  skipPhase(): void;                 // 把当前段锚点截断到 now
  onPhaseBoundary(cb: (snap: SessionSnapshot) => void): () => void;
}

export function createSessionClock(
  timeline: SessionTimeline,
  deps?: { now?: () => number },     // 测试注入 fake now
): SessionClock {
  throw new Error("not implemented");
}

// ── core/zibloo ────────────────────────────────────────────
// §2.2 映射表的唯一代码载体。纯函数,无 IO,无动画引用;
// 输出是「呈现描述」而非具体素材路径,渲染器可替换(Lottie/精灵图)而本模块不变。

export type ZiblooMood =
  | { kind: "idle"; activity: "drift" | "blink" | "bubbles" }
  | { kind: "training"; phase: "work" | "rest" }        // 加油 / 放松
  | { kind: "focus"; resting: boolean }                  // 安静 / 苏醒伸展
  | { kind: "reminder" }                                 // 召唤:醒目 + 叫 + 震
  | { kind: "celebrate" };                               // 完成:欢快 + 三连

export interface ZiblooPresentation {
  readonly mood: ZiblooMood;
  readonly animationCue: string;      // 语义 cue id,如 "training.work.cheer",由资源表解析到素材
  readonly audioCue: AudioCueKind;    // "rise" | "fall" | "triple" | "call" | "none"(§2.4 语义)
  readonly haptic: "none" | "light" | "standard" | "strong";
  readonly accessory: AccessoryId | null;  // P2 解锁装饰,来自 progression
}

/** 输入是当前 app 状态的最小切片;后台/锁屏时调用方改走 platform/notify,不经过本函数 */
export type ZiblooInput =
  | { kind: "idle"; pokeAtMs?: number }
  | { kind: "session"; snapshot: SessionSnapshot }
  | { kind: "reminder-fired"; reminderId: ReminderId }
  | { kind: "session-finished"; sessionKind: SessionTimeline["kind"] };

export function mapZiblooState(input: ZiblooInput, ctx?: { accessory?: AccessoryId }): ZiblooPresentation {
  throw new Error("not implemented");
}

// ── core/reminders ─────────────────────────────────────────
// 规则表是唯一事实源;平台调度只是它的投影。
// upsert/resyncAll 幂等:重复调用或进程被杀后重入,结果一致(§4.1 杀 App / 重启)。

export type ReminderRule =
  | { kind: "once"; atMs: number }
  | { kind: "daily"; hhmm: string; tz: "local" }                    // "08:30" 吃药
  | { kind: "weekly"; weekdays: readonly Weekday[]; hhmm: string }  // 周一/三/五 19:00
  | { kind: "interval"; everyHours: number; window?: DayWindow };   // 每 X 小时喝水

export interface Reminder {
  readonly id: ReminderId;
  readonly name: string;
  readonly rule: ReminderRule;
  readonly enabled: boolean;
  readonly channels: { sound: boolean; vibrate: boolean; voice: boolean };
}

/** 纯函数:给定规则与基准时刻,求下一次触发。DST/时区变化在此集中处理,可属性测试 */
export function nextFireAt(rule: ReminderRule, fromMs: number, now?: () => number): number | null {
  throw new Error("not implemented");
}

export interface ReminderScheduler {
  /** 先写规则表再注册平台闹钟;任一步失败整体回滚规则表,保证两写一致 */
  upsert(draft: Omit<Reminder, "id"> & { id?: ReminderId }): Promise<ReminderId>;
  remove(id: ReminderId): Promise<void>;
  /** 启动/开机恢复入口:读全部规则,重新注册,返回过期项供补发策略决定 */
  resyncAll(): Promise<{ scheduled: number; expired: readonly Reminder[] }>;
}

// 组合根(app/bootstrap)注入平台实现;core 只见接口
export function createReminderScheduler(deps: {
  store: ReminderStore;              // persistence 提供
  native: PlatformAlarmDriver;       // platform/alarms 提供,Android/Web 两实现
  now?: () => number;
}): ReminderScheduler {
  throw new Error("not implemented");
}

/** 平台驱动契约:不出现任何 Android/Web 类型,core 可注入 fake 单测 */
export interface PlatformAlarmDriver {
  scheduleExact(id: ReminderId, fireAtMs: number, payload: NotificationCopy): Promise<void>;
  cancel(id: ReminderId): Promise<void>;
}

// ── core/progression(P2,纯本地)──────────────────────────
export interface UsageStats { readonly streakDays: number; readonly totals: TotalsByKind; }

export interface UnlockState {
  readonly unlocked: readonly AccessoryId[];   // 已解锁,永不因断用删除
  readonly active: AccessoryId | null;         // 当前展示;streak 断裂时回落为 null
}

/** 纯函数:本地使用数据 → 解锁状态。断用回落 = streakDays 变 0 时 active 重算为 null */
export function evalUnlocks(stats: UsageStats, prev: UnlockState): UnlockState {
  throw new Error("not implemented");
}

// ── core/history ───────────────────────────────────────────
export interface SessionRecord {
  readonly id: string;
  readonly kind: "training" | "focus" | "reminder";
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly completion: "full" | "early-stop" | { skippedPhases: number };
  readonly tag: string | null;                  // 专注标签
}
export function companionshipToday(records: readonly SessionRecord[], dayStartMs: number): number {
  throw new Error("not implemented");           // §2.2 今日陪伴统计
}
```

### 关键数据流(可靠性链路)

1. **运行中计时**:JS 挂起不漂移,因为 `remainingMs` 永远是锚点推导;到点提醒由 `zibloo-alarms` 在段边界注册 exact alarm(前台会话用 ForegroundService 保活计时页音画,闹钟级只兜底段切换/完成)。
2. **杀 App**:提醒规则早已在规则表 + AlarmManager 双注册;到点由原生 Receiver 触发通知 + 叫声,JS 无需存活(验收 V2)。
3. **重启**:BootReceiver 调 `resyncAll()` 重注册(验收 V3);规则表是唯一事实源,原生调度只是投影,二者不一致时以规则表为准重建 —— 单一事实源原则直接吸收了整个重启恢复问题。
4. **后台状态降级**:§2.2 的降级规则由 `platform/notify` 独占实现 —— 它消费同一份 `ZiblooPresentation` 的语义字段(animationCue 解析为通知图标/文案 key),前台动画与后台通知由此共用一套语义,不会长出两张映射表(hand-synced list 防线)。

## Tradeoffs accepted

- 接受自研 Kotlin 插件的维护成本,换取调度语义(规则表单一事实源 + 精确闹钟 + 重启恢复)完全可控,不被社区插件的抽象泄漏绑架。
- 接受「JS 引擎只管前台体验、原生层管到点保证」的双层结构,换取 §4.1 三条验收都能在真机成立;代价是同一段「到点该发生什么」要在两侧各注册一次,靠 `ReminderScheduler.upsert` 单入口 + 幂等 `resyncAll` 收敛。
- 接受 Lottie 素材制作对 3D 渲染稿 → AE 工作流的依赖,换取小体积、运行时参数化与 Web/Android 一致的渲染;静态 WebP 作为低端机降级路径,不引入第二套动画系统。
- 接受 Zibloo 呈现「无持久数值、每次现算」,放弃任何角色状态缓存,换取 §2.2「同一状态表现一致」在类型层面成立(无状态即无可漂移状态)。
- 接受 P1 就落地 `zibloo-alarms` 原生插件(而非先 Web 假实现),换取 P1 里程碑真机验收可行性;Web 端降级实现同期交付以保证单代码库可跑。
- 接受 Dexie/IndexedDB 而非 SQLite,换取 Web 端零额外依赖;Android 上数据量小(纯本地历史/规则),性能非瓶颈。

## Alternatives considered

**渲染方案**:
- *纯 SVG 手绘动画(沿用原型)*:否决。原型 SVG 仅表方向(PRD §6.2),正式素材来自 3D 渲染稿;逐帧手调 SVG 动画无法承接 3D 渲染产物,且状态切换要靠代码拼变换,§2.2 映射表会变成代码分支而非数据。
- *帧序列精灵图(WebP/APNG)*:否决为主方案(保留为降级)。实现最简单但体积随状态数线性膨胀,状态切换无可参数化中间帧;P2 解锁装饰叠加时组合爆炸。
- *Rive*:否决。运行时优秀但素材工具链与 3D 渲染稿工作流不匹配,且引入非开源运行时依赖。
- *实时 3D(Three.js 渲染 glTF)*:否决。包体、功耗与维护成本对一个计时器不成比例;「章鱼即主页」需要的是生动,不是可交互 3D。

**壳层 / 可靠性路径**:
- *PWA + WorkManager 不可及*:纯 Web 无 AlarmManager/BOOT_COMPLETED 等价物,§4.1 杀 App 与重启两条验收在纯 Web 上物理不成立 —— 这是必须有原生壳的根因,不是偏好。
- *React Native / Flutter*:否决。双端之一是纯网页版,RN/Flutter Web 都不满足「同一套代码出网页版」的工程质量;且团队/agent 的 Web 栈熟悉度直接折损。
- *Capacitor 社区插件 @capacitor/local-notifications*:否决。其调度模型以「通知」为中心,规则持久化与重启恢复语义不透明,exact alarm 权限与 Android 14+ 行为差异要绕过插件抽象去补,接口反而更宽更浅。

**计时引擎**:
- *tick 累加(setInterval countdown)*:否决。JS 挂起即漂移,§4.1 第一条直接不成立;锚点推导是唯一可行形状,因为它把「挂起多久」变成了无关变量。

**状态管理**:
- *Redux Toolkit*:否决。领域逻辑已纯函数化,store 只是投影;RTK 的切片模板在本规模是净负担。
- *RxJS 流驱动*:否决。计时引擎只需要快照读取与边界回调,引入响应式图会加深调用链而无对应收益。

## Open questions and risks

1. Android 14+ 的 `SCHEDULE_EXACT_ALARM` 默认拒绝策略:首版分发走 APK 直装可声明该权限,但未来上架 Google Play 受限 —— P1 是否需要同时实现 `setExactAndAllowWhileIdle` 与 `setWindow` 的降级档,还是直接要求用户授权?
2. 「每 X 小时区间重复」的提醒在开机恢复时,基准时刻应从规则创建时刻还是当天零点起算?这决定 `nextFireAt` 的语义,需用户在 P1 细化时确认(对应 PRD 开放问题 6 同类)。
3. Lottie 素材管线(3D 渲染稿 → AE → bodymovin)是否已被素材制作方接受?若否,P1 需要先用静态 WebP + CSS 呼吸动画占位,状态映射模块不受影响(这正是解耦的收益)。
4. 厂商 ROM(小米/华为)的后台限制会杀死 ForegroundService:是否在设置页加「保活引导」入口(跳自启动/电池白名单设置)?建议 P1 加入,否则真机验收在国产 ROM 上风险最高。
5. Web 端「杀 App 后提醒」物理不可达,验收 V2/V3 是否明确仅针对 Android 端?(按 §4.1「真机(安卓)」表述应如此,建议用户在 A0 评审时书面确认。)

## Next implementation step

先落地 `core/timer` 的 `SessionClock` 与 `buildHiitTimeline`,配 fake-clock 单测与 fast-check 属性测试(任意计划展开后各段时长与总时长守恒、暂停/恢复不漂移),作为 P1 的第一个可验收单元。
