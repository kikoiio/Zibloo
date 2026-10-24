// state/timer.svelte.ts — 当前会话状态与副作用编排:
// 引擎(纯) → 这里(唯一编排点) → Dexie / 端口 / UI。
import * as engine from '../core/timer/engine.ts';
import type { Session, SessionKind, TimerPlan, PhaseView } from '../core/timer/types.ts';
import type { HistoryEntry } from '../core/history/history.ts';
import { getDb } from '../persistence/db.ts';
import { ports } from './ports.svelte.ts';

export const timer: {
	session: Session | null;
	now: number;
	skipped: boolean;
	celebrating: boolean;
	greeted: boolean;
	greetUntil: number;
	completedAt: number | null;
	/** 提醒召唤:到点后短暂置真,主页据此呈现召唤态 */
	reminding: boolean;
} = $state({
	session: null,
	now: 0,
	skipped: false,
	celebrating: false,
	greeted: false,
	greetUntil: 0,
	completedAt: null,
	reminding: false
});

let ticker: ReturnType<typeof setInterval> | null = null;

function ensureTicker(): void {
	if (typeof window === 'undefined') return;
	if (ticker) return;
	timer.now = Date.now();
	ticker = setInterval(() => {
		timer.now = Date.now();
		tick();
	}, 250);
}

function tick(): void {
	const s = timer.session;
	if (!s) return;
	// 自然完成检测:投影为 null 且非暂停 → 完成
	if (s.endedAt === null && s.pausedAt === null && engine.projectSession(s, timer.now) === null) {
		complete('completed');
	}
}

export function currentView(): PhaseView | null {
	const s = timer.session;
	if (!s) return null;
	return engine.projectSession(s, timer.now);
}

function recordHistory(status: 'completed' | 'ended-early' | 'skipped'): void {
	const s = timer.session;
	if (!s) return;
	const entry: HistoryEntry = {
		id: crypto.randomUUID(),
		sessionId: s.id,
		kind: s.kind,
		startedAt: s.startedAt,
		endedAt: s.endedAt ?? timer.now,
		totalMs: engine.totalMs(s),
		activeMs: engine.activeMs(s),
		status
	};
	getDb()
		.history.add(entry)
		.catch(() => {});
}

function complete(recorded: 'completed' | 'ended-early' | 'skipped'): void {
	recordHistory(recorded);
	timer.celebrating = true;
	timer.completedAt = Date.now();
	ports.audioPort.play('cheer3');
	// 庆祝数秒后收尾,回到主页
	setTimeout(() => {
		timer.celebrating = false;
		timer.session = null;
		stopTicker();
	}, 3_500);
}

function stopTicker(): void {
	if (ticker) {
		clearInterval(ticker);
		ticker = null;
	}
}

export function startSession(kind: SessionKind, plan: TimerPlan): void {
	const now = Date.now();
	timer.session = engine.startSession({ id: crypto.randomUUID(), kind, plan, now });
	timer.skipped = false;
	timer.celebrating = false;
	timer.completedAt = null;
	timer.now = now;
	ensureTicker();
}

export function pause(): void {
	if (timer.session) {
		timer.session = engine.pause(timer.session, Date.now());
		ports.audioPort.stopAll();
	}
}

export function resume(): void {
	if (timer.session) timer.session = engine.resume(timer.session, Date.now());
}

export function skip(): void {
	if (!timer.session) return;
	timer.session = engine.skip(timer.session, Date.now());
	timer.skipped = true;
	// 跳过末段 → 引擎写入 endedAt,视作有跳段的收尾
	if (timer.session.endedAt !== null) {
		complete('skipped');
	}
}

export function end(): void {
	if (!timer.session) return;
	const s = engine.endSession(timer.session, Date.now());
	timer.session = s;
	complete(timer.skipped ? 'skipped' : 'ended-early');
}

/** 主页点按角色:短暂进入招呼态 */
export function greet(): void {
	timer.greeted = true;
	timer.greetUntil = Date.now() + 1_500;
	ports.audioPort.play('call');
	setTimeout(() => {
		if (Date.now() >= timer.greetUntil) timer.greeted = false;
	}, 1_500);
}

/** 提醒到点召唤:跳出来叫你(PRD §2.2) */
export function flashReminder(): void {
	timer.reminding = true;
	ports.audioPort.play('chime');
	setTimeout(() => {
		timer.reminding = false;
	}, 8_000);
}
