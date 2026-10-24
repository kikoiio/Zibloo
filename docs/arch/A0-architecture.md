# Zibloo Timer A0 架构定稿

> 状态:**渲染方向已更新**(2026-10-24 用户改为基于已选 2D 原图制作动画;覆盖此前 3D 帧序列决定,详见 §8)
> 需求基线:`docs/PRD.md` v0.2 · 产出方式:4 候选并行探索 + 独立交叉评审 + 综合
> 候选存档:`docs/arch/a0-candidates/`(opus / fable / sonnet / haiku)

## 0. 综合决策(synthesis decision)

**基座:candidate-fable**。交叉评审总分 29/30 为四份最高;渲染方案与 PRD §6.2 素材管线零摩擦、公开接口面最小、不变量直接编码进类型。四个候选在可靠性路径上完全共识(见 §1),胜负由其余维度决定。

**嫁接**(来源 → 内容):

- **sonnet** → `AlarmPort.syncAlarms({ wholeSet })` 全量替换式幂等同步(结构上无法表达「漏取消」);`MY_PACKAGE_REACED` 纳入 BootReceiver;**到点叫声由原生 MediaPlayer 播放**(解决 WebAudio 需用户手势解锁、App 已死时无法发声的真问题);精确闹钟权限被拒时降级结果必须在 UI 可见并提供跳转系统设置。
- **opus** → `platform/notify` 与前台动画**共用同一份 `ZiblooPresentation` 语义**派生通知图标/文案,防止长出两张映射表;「规则表为唯一事实源,原生调度只是投影」作为架构原则。
- **haiku** → 「原生层只收绝对时刻,不理解规则语义」的接口收窄原则;缺素材降级 idle 不崩溃。候选期分层精灵图建议已由 §8 的 2D 原图动画方案覆盖。
- **opus(替换 fable 的 capacitor-sqlite)** → 持久化改为 **Dexie/IndexedDB 单栈**:数据量小(纯本地历史/规则),Web 端零额外依赖,消除基座唯一的第三方维护风险;原生侧按 sonnet 方案以 SharedPreferences JSON 镜像闹钟载荷。

**否决的落点**:opus 的 Lottie 主渲染方案(素材管线过重);sonnet 的事件溯源 store + Zustand + TanStack Query 三层状态机制(结构性过重,精华已抽出);haiku 的 sql.js 双后端。

**四候选共识**(强信号,直接作为架构不变式):Capacitor + 自写薄 Kotlin 插件(拒绝社区通知插件承担 §4.1);计时=时间戳推导纯函数,永不累加 tick;Zibloo=纯映射 + 可替换渲染器;提醒=规则表唯一真源 + 幂等全量重排。

## 1. 技术选型结论(回答 PRD §4.2 / 开放问题 8)

| 决策点 | 结论 | 关键理由 |
|---|---|---|
| 前端框架 | **Svelte 5 + SvelteKit(static adapter)** | 主页是常驻动画角色,细粒度响应式让「app state → Zibloo 表现」的纯映射直接成为 store 驱动的组件;一套代码出静态站点(网页版)与 Capacitor webview 包(Android)。React 为接近平手的备选(范例密度更高),记录在 Tradeoffs。 |
| Zibloo 渲染 | **已选 B2/C3 的 2D 原图 + CSS 位移与状态动画** | 使用原图的显示窗口,保持字形、比例、轮廓;角色整图悬浮、轻转、点按回应。屏幕位置与角色动作分开,连续点击可改向;专注/暂停静止,减少动态效果直接切换位置。当前不依赖模型、骨骼或预渲染帧。 |
| 壳层 | **Capacitor 6(仅 Android)+ 自写薄 Kotlin 插件** | §4.1 三条可靠性对应三个系统机制(AlarmManager 精确闹钟 / ForegroundService / BOOT_COMPLETED 广播),Web 栈一个都给不了,插件生态也覆盖不到——自写约 300–400 行 Kotlin 是需求的自然形状,不是被 Capacitor 限制。 |
| 原生可靠性层 | **单插件 `zibloo-alarms`**:`AlarmScheduler`(`setAlarmClock`/`setExactAndAllowWhileIdle` + 权限)、`BootReceiver`(`BOOT_COMPLETED` + `MY_PACKAGE_REPLACED`)、`TimerForegroundService`、`ReminderStore`(SharedPreferences JSON 闹钟载荷镜像) | 最高优先级需求不交给第三方维护节奏;铃声由原生 MediaPlayer 播放(资源随 APK 打包,App 已死也响)。 |
| 状态管理 | **Svelte 5 runes 模块化 store**,无全局状态库 | 状态量小;引入 Redux/Zustand 是接口深度负收益。 |
| 持久化 | **Dexie(IndexedDB)单栈** + 原生侧闹钟载荷镜像 | Web 零额外依赖;数据量小性能非瓶颈;历史为追加型 + 按周聚合查询,Dexie 足够。JSON 导出走同仓库接口。 |
| 测试 | **Vitest**(计时/调度/映射纯函数,注入 fake clock)+ **fast-check**(属性测试:任意事件序列下不漂移)+ **Playwright**(web 冒烟,CI 云端)+ **真机人工清单** `docs/qa/p1-device-checklist.md`(V1–V3 拆可复现步骤,含国产 ROM 场景) | §4.3 三大逻辑必测;§4.1 模拟器不算数。 |
| i18n | **自写 typesafe `t(key, params)` + zh-CN/en 资源**,`en` 声明 `satisfies Messages`,**漏译 = 编译失败** | 文案量小;编译期检查优于 i18next 运行时查表(支撑 V9);结构上与 i18next 同构,可迁移。 |

## 2. 架构原则(不变式)

1. **时间戳即真值**:剩余时间永远是 `f(锚点时间戳, now)` 的推导,不存在于存储。进程只是渲染器与编辑器,可随时死。
2. **规则表为唯一事实源,原生调度只是投影**:不一致时以规则表重建,重启恢复问题被这条原则整个吸收。
3. **Zibloo 呈现无状态**:每次由 `mapZibloo` 现算(§2.2「无持久数值」落在架构上);前台动画与后台通知共用同一份 `ZiblooPresentation` 语义。
4. **原生层只收绝对时刻**:不理解规则语义、不感知语言(接收已翻译字符串),最大化隐藏复杂度。
5. **解锁只增不减**:断用回落靠「不传 overlay」表达,不删数据(V8)。

## 3. 模块地图

```
src/
├─ core/                     纯 TypeScript,零框架/平台依赖 ← 单测主场
│  ├─ timer/
│  │  ├─ types.ts            Session / Segment / PhaseView / TimerEvent
│  │  ├─ engine.ts           startSession / projectSession / pause / resume / skip
│  │  └─ alarms.ts           planSessionAlarms: Session → AlarmSpec[](纯)
│  ├─ reminders/
│  │  ├─ rule.ts             nextTrigger / upcomingOccurrences(纯,注入时区)
│  │  └─ plan.ts             planAlarms: 规则集 → 期望闹钟集合(纯,含 unschedulable)
│  ├─ zibloo/
│  │  ├─ mapping.ts          mapZibloo: appState → ZiblooPresentation(纯,§2.2 唯一实现)
│  │  └─ cues.ts             段语义 → 叫声 ID 唯一映射表(§2.4)
│  ├─ unlock/                P2: evaluateUnlocks(纯) + 只增不减的解锁集
│  └─ history/               记录类型 + 统计纯函数(今日陪伴/周环比)
├─ state/                    runes store;唯一副作用编排点 sync.ts
├─ platform/                 唯一允许碰原生的边界
│  ├─ ports.ts               AlarmPort / ForegroundPort / NotifierPort / AudioPort
│  ├─ capacitor/             zibloo-alarms 插件 TS 封装
│  └─ web/                   降级实现(页面存活期内有效)
├─ persistence/              Dexie schema/迁移/仓库(私有,不上抛)
├─ i18n/                     messages/{zh-CN,en}.ts + typesafe t()
├─ zibloo/                   ZiblooPresenter.svelte:2D 原图与状态动画,只吃 ZiblooPresentation
└─ routes/                   小窝主页 / 运行页 / 历史 / 设置(SvelteKit)

android/                     Capacitor 工程 + zibloo-alarms Kotlin 插件
└─ .../zibloo/
   ├─ AlarmScheduler.kt      setAlarmClock / setExactAndAllowWhileIdle + 权限
   ├─ BootReceiver.kt        BOOT_COMPLETED / MY_PACKAGE_REPLACED → 从镜像重建
   ├─ AlarmReceiver.kt       到点 → 通知 + MediaPlayer 叫声 + 震动(不依赖 WebView)
   ├─ TimerForegroundService.kt  计时运行中保活 + 常驻通知
   └─ ReminderStore.kt       闹钟载荷镜像(SharedPreferences JSON,fsync)
```

依赖方向单向:`routes/zibloo → state → core`,`core` 不依赖任何人;`platform`/`persistence` 实现 `core` 定义的端口(依赖倒置)。ESLint `no-restricted-imports` 强制 `core/**` 禁止 import svelte/capacitor/dexie。

## 4. 核心类型草图(综合后)

```ts
// ── core/timer ─────────────────────────────────────────────────
// 不变式:remainingMs 不存在于存储;创建时一次性展开每段绝对起止时间戳;
// projectSession 为纯函数,二分查找当前段,一次调用可跨越任意多个段(后台 20 分钟回来)。
export type Session = {
  id: SessionId;
  kind: 'training' | 'focus' | 'quick';
  plan: TrainingPlan | PomodoroPlan | QuickPlan;   // 三模式统一到扁平段序列
  startedAt: number;
  segments: Segment[];        // 不可变;[i].startAt/endAt 为绝对 epoch ms
  pausedAt: number | null;    // 单字段编码暂停态
  endedAt: number | null;
};
export type Segment = {
  phase: 'prepare' | 'work' | 'rest' | 'long-rest';
  round: number; rounds: number;      // 「第 N / M 组」由此得出
  startAt: number; endAt: number;
};
export type PhaseView = {
  phase: Segment['phase'];
  round: number; rounds: number;
  remainMs: number;                   // = endAt - now,推导值
  next: { phase: Segment['phase']; durationSec: number } | null;
};
export function startSession(input: { kind; plan; now }): Session;      // not implemented
export function projectSession(s: Session, now: number): PhaseView | null;  // not implemented
export function pause(s: Session, now: number): Session;               // not implemented: 只写 pausedAt
export function resume(s: Session, now: number): Session;              // not implemented: 整段平移 offset = now - pausedAt
export function skip(s: Session, now: number): Session;                // not implemented: 截断当前段

// ── core/reminders ─────────────────────────────────────────────
export type ReminderRule =
  | { kind: 'once'; at: number }
  | { kind: 'daily'; at: LocalTime }                                   // 存本地时刻,时区/夏令时在纯函数内处理
  | { kind: 'weekly'; at: LocalTime; days: Weekday[] }
  | { kind: 'interval'; everyMs: number; window?: DayWindow };
export function nextTrigger(r: ReminderRule, from: number, tz: string): number | null;  // not implemented
export function planAlarms(reminders: Reminder[], now: number, locale: Locale): {
  alarms: PlannedAlarm[];              // 已翻译文案 + presentation,含未来 N 次展开(防数量爆炸设上限)
  unschedulable: { id: ReminderId; reason: 'missingPermission' | 'pastOnce' }[];  // 必须可见,不静默丢弃
};  // not implemented

// ── platform/ports(接口深度关键)─────────────────────────────────
export interface AlarmPort {
  /** 全量替换式幂等同步:结构上无法表达「漏取消」;半途崩溃/重启后重跑收敛到同一状态 */
  syncAlarms(input: { wholeSet: readonly PlannedAlarm[] }): Promise<{ degraded?: 'noExactAlarm' }>;
  getPermission(): Promise<'granted' | 'denied' | 'unsupported'>;
  requestPermission(): Promise<'granted' | 'denied'>;
  onAlarmFired(cb: (e: { reminderId: ReminderId; firedAt: number }) => void): Unsubscribe;
}

// ── core/zibloo ────────────────────────────────────────────────
export type ZiblooPresentation = {
  pose: 'idle-float' | 'train-exert' | 'train-rest' | 'focus-quiet'
      | 'focus-stir' | 'summon-pop' | 'celebrate';
  expression: 'blink' | 'sparkle' | 'happy' | 'focused' | 'wide';
  motion: MotionPreset;                  // reduced-motion 时冻结为静态
  overlay: DecorationId[];               // P2 装饰叠加(非替换),来自只读解锁集
  cue: AudioCue | null;                  // rise2 / fall2 / cheer3 / call
  particles: 'bubbles' | 'none';
  notification: { titleKey: string; bodyKey: string } | null;  // 后台/锁屏降级用,同表派生
};
export function mapZibloo(input: MapZiblooInput): ZiblooPresentation;   // not implemented,§2.2 表唯一实现

// ── core/unlock(P2)─────────────────────────────────────────────
export interface UnlockState {
  unlocked: DecorationId[];    // 只增不减,持久化
  showcase: DecorationId[];    // 由当前 streak 派生,断用回落为 [],已解锁不动
}
export function evaluateUnlocks(progress: UnlockProgress, prev: UnlockState): UnlockState;  // not implemented
```

## 5. 可靠性链路(§4.1 三条验收的落点)

1. **锁屏/后台不漂移(V1)**:`projectSession` 纯推导,JS 挂起多久都无关;运行中由 `TimerForegroundService` 保活音画,段边界提前注册 exact alarm 兜底。**前台服务只负责存活与到点广播,不 tick 计时**——不存在双真值源。
2. **杀 App 提醒仍触发(V2)**:全部经 `AlarmManager`(与进程无关);到点由 `AlarmReceiver` 直接发通知 + 原生 MediaPlayer 播叫声 + 震动,WebView 无需存活。
3. **重启不丢(V3)**:`BootReceiver`(BOOT_COMPLETED + MY_PACKAGE_REPLACED)从 `ReminderStore` 镜像重建全部闹钟;App 冷启动时 `syncAlarms(wholeSet)` 幂等重排是第二道保险。
4. **权限降级可见**:`SCHEDULE_EXACT_ALARM` 被拒(Android 14+ 默认不授予)→ `syncAlarms` 返回 `degraded`,提醒列表顶部显示警告条 + 跳转系统设置;降级到 `setAndAllowWhileIdle`(不精确但仍触发)。

**网页版明确不承诺 §4.1**(V1–V3 验收对象为安卓真机):页面关闭后提醒不可靠,设置页写明差异;页面存活期间计时正确(同一套纯函数)。

## 6. Tradeoffs accepted

- 当前直接复用 B2/C3 原始 PNG,优先保持已选视觉一致;正式透明素材与尺寸优化后续评估,当前不引入分层精灵图管线。
- 接受 resume 整段时间戳平移的写放大(每次重写 segments),换取模型简单、无 tick 累加路径、无事件重放机制。
- 接受 Svelte 而非 React:接近平手的取舍,选 Svelte 因角色映射与 runes 响应式的贴合;若后续范例/生态受阻,React 为记录在案的备选(核心层零框架依赖,迁移面只在 UI 层)。
- 接受自写 Kotlin 插件(~300–400 行)的维护成本,换取 §4.1 完全可控。
- 接受原生侧维护一份闹钟载荷镜像(与 Web 端规则表在每次 syncAlarms 时收敛),换取 BootReceiver 不依赖 WebView 启动即可重建。
- 接受全量重排的系统开销(每次保存提醒重排全部闹钟,毫秒级),换取幂等与崩溃安全。

## 7. 开放问题(承接 PRD §9,标注归属)

1. ~~A0 渲染选型~~ → **已更新(2026-10-24)**:2D 原图动画路线,见 §8
2. P1 状态表先以整图动画表达;独立眨眼或腕足动作需额外素材和用户认可,当前不作为 P0 前置。
3. `SCHEDULE_EXACT_ALARM` vs `USE_EXACT_ALARM`(后者免授权但上架审核严;P1 不上架倾向前者 + 引导,待用户拍板)
4. 闹钟响铃时长/循环策略(原生 MediaPlayer,默认 15s?待定)
5. 网页版是否投入 Service Worker(首版倾向不做,仅前台可用 + 数据导出互通)
6. P2 解锁阈值数值(P2 前产品拍板)
7. 国产 ROM 验收机型清单(建议至少一台 MIUI/ColorOS,纳入 p1-device-checklist)

## 8. 渲染选型决策记录与下一步

### 2026-10-24 改为 2D 原图动画

**当前决定:在已选 B2 角色与 C3 字标原图上做 2D 动画。用户要求删除 3D 部分,此前同日确认的 Blender 离线帧序列路线已被覆盖。**

原型实现边界:

- 只对整图做位移、旋转与轻微缩放,不重新描画或拆分原图,不修改字形与轮廓。
- 主页点击空白水域让角色游过去,连续点击从当前显示位置改向;位置限制在场景中,为说明文案留出空间。方向键可移动,Home 或返回中间按钮复位。
- 游动期间让 B2 原图周期性摆动并在身后短暂浮出小气泡;到达后退出游动动画,恢复当前状态动作。气泡和位移在减少动态效果时关闭。
- 点按角色播放短暂招呼动作与已选 E/G 声音;训练、提醒沿用各自动作,专注与暂停静止,庆祝短暂播放后停下。
- 系统/应用减少动态效果禁用位移动画,交互直接切换位置;页面隐藏时停止场景过渡。
- 不包含独立腕足、眨眼、自由视角与实时模型。未来需要新增局部动作时先评审素材,不重开已否决的 3D 管线。

`docs/arch/a0-candidates/` 保留为候选期历史论证,其中旧渲染建议不代表当前执行方向。

### 历史与当前下一步

2026-10-21 用户否决旧原型;2026-10-22 选定 B2/C3;2026-10-24 从 3D 帧序列转向 2D 原图动画。当前继续完成 P0 视觉与操作原型,由用户确认体验后再进入生产实现。3D 模型、渲染工作流与相关参考已清理。

后续进入 P1 时,建议先实现 `core/timer` 纯函数(`startSession / projectSession / resume`)+ 属性测试(任意暂停/恢复序列零漂移、后台跨多段一次投影正确);这是后续技术建议,不是当前执行阶段。
