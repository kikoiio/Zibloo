# A0 候选设计（candidate-fable）— Zibloo Timer 架构定稿

> 状态:候选,待 arena 综合。范围:技术选型结论、模块地图、Usage-first 类型草图、rationale。需求基线:`docs/PRD.md` v0.2。

## 技术选型结论

| 决策点 | 结论 | 关键理由 |
|---|---|---|
| 前端框架 | **Svelte 5 + SvelteKit (static adapter)** | 主页是「一只常驻动画角色」而非表单列表;细粒度响应式 + 声明式模板让「app state → Zibloo 表现」的纯映射直接写成一个由 store 驱动的组件,无 vdom 调和开销。一套代码产出纯静态站点(网页版)与 Capacitor webview 包(Android)。 |
| Zibloo 渲染/动画 | **分层方案:官方 3D 渲染稿导出 PNG/WebP 精灵图帧序列(主) + CSS/WAAPI 做位移/缩放过渡(辅)** | PRD §6.2 已定「正式素材基于官方 3D 渲染稿」。帧序列保留了 3D 渲染的质量,又不需要在端上跑实时渲染器;每状态一个姿态帧集 + 少量中间帧,CSS transform 驱动漂浮/跳出等连续运动。锁屏/后台降级为通知图标,本来就不需要动画,§2.2 的降级要求天然满足。 |
| 壳 | **Capacitor 6** | 同一 Web 代码 + 少量 Kotlin 插件即可覆盖 §4.1 的三条可靠性要求(前台服务、AlarmManager、BOOT_COMPLETED)。React Native/Flutter 需要为三个计时域重写全部 UI 且与「网页版同一套代码」冲突;原生 Kotlin 双端则放弃网页版。 |
| 后台可靠性(核心) | **时间戳推导 + 平台调度器,绝不 tick 累加**;Android 上运行中会话用 **Foreground Service**,提醒用 **AlarmManager `setExactAndAllowWhileIdle` + `AlarmManager.ACTION_SCHEDULE_EXACT` 权限 + BOOT_COMPLETED 广播重注册**;web 用持久化 + 恢复时重算 + (可选) Web Notifications | 见下文 Rationale;这是本设计的承重墙。 |
| 状态管理 | **Svelte 5 runes(`$state`/`$derived`)模块化 store,无 Pinia/Redux** | 状态量小、无跨端序列化需求;引入全局状态库是接口深度负收益。 |
| 测试 | **Vitest**(纯逻辑:计时引擎、调度展开、状态映射)+ **Testing Library + jsdom**(组件)+ 真机人工验收(§4.1 验收标准)。CI 优先云端(GitHub Actions) | 计时/调度/映射全部设计为纯函数,天然单测友好。 |
| i18n | **自定义轻量 ICU-ish 资源模块(zh-CN / en),编译期 key 检查** | 文案量小(一个 App 的文案),typesafe 的 `t('pomodoro.longBreak', {n})` 比拉 i18next 全家桶更小;但结构上与 i18next 同构,P3 若需要可无痛迁移。 |
| 持久化 | **SQLite (capacitor-sqlite / web: IndexedDB 经同一 repository 接口) + 纯 JSON 导出** | 历史记录是追加型列表 + 按周聚合查询,localStorage 会在 P2 图表场景变慢且无导出保障。 |

### 被否决的备选

- **SVG 手绘角色动画**:被否。PRD §6.2 明确正式素材基于 3D 渲染稿,SVG 需要美术按矢量重制全部姿态,且复杂径向渐变 + 触手骨骼动画在 SVG 里维护成本高。原型中的 SVG 只表方向。
- **Lottie(bodymovin)**:被否。需要 AE 工程师制作每个状态动画,而素材来源是 3D 渲染管线(Blender 等),导出 Lottie 需要额外插件且渐变/发光还原度差;帧序列 + transform 是同管线的最低成本路径。若音频/素材团队后续交付 Lottie,渲染层接口(`ZiblooPresenter` 只接受 `ZiblooPresentation`)允许替换实现而不动状态映射。
- **Canvas/JS 实时 2D 渲染 / three.js**:被否。为「漂浮 + 眨眼 + 几个姿态」上实时渲染器是过度工程;失去 CSS 势能动画与布局合成,功耗高,与「后台降级」的克制基调相反。
- **Rive**:有吸引力(状态机驱动、体积小),但依赖专有编辑器与运行时,素材定稿流程不受本项目控制;作为 P3 打磨的可选升级保留,不在 P1 承重。
- **React Native / Flutter**:被否,与「同一套代码出网页版」(§4.2)直接冲突。
- **纯 PWA(无壳)**:被否,§4.1 的杀 App/重启后提醒在 Android webview/PWA 下无法可靠满足。

---

## Rationale

### Problem

Zibloo Timer 的非平凡之处全在 §4.1 可靠性:web 平台的执行模型(页面可被随时冻结/杀死)与「锁屏不漂移、杀 App 提醒照响、重启规则不丢」是根本冲突的。所以架构必须把「时间的真值」从运行时进程里拿出来——真值是**数据库里的时间戳与调度规则**,进程只是渲染器和调度器。第二难点是 Zibloo 状态映射必须纯(PRD §2.2 + V5 单测要求),因此渲染层必须消费一个可由纯函数产出的中间类型(`ZiblooPresentation`),而不是消费 app state 本身。

### Usage (caller's view)

README 式用法,先写调用方,再推导类型。

```ts
// 场景 1:HIIT 会话启动页 —— 用户点「开始」
import { startSession } from '$lib/timer/engine';

const session = startSession({
  kind: 'training',
  plan: { workSec: 30, restSec: 15, rounds: 8 },
  now: Date.now(),
});
// session 是纯数据(SerializedSession),已含每段的绝对起止时间戳。
// 引擎不拥有循环、不拥有 interval;它只做「给定 now,算出当前段」。
persistSession(session);              // 落库 → 前台服务/web 恢复时重算的唯一依据
scheduleSegmentAlarms(session);       // 每段切换点交给平台调度器(AlarmManager/notification)
presenter.start(session);             // UI 层自己起 requestAnimationFrame 读 clock
```

```ts
// 场景 2:运行中的 HIIT 会话驱动 Zibloo(每帧调用,无副作用)
import { projectSession, mapZiblooState } from '$lib/timer/engine';
import { projectZibloo } from '$lib/zibloo/mapping';

const view = projectSession(session, Date.now());   // { phase: 'work', round: 3/8, remainMs, nextPhase }
const zibloo = projectZibloo({ activity: { kind: 'training', view } });
// zibloo = { mode: 'workout-cheer', mood: 'energetic', fx: ['tentacle-wave'] }
// Presenter(zibloo) → 播放对应姿态帧集 + CSS 动画。状态映射是纯函数,单测直接打表。
```

```ts
// 场景 3:创建重启后仍生效的每日提醒(吃药 08:30)
import { ReminderService } from '$lib/reminders/service';

const svc = new ReminderService(platformScheduler);   // 注入平台调度器(Capacitor 原生 / web)
const id = await svc.upsert({
  name: t('reminders.example.med'),
  rule: { kind: 'daily', at: { hour: 8, minute: 30 } },
  alert: { sound: 'zibloo-call', vibrate: true, tts: false },
});
// upsert 内部:1) 规则落 SQLite 2) 计算下一次绝对触发时刻 3) 注册平台精确闹钟。
// 设备重启后 BootReceiver 读库重注册,svc.restore() 幂等 —— 跑两次不会产生重复提醒。
await svc.restore();   // App 冷启动时也调一次
```

### Shape

#### 模块地图

```
src/
├─ timer/          # 计时核心 —— 全部纯函数,无平台依赖
│  ├─ types.ts         Session, TrainingPlan, PomodoroPlan, PhaseView
│  ├─ engine.ts        startSession / projectSession / control (pause/resume/skip/end)
│  └─ alarms.ts        planSessionAlarms: Session → AlarmSpec[] (纯,可单测)
├─ reminders/      # 提醒域 —— 规则纯函数 + 平台服务
│  ├─ rule.ts          nextTrigger(rule, from: Date): Date | null (纯,含周/小时区间规则)
│  └─ service.ts       ReminderService(接口在 platform,实现注入)
├─ zibloo/         # 角色域
│  ├─ mapping.ts       projectZibloo(appState): ZiblooPresentation (纯,§2.2 映射表)
│  ├─ presenter/       ZiblooPresenter.svelte —— 帧序列播放 + CSS 过渡
│  └─ unlock.ts        (P2) 本地数据 → 解锁集;断用回落,不丢数据
├─ history/        # 存储:SQLite/IndexedDB 同接口 repository + JSON 导出
├─ i18n/           # zh-CN.ts / en.ts + typesafe t()
├─ platform/       # 平台抽象边界(唯一允许碰原生的地方)
│  ├─ scheduler.ts    AlarmScheduler / ForegroundSession 接口
│  ├─ capacitor/      Kotlin 插件:ExactAlarmPlugin(alarm + BOOT), ForegroundService
│  └─ web/            WebScheduler(尽力而为 + 恢复重算)
└─ routes/         # SvelteKit 页面:小窝主页 / 运行页 / 历史 / 设置
```

#### 类型草图

```ts
// ── timer/types.ts ─────────────────────────────────────────────
/** 计时真值 = 绝对时间戳。不变量:pause 只记 pausedAt,不修改段的时间戳;
 *  resume 时重算。projectSession 永远从时间戳推导,绝不累加 tick。 */
export type Session = {
  id: SessionId;
  kind: 'training' | 'focus';
  plan: TrainingPlan | PomodoroPlan;
  startedAt: number;             // epoch ms
  segments: Segment[];           // 不可变,创建时一次性展开
  pausedAt: number | null;       // 暂停中的墙钟锚点
  endedAt: number | null;
};

export type Segment = {
  phase: 'work' | 'rest' | 'long-rest' | 'done';
  round: number;
  /** 本段的(经暂停补偿后的)绝对起止;前台服务恢复时以此重算剩余 */
  startAt: number;
  endAt: number;
};

export type PhaseView = {
  phase: Segment['phase'];
  round: number; rounds: number;      // 第 N / M 组
  remainMs: number;                   // 由 endAt - now 推导,非累加
  next: { phase: Segment['phase']; durationSec: number } | null;
};

// ── timer/engine.ts ────────────────────────────────────────────
export function startSession(input: {
  kind: 'training' | 'focus';
  plan: TrainingPlan | PomodoroPlan;
  now: number;
}): Session { /* not implemented: 展开 segments,给每段绝对时间戳 */ }

export function projectSession(s: Session, now: number): PhaseView | null {
  // not implemented: 二分/线性查当前段;pausedAt 悬挂时 remainMs 冻结在
  // pausedAt - (当前段已耗)。完成后返回 null 并应触发 celebrate。
}

export function pause(s: Session, now: number): Session { /* not implemented: 只写 pausedAt */ }
export function resume(s: Session, now: number): Session {
  // not implemented: offset = now - pausedAt,后续所有段 startAt/endAt 平移 offset。
  // 时间戳平移而非 tick 补偿 → 锁屏回来零漂移(不变量,单测覆盖)。
}
export function skip(s: Session, now: number): Session { /* not implemented: 收缩当前段 endAt */ }

// ── timer/alarms.ts ────────────────────────────────────────────
export function planSessionAlarms(s: Session): AlarmSpec[] {
  // not implemented: 每段边界 + 结束 → [{ triggerAt, intent: 'phase-change', payload: view }]
}

// ── reminders/rule.ts ──────────────────────────────────────────
export type ReminderRule =
  | { kind: 'once'; at: number }
  | { kind: 'daily'; at: { hour: number; minute: number } }
  | { kind: 'weekly'; at: { hour: number; minute: number }; days: number[] }
  | { kind: 'interval'; everySec: number; from: { hour: number }; to: { hour: number } };

export function nextTrigger(r: ReminderRule, from: Date, tz: string): number | null {
  // not implemented: 纯函数,注入时区避免设备 TZ 与测试 TZ 纠缠;单测打表。
}

// ── reminders/service.ts ───────────────────────────────────────
export interface AlarmScheduler {                    // platform/scheduler.ts
  schedule(spec: AlarmSpec): Promise<void>;          // Android: setExactAndAllowWhileIdle
  cancel(id: string): Promise<void>;
  /** BOOT_COMPLETED 后由原生插件调用;幂等:以 spec.id 去重 */
  rescheduleAll(specs: AlarmSpec[]): Promise<void>;
}

export class ReminderService {
  constructor(private sched: AlarmScheduler, private repo: ReminderRepo) { /* not implemented */ }
  async upsert(input: ReminderInput): Promise<ReminderId> { /* not implemented: 落库 + nextTrigger + schedule */ }
  async remove(id: ReminderId): Promise<void> { /* not implemented */ }
  /** App 冷启动与开机广播后都调;幂等(重跑 = 全量重排,spec id 去重) */
  async restore(): Promise<void> { /* not implemented */ }
}

// ── zibloo/mapping.ts ──────────────────────────────────────────
export type ZiblooPresentation = {
  mode: 'idle' | 'workout-cheer' | 'workout-rest' | 'focus-quiet' | 'focus-stir'
      | 'summon' | 'celebrate';
  fx: ('bubble' | 'blink' | 'tentacle-wave' | 'jump')[];   // 可叠加效果
};

export function projectZibloo(app: AppState): ZiblooPresentation {
  // not implemented: §2.2 表的直接编码;AppState 含当前 SessionView 或
  // reminderFired 事件。纯函数 → V5 单测 = 输入状态 × 期望表现打表。
  // 后台/锁屏时不进此函数,通知文案由 notificationText(presentation) 派生,
  // 状态语义一致(PRD §2.2 降级要求)。
}

// ── zibloo/unlock.ts (P2) ──────────────────────────────────────
export type UnlockState = {
  unlocked: CosmeticId[];        // 只增不减:断用回落展示,不丢已解锁
  streak: number;                // 由 history 派生,非独立存储(单一真值)
};
export function evaluateUnlocks(history: HistoryEntry[], today: Date): UnlockState { /* not implemented */ }
```

数据流:`UI 事件 → engine 纯函数 → 新 Session 落库 → platform 重排闹钟 → UI 每 frame 用 projectSession(now) 渲染`。不变量编码在类型里的点:`remainMs` 不存在于存储(强制推导);`pausedAt: number | null` 单字段编码暂停态;闹钟 spec 带 `id` 强制幂等。

#### 接口深度评估

公共面最小的三个函数承住了全部复杂度:`startSession` / `projectSession` / `ReminderService.upsert+restore`。UI 不需要知道前台服务、闹钟权限、时区展开、暂停补偿——全部被拉进 callee(per runner prompt:pull complexity into the callee)。`ZiblooPresenter` 只接受 `ZiblooPresentation`,把素材管线(帧序列、降级)完全藏在渲染层内部,未来换 Rive/Lottie 不外溢。

### Tradeoffs accepted

- 接受「帧序列素材体积较大(每状态数张 WebP)」换取零实时渲染依赖与 3D 渲染稿管线的直接复用。
- 接受「Android 需要自写小型 Kotlin 插件」换取 V1–V3 真机验收的确定性;不用任何社区插件正是因为可靠性是最高优先级、出问题要能自己改。
- 接受「web 版提醒在页面关闭时不可靠(降级:重开页面时补算错过的提醒并弹出)」,因为 §4.1 验收只针对安卓真机;降级行为要在 UI 明示。
- 接受「resume 采用整段时间戳平移」带来的存储写放大(每次 resume 重写 segments),换取模型简单、无 tick 累加路径。
- 自写 typesafe i18n 而非 i18next:接受迁移成本风险,换取 key 编译期检查与零依赖;迁移路径(资源文件同构)已评估。

### Alternatives considered

- **运行中会话靠前台服务在原生层 tick 计时**:被否。两条真值源(原生 tick 与 web 推导)必然漂移;本设计让前台服务只负责「存活 + 到点广播」,真值永远在时间戳。
- **ReminderService 直接持有 NotificationScheduler 而非 AlarmScheduler 抽象**:被否。会把「何时响」的策略和「怎么响」的表现耦合在服务里,web/安卓无法共用规则纯函数;当前切法让 `rule.ts + service.ts` 在两端逐字复用。
- **Zibloo 状态作为持久化实体(带心情数值)**:被否,PRD §2.2 明确纯映射无持久数值;坚持映射使 V5 单测退化为打表,且 P2 解锁系统可以叠加而不侵入。

### Open questions and risks

- 素材规格(每状态几帧、尺寸)未定(开放问题 3),帧序列方案对素材交付节奏有依赖——P1 是否先用 SVG 过渡?
- Android 12+ 精确闹钟需用户授权(`SCHEDULE_EXACT_ALARM`),首次设置提醒的授权引导流程需要用户确认交互方案。
- 提醒触发时若 App 已死,原生层能否直接播放 Zibloo 叫声 + 震动(不拉起 App)?建议原生插件内置叫声资源(风险:叫声定稿前用占位音)。
- Capacitor webview 在部分国产 ROM 上的后台存活率需真机验证(§4.1 本就要求真机验收,建议把机型清单纳入验收)。

### Next implementation step

先写 `timer/engine.ts` 的 `startSession/projectSession/pause/resume` 及其 Vitest 用例(含锁屏恢复零漂移断言)——它是所有其他模块的下游契约来源。
