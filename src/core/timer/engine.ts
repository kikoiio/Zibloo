// core/timer/engine.ts — 计时纯函数。任何函数都不读钟、不写存储;now 一律由调用方注入。
import type {
	AlarmSpec,
	PhaseView,
	Session,
	SessionKind,
	Segment,
	TimerPlan
} from './types.ts';

export class PlanError extends Error {}

function assertPositive(sec: number, name: string): number {
	if (!Number.isFinite(sec) || sec <= 0) throw new PlanError(`${name} 必须为正数`);
	return sec;
}

export type SegmentDef = { phase: Segment['phase']; round: number; rounds: number; sec: number };

/** 按计划一次性展开全部段(相对时长);startSession 再加上绝对时间戳。 */
export function expandSegments(plan: TimerPlan): SegmentDef[] {
	const phases: SegmentDef[] = [];
	if (plan.kind === 'training') {
		assertPositive(plan.workSec, 'workSec');
		assertPositive(plan.restSec, 'restSec');
		if (!Number.isInteger(plan.rounds) || plan.rounds < 1) throw new PlanError('rounds 必须为正整数');
		const rounds = plan.rounds;
		if (plan.prepareSec > 0) phases.push({ phase: 'prepare', round: 1, rounds, sec: assertPositive(plan.prepareSec, 'prepareSec') });
		for (let r = 1; r <= rounds; r++) {
			phases.push({ phase: 'work', round: r, rounds, sec: plan.workSec });
			phases.push({ phase: 'rest', round: r, rounds, sec: plan.restSec });
		}
	} else if (plan.kind === 'focus') {
		assertPositive(plan.focusSec, 'focusSec');
		assertPositive(plan.shortRestSec, 'shortRestSec');
		assertPositive(plan.longRestSec, 'longRestSec');
		if (!Number.isInteger(plan.rounds) || plan.rounds < 1) throw new PlanError('rounds 必须为正整数');
		if (!Number.isInteger(plan.longRestEvery) || plan.longRestEvery < 1)
			throw new PlanError('longRestEvery 必须为正整数');
		for (let r = 1; r <= plan.rounds; r++) {
			phases.push({ phase: 'work', round: r, rounds: plan.rounds, sec: plan.focusSec });
			const long = r % plan.longRestEvery === 0;
			phases.push({
				phase: long ? 'long-rest' : 'rest',
				round: r,
				rounds: plan.rounds,
				sec: long ? plan.longRestSec : plan.shortRestSec
			});
		}
	} else {
		phases.push({ phase: 'work', round: 1, rounds: 1, sec: assertPositive(plan.durationSec, 'durationSec') });
	}
	return phases;
}

export function startSession(input: { id: string; kind: SessionKind; plan: TimerPlan; now: number }): Session {
	const defs = expandSegments(input.plan);
	let cursor = input.now;
	const segments: Segment[] = defs.map((d) => {
		const seg: Segment = { ...d, startAt: cursor, endAt: cursor + d.sec * 1000 };
		cursor = seg.endAt;
		return seg;
	});
	return {
		id: input.id,
		kind: input.kind,
		plan: input.plan,
		startedAt: input.now,
		segments,
		pausedAt: null,
		endedAt: null
	};
}

/** 纯投影:一次调用可跨越任意多段(后台 20 分钟回来仍正确);完成或已结束返回 null。 */
export function projectSession(s: Session, now: number): PhaseView | null {
	if (s.endedAt !== null) return null;
	const effectiveNow = s.pausedAt ?? now;
	// 二分查找第一个 endAt > effectiveNow 的段
	let lo = 0;
	let hi = s.segments.length - 1;
	let found = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (s.segments[mid].endAt > effectiveNow) {
			found = mid;
			hi = mid - 1;
		} else {
			lo = mid + 1;
		}
	}
	if (found === -1) return null; // 全部段已过 → 自然完成
	const seg = s.segments[found];
	const nextSeg = s.segments[found + 1];
	return {
		phase: seg.phase,
		round: seg.round,
		rounds: seg.rounds,
		remainMs: seg.endAt - effectiveNow,
		segmentIndex: found,
		next: nextSeg ? { phase: nextSeg.phase, durationSec: (nextSeg.endAt - nextSeg.startAt) / 1000 } : null
	};
}

export function pause(s: Session, now: number): Session {
	if (s.endedAt !== null || s.pausedAt !== null) return s;
	return { ...s, pausedAt: now };
}

/**
 * 恢复 = 把晚于暂停锚点的段边界整体平移 offset。
 * 进行中段的 startAt 保持不动(暂停前的活跃墙钟时间必须留在时间线上,供 activeMs 推导);
 * 未来段整体平移,时间线保持连续。
 */
export function resume(s: Session, now: number): Session {
	if (s.endedAt !== null || s.pausedAt === null) return s;
	const anchor = s.pausedAt;
	const offset = now - anchor;
	const segments = s.segments.map((seg) => {
		if (seg.endAt <= anchor) return seg;
		return {
			...seg,
			startAt: seg.startAt < anchor ? seg.startAt : seg.startAt + offset,
			endAt: seg.endAt + offset
		};
	});
	return { ...s, segments, pausedAt: null };
}

/** 跳过当前段:截断到当前时刻,并把后续段前移保持连续;跳过末段即结束。 */
export function skip(s: Session, now: number): Session {
	if (s.endedAt !== null) return s;
	const effectiveNow = s.pausedAt ?? now;
	const index = s.segments.findIndex((seg) => seg.endAt > effectiveNow);
	if (index === -1) return endSession(s, effectiveNow);
	const current = s.segments[index];
	const shift = current.endAt - effectiveNow;
	const segments = s.segments.map((seg, i) => {
		if (i < index) return seg;
		if (i === index) return { ...seg, endAt: effectiveNow };
		return { ...seg, startAt: seg.startAt - shift, endAt: seg.endAt - shift };
	});
	if (index === s.segments.length - 1) return { ...s, segments, endedAt: effectiveNow };
	return { ...s, segments };
}

/** 显式结束(用户按「结束」);完成度由消费掉的时长占比得出,见 activeMs。 */
export function endSession(s: Session, now: number): Session {
	if (s.endedAt !== null) return s;
	const effectiveNow = s.pausedAt ?? now;
	return { ...s, endedAt: effectiveNow };
}

/** 尚未消费的活跃时长。now 缺省时:已结束取 endedAt,暂停取锚点,运行中取当下。 */
export function remainingMs(s: Session, now: number = Number.POSITIVE_INFINITY): number {
	const effectiveNow = s.endedAt ?? s.pausedAt ?? now;
	const last = s.segments.at(-1)!;
	if (effectiveNow >= last.endAt) return 0;
	if (effectiveNow <= s.segments[0].startAt) return totalMs(s);
	let rem = 0;
	for (const seg of s.segments) {
		if (seg.endAt <= effectiveNow) continue; // 已过去
		rem += seg.startAt >= effectiveNow ? seg.endAt - seg.startAt : seg.endAt - effectiveNow;
	}
	return rem;
}

/** 已消费的活跃时长(不含暂停)= 总时长 - 剩余。 */
export function activeMs(s: Session, now: number = Number.POSITIVE_INFINITY): number {
	return totalMs(s) - remainingMs(s, now);
}

/** 计划总时长(活跃,不含暂停)。由 plan 推导,对暂停/恢复不变。 */
export function totalMs(s: Session): number {
	return expandSegments(s.plan).reduce((acc, d) => acc + d.sec * 1000, 0);
}

/** 段边界兜底闹钟:每个段尾一个;末段边界即完成。暂停/恢复后须重算。 */
export function planSessionAlarms(s: Session): AlarmSpec[] {
	if (s.endedAt !== null) return [];
	return s.segments.map((seg, i) => ({
		sessionId: s.id,
		at: seg.endAt,
		kind: i === s.segments.length - 1 ? 'complete' : 'phase',
		toPhase: s.segments[i + 1]?.phase ?? 'work'
	}));
}
