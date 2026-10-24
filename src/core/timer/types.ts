// core/timer/types.ts — 计时模型。不变式(A0 §2):剩余时间永远是 f(锚点时间戳, now) 的
// 推导,不存在于存储;segments 展开为不可变的绝对起止时间戳,进程可随时死。

export type SessionKind = 'training' | 'focus' | 'quick';

/** 段语义统一为四相;三模式都展开成同一扁平段序列。 */
export type Phase = 'prepare' | 'work' | 'rest' | 'long-rest';

export type TrainingPlan = {
	kind: 'training';
	prepareSec: number;
	workSec: number;
	restSec: number;
	rounds: number;
};

export type PomodoroPlan = {
	kind: 'focus';
	focusSec: number;
	shortRestSec: number;
	longRestSec: number;
	/** 每 N 个专注段进入长休息 */
	longRestEvery: number;
	/** 专注段个数 */
	rounds: number;
};

export type QuickPlan = { kind: 'quick'; durationSec: number };

export type TimerPlan = TrainingPlan | PomodoroPlan | QuickPlan;

export type Segment = {
	phase: Phase;
	/** 第 N / M 组(quick 恒为 1/1) */
	round: number;
	rounds: number;
	startAt: number;
	endAt: number;
};

export type Session = {
	id: string;
	kind: SessionKind;
	plan: TimerPlan;
	startedAt: number;
	/** 不可变展开;相邻段首尾相接(skip 后仍保持连续) */
	segments: readonly Segment[];
	/** 单字段暂停态:暂停锚点。恢复时把晚于该点的段整体平移。 */
	pausedAt: number | null;
	/** 仅由显式 end/skip末段 写入;自然完成保持 null,由 projectSession 推导 */
	endedAt: number | null;
};

export type PhaseView = {
	phase: Phase;
	round: number;
	rounds: number;
	/** = endAt - now,纯推导值 */
	remainMs: number;
	segmentIndex: number;
	next: { phase: Phase; durationSec: number } | null;
};

export type AlarmSpec = {
	sessionId: string;
	at: number;
	kind: 'phase' | 'complete';
	/** 到点后进入的段(末段边界为 complete) */
	toPhase: Phase;
};
