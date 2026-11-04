// state/timer.svelte.ts — 当前会话状态与唯一副作用编排点:
// 引擎(纯) → 这里 → Dexie / 端口 / UI。
// 计时提示音消费 mapZibloo 的输出(唯一映射表)。
import * as engine from '../core/timer/engine.ts';
import type { Session, SessionKind, TimerPlan, PhaseView } from '../core/timer/types.ts';
import type { HistoryEntry } from '../core/history/history.ts';
import { mapZibloo, type ZiblooPresentation } from '../core/zibloo/mapping.ts';
import { getDb } from '../persistence/db.ts';
import { ports } from './ports.svelte.ts';
import { settings } from './settings.svelte.ts';

export const timer: {
	session: Session | null;
	now: number;
	skipped: boolean;
	celebrating: boolean;
	greeted: boolean;
	greetUntil: number;
	completedAt: number | null;
} = $state({
	session: null,
	now: 0,
	skipped: false,
	celebrating: false,
	greeted: false,
	greetUntil: 0,
	completedAt: null
});

let ticker: ReturnType<typeof setInterval> | null = null;
let lastFiredSegment = -1;

export function currentView(): PhaseView | null {
	const s = timer.session;
	if (!s) return null;
	return engine.projectSession(s, timer.now);
}

/** 单一呈现源:主页与运行页都消费这一份,不再各自推导。 */
export function currentPresentation(): ZiblooPresentation {
	return mapZibloo({
		activity: timer.session?.kind ?? 'none',
		view: currentView(),
		paused: timer.session !== null && timer.session.pausedAt !== null,
		celebrating: timer.celebrating,
		greeted: timer.greeted,
		reducedMotion: settings.reducedMotion
	});
}

function webVisible(): boolean {
	return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** 段边界副作用:页面可见时播放提示音。 */
function handleBoundaries(): void {
	const s = timer.session;
	if (!s) return;
	const v = currentView();
	if (!v || v.segmentIndex === lastFiredSegment) return;
	lastFiredSegment = v.segmentIndex;
	const presentation = currentPresentation();
	if (presentation.cue && webVisible()) {
		ports.audioPort.play(presentation.cue);
	}
}

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
		return;
	}
	handleBoundaries();
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
	lastFiredSegment = -1;
	if (webVisible()) ports.audioPort.play('complete');
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
	lastFiredSegment = -1;
	handleBoundaries();
	ensureTicker();
}

export function pause(): void {
	if (timer.session) {
		timer.session = engine.pause(timer.session, Date.now());
		ports.audioPort.stopAll();
	}
}

export function resume(): void {
	if (timer.session) {
		timer.session = engine.resume(timer.session, Date.now());
		lastFiredSegment = -1;
	}
}

export function skip(): void {
	if (!timer.session) return;
	timer.session = engine.skip(timer.session, Date.now());
	timer.skipped = true;
	// 跳过末段 → 引擎写入 endedAt,视作有跳段的收尾
	if (timer.session.endedAt !== null) {
		complete('skipped');
		return;
	}
	lastFiredSegment = -1;
	handleBoundaries();
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
	ports.audioPort.play('greet');
	setTimeout(() => {
		if (Date.now() >= timer.greetUntil) timer.greeted = false;
	}, 1_500);
}
