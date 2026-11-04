// 把本地存下的计时会话还原成引擎能投影的 Session。坏数据丢掉,不猜。
import type { Phase, PomodoroPlan, QuickPlan, Segment, Session, SessionKind, TimerPlan, TrainingPlan } from '../timer/types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function phaseOf(value: unknown): Phase | null {
	if (value === 'prepare' || value === 'work' || value === 'rest' || value === 'long-rest') return value;
	return null;
}

function kindOf(value: unknown): SessionKind | null {
	if (value === 'training' || value === 'focus' || value === 'quick') return value;
	return null;
}

function planOf(value: unknown, kind: SessionKind): TimerPlan | null {
	if (!isRecord(value) || value.kind !== kind) return null;
	if (kind === 'quick') {
		const durationSec = num(value.durationSec);
		if (durationSec === null || durationSec <= 0) return null;
		const plan: QuickPlan = { kind: 'quick', durationSec };
		return plan;
	}
	if (kind === 'training') {
		const prepareSec = num(value.prepareSec);
		const workSec = num(value.workSec);
		const restSec = num(value.restSec);
		const rounds = num(value.rounds);
		if (prepareSec === null || workSec === null || restSec === null || rounds === null) return null;
		if (workSec <= 0 || restSec <= 0 || rounds < 1) return null;
		const plan: TrainingPlan = { kind: 'training', prepareSec, workSec, restSec, rounds };
		return plan;
	}
	const focusSec = num(value.focusSec);
	const shortRestSec = num(value.shortRestSec);
	const longRestSec = num(value.longRestSec);
	const longRestEvery = num(value.longRestEvery);
	const rounds = num(value.rounds);
	if (focusSec === null || shortRestSec === null || longRestSec === null || longRestEvery === null || rounds === null) return null;
	if (focusSec <= 0 || shortRestSec <= 0 || longRestSec <= 0 || longRestEvery < 1 || rounds < 1) return null;
	const plan: PomodoroPlan = { kind: 'focus', focusSec, shortRestSec, longRestSec, longRestEvery, rounds };
	return plan;
}

export function reviveSession(value: unknown): Session | null {
	if (!isRecord(value)) return null;
	const kind = kindOf(value.kind);
	if (!kind || typeof value.id !== 'string') return null;
	const startedAt = num(value.startedAt);
	if (startedAt === null) return null;
	const pausedAt = value.pausedAt === null ? null : num(value.pausedAt);
	const endedAt = value.endedAt === null ? null : num(value.endedAt);
	if (value.pausedAt !== null && pausedAt === null) return null;
	if (value.endedAt !== null && endedAt === null) return null;
	if (!Array.isArray(value.segments) || value.segments.length === 0) return null;
	const segments: Segment[] = [];
	for (const row of value.segments) {
		if (!isRecord(row)) return null;
		const phase = phaseOf(row.phase);
		const round = num(row.round);
		const rounds = num(row.rounds);
		const startAt = num(row.startAt);
		const endAt = num(row.endAt);
		if (!phase || round === null || rounds === null || startAt === null || endAt === null) return null;
		segments.push({ phase, round, rounds, startAt, endAt });
	}
	const plan = planOf(value.plan, kind);
	if (!plan) return null;
	return { id: value.id, kind, plan, startedAt, segments, pausedAt, endedAt };
}
