// 看板上的多张计时。每张卡最多一段会话,多张可以同时走。
// 剩余时间仍由引擎从锚点推导。
import * as engine from '../core/timer/engine.ts';
import { reviveSession } from '../core/board/session.ts';
import type { HistoryEntry, HistoryStatus } from '../core/history/history.ts';
import type { Session, SessionKind, TimerPlan } from '../core/timer/types.ts';
import { mapZibloo, type ZiblooPresentation } from '../core/zibloo/mapping.ts';
import { getDb } from '../persistence/db.ts';
import { ports } from './ports.svelte.ts';
import { settings } from './settings.svelte.ts';
import { t } from './i18n.svelte.ts';
import { timer } from './timer.svelte.ts';
import type { MessageKey } from '../i18n/messages.ts';

const STORAGE_KEY = 'zibloo.runs.v1';

type Run = {
	cardId: string;
	session: Session;
	skipped: boolean;
	lastFiredSegment: number;
	startedOrder: number;
};

export const runs: {
	now: number;
	items: Run[];
	celebratingId: string | null;
} = $state({
	now: 0,
	items: [],
	celebratingId: null
});

let loaded = false;
let order = 1;
let ticker: ReturnType<typeof setInterval> | null = null;
let visibilityWired = false;
let celebrateTimer: ReturnType<typeof setTimeout> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function persist(): void {
	if (typeof localStorage === 'undefined') return;
	const payload = runs.items.map((run) => ({
		cardId: run.cardId,
		session: run.session,
		skipped: run.skipped,
		lastFiredSegment: run.lastFiredSegment,
		startedOrder: run.startedOrder
	}));
	localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadRuns(): void {
	if (loaded || typeof localStorage === 'undefined') return;
	loaded = true;
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		if (!Array.isArray(raw)) return;
		const restored: Run[] = [];
		for (const row of raw) {
			if (!isRecord(row) || typeof row.cardId !== 'string') continue;
			const session = reviveSession(row.session);
			if (!session || session.endedAt !== null) continue;
			restored.push({
				cardId: row.cardId,
				session,
				skipped: row.skipped === true,
				lastFiredSegment: typeof row.lastFiredSegment === 'number' ? row.lastFiredSegment : -1,
				startedOrder: typeof row.startedOrder === 'number' ? row.startedOrder : order++
			});
		}
		runs.items = restored;
		order = restored.reduce((max, run) => Math.max(max, run.startedOrder), 0) + 1;
		if (restored.length > 0) {
			runs.now = Date.now();
			ensureTicker();
			syncTimerAlarms();
		}
	} catch {
		runs.items = [];
	}
}

function webVisible(): boolean {
	return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function wireVisibility(): void {
	if (visibilityWired || typeof document === 'undefined') return;
	visibilityWired = true;
	ports.alarmPort.setWebVisible(document.visibilityState === 'visible');
	document.addEventListener('visibilitychange', () => {
		ports.alarmPort.setWebVisible(document.visibilityState === 'visible');
	});
}

function ensureTicker(): void {
	if (typeof window === 'undefined') return;
	wireVisibility();
	if (ticker) return;
	runs.now = Date.now();
	ticker = setInterval(() => {
		runs.now = Date.now();
		tick();
	}, 250);
}

function stopTickerIfIdle(): void {
	if (runs.items.length > 0) return;
	if (ticker) {
		clearInterval(ticker);
		ticker = null;
	}
	ports.foregroundPort.hideTimer();
	void ports.alarmPort.syncTimerAlarms([]);
}

function activeRuns(): Run[] {
	return runs.items.filter((run) => run.session.endedAt === null);
}

function syncTimerAlarms(): void {
	const voice = settings.voice;
	const now = Date.now();
	const alarms = activeRuns().flatMap((run) => {
		const session = run.session;
		if (session.pausedAt !== null) return [];
		return engine.planSessionAlarms(session, now).map((alarm, index) => {
			const cue = alarm.kind === 'complete' ? 'complete' : alarm.toPhase === 'work' ? 'work' : 'rest';
			const bodyKey: MessageKey =
				alarm.kind === 'complete' ? 'zibloo.notif.complete.body' : cue === 'work' ? 'notif.phase.work' : 'notif.phase.rest';
			return {
				id: `${session.id}:${index}`,
				at: alarm.at,
				title: t('app.name'),
				body: t(bodyKey),
				soundRes: `${voice}_${cue}`
			};
		});
	});
	void ports.alarmPort.syncTimerAlarms(alarms);
	const running = activeRuns().filter((run) => run.session.pausedAt === null);
	if (running.length === 0) {
		ports.foregroundPort.hideTimer();
		return;
	}
	const latest = running.reduce((a, b) => (a.startedOrder >= b.startedOrder ? a : b));
	const kindTitle: MessageKey =
		latest.session.kind === 'training'
			? 'zibloo.notif.training.title'
			: latest.session.kind === 'focus'
				? 'zibloo.notif.focus.title'
				: 'zibloo.notif.quick.title';
	const kindBody: MessageKey =
		latest.session.kind === 'training'
			? 'zibloo.notif.training.body'
			: latest.session.kind === 'focus'
				? 'zibloo.notif.focus.body'
				: 'zibloo.notif.quick.body';
	ports.foregroundPort.showTimer(
		t(kindTitle),
		running.length === 1 ? t(kindBody) : t('board.runningMany', { n: running.length })
	);
}

function cueFor(run: Run): void {
	const view = engine.projectSession(run.session, runs.now);
	if (!view || view.segmentIndex === run.lastFiredSegment) return;
	run.lastFiredSegment = view.segmentIndex;
	if (!webVisible()) return;
	const phase = view.phase;
	const cue = phase === 'work' ? 'work' : phase === 'prepare' ? null : 'rest';
	if (cue) ports.audioPort.play(cue);
}

function tick(): void {
	for (const run of [...runs.items]) {
		const session = run.session;
		if (session.endedAt !== null || session.pausedAt !== null) continue;
		if (engine.projectSession(session, runs.now) === null) {
			finish(run.cardId, run.skipped ? 'skipped' : 'completed');
			continue;
		}
		cueFor(run);
	}
}

function recordHistory(session: Session, status: HistoryStatus): void {
	const entry: HistoryEntry = {
		id: crypto.randomUUID(),
		sessionId: session.id,
		kind: session.kind,
		startedAt: session.startedAt,
		endedAt: session.endedAt ?? runs.now,
		totalMs: engine.totalMs(session),
		activeMs: engine.activeMs(session, runs.now),
		status
	};
	getDb()
		.history.add(entry)
		.catch(() => {});
}

function finish(cardId: string, status: HistoryStatus): void {
	const run = runs.items.find((item) => item.cardId === cardId);
	if (!run) return;
	recordHistory(run.session, status);
	runs.items = runs.items.filter((item) => item.cardId !== cardId);
	runs.celebratingId = cardId;
	if (webVisible()) ports.audioPort.play('complete');
	persist();
	syncTimerAlarms();
	stopTickerIfIdle();
	if (celebrateTimer) clearTimeout(celebrateTimer);
	celebrateTimer = setTimeout(() => {
		if (runs.celebratingId === cardId) runs.celebratingId = null;
	}, 3_500);
}

export function startCardRun(input: { cardId: string; kind: SessionKind; plan: TimerPlan }): void {
	loadRuns();
	const now = Date.now();
	const previous = runs.items.find((item) => item.cardId === input.cardId);
	if (previous) finish(input.cardId, previous.skipped ? 'skipped' : 'ended-early');
	const session = engine.startSession({ id: crypto.randomUUID(), kind: input.kind, plan: input.plan, now });
	const run: Run = { cardId: input.cardId, session, skipped: false, lastFiredSegment: -1, startedOrder: order++ };
	runs.items = [...runs.items.filter((item) => item.cardId !== input.cardId), run];
	runs.now = now;
	runs.celebratingId = null;
	ensureTicker();
	cueFor(run);
	syncTimerAlarms();
	persist();
}

export function pauseCard(cardId: string): void {
	const run = runs.items.find((item) => item.cardId === cardId);
	if (!run) return;
	run.session = engine.pause(run.session, Date.now());
	ports.audioPort.stopAll();
	syncTimerAlarms();
	persist();
}

export function resumeCard(cardId: string): void {
	const run = runs.items.find((item) => item.cardId === cardId);
	if (!run) return;
	run.session = engine.resume(run.session, Date.now());
	run.lastFiredSegment = -1;
	syncTimerAlarms();
	cueFor(run);
	persist();
}

export function skipCard(cardId: string): void {
	const run = runs.items.find((item) => item.cardId === cardId);
	if (!run) return;
	run.session = engine.skip(run.session, Date.now());
	run.skipped = true;
	if (run.session.endedAt !== null) {
		finish(cardId, 'skipped');
		return;
	}
	run.lastFiredSegment = -1;
	syncTimerAlarms();
	cueFor(run);
	persist();
}

export function endCard(cardId: string): void {
	const run = runs.items.find((item) => item.cardId === cardId);
	if (!run) return;
	run.session = engine.endSession(run.session, Date.now());
	finish(cardId, run.skipped ? 'skipped' : 'ended-early');
}

export function runFor(cardId: string): Run | null {
	return runs.items.find((item) => item.cardId === cardId) ?? null;
}

/** 章鱼跟最近开始的那张卡。多张同时跑时,每张卡自己显示倒计时。 */
export function boardPresentation(): ZiblooPresentation {
	const active = activeRuns();
	const latest = active.reduce<Run | null>((picked, run) => {
		if (!picked || run.startedOrder >= picked.startedOrder) return run;
		return picked;
	}, null);
	const view = latest ? engine.projectSession(latest.session, runs.now) : null;
	return mapZibloo({
		activity: latest?.session.kind ?? 'none',
		view,
		paused: latest !== null && latest.session.pausedAt !== null,
		celebrating: runs.celebratingId !== null,
		greeted: timer.greeted,
		reducedMotion: settings.reducedMotion
	});
}
