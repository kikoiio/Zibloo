import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
	activeMs,
	endSession,
	expandSegments,
	planSessionAlarms,
	pause,
	projectSession,
	resume,
	skip,
	startSession,
	totalMs,
	PlanError
} from './engine.ts';
import type { PomodoroPlan, QuickPlan, Session, SessionKind, TimerPlan, TrainingPlan } from './types.ts';

const T0 = 1_700_000_000_000;

const plans = {
	training: {
		kind: 'training',
		prepareSec: 10,
		workSec: 30,
		restSec: 15,
		rounds: 8
	} satisfies TrainingPlan as TrainingPlan,
	focus: {
		kind: 'focus',
		focusSec: 1500,
		shortRestSec: 300,
		longRestSec: 900,
		longRestEvery: 4,
		rounds: 4
	} satisfies PomodoroPlan as PomodoroPlan,
	quick: { kind: 'quick', durationSec: 300 } satisfies QuickPlan as QuickPlan
};

function phasesOf(s: Session): string[] {
	return s.segments.map((seg) => seg.phase);
}

describe('expandSegments / startSession', () => {
	it('training: prepare + rounds×(work,rest),首尾相接', () => {
		const s = startSession({ id: 's1', kind: 'training', plan: plans.training, now: T0 });
		expect(phasesOf(s)).toEqual([
			'prepare',
			'work', 'rest',
			'work', 'rest',
			'work', 'rest',
			'work', 'rest',
			'work', 'rest',
			'work', 'rest',
			'work', 'rest',
			'work', 'rest'
		]);
		for (let i = 1; i < s.segments.length; i++) {
			expect(s.segments[i].startAt).toBe(s.segments[i - 1].endAt);
		}
		expect(s.segments[0].startAt).toBe(T0);
		expect(s.segments[1].round).toBe(1);
		expect(s.segments[3].round).toBe(2);
	});

	it('focus: 每 longRestEvery 个专注段进入长休息', () => {
		const s = startSession({ id: 's2', kind: 'focus', plan: plans.focus, now: T0 });
		expect(phasesOf(s)).toEqual(['work', 'rest', 'work', 'rest', 'work', 'rest', 'work', 'long-rest']);
		const swapped = startSession({
			id: 's3',
			kind: 'focus',
			plan: { ...plans.focus, longRestEvery: 2, rounds: 2 },
			now: T0
		});
		// 每 2 个番茄进长休息:第 1 个后短休息,第 2 个后长休息
		expect(phasesOf(swapped)).toEqual(['work', 'rest', 'work', 'long-rest']);
	});

	it('quick: 单段 work', () => {
		const s = startSession({ id: 's4', kind: 'quick', plan: plans.quick, now: T0 });
		expect(s.segments).toHaveLength(1);
		expect(s.segments[0]).toMatchObject({ phase: 'work', round: 1, rounds: 1, startAt: T0, endAt: T0 + 300_000 });
	});

	it('非法计划抛 PlanError', () => {
		expect(() => expandSegments({ kind: 'quick', durationSec: 0 })).toThrow(PlanError);
		expect(() => expandSegments({ kind: 'training', prepareSec: 0, workSec: 30, restSec: -1, rounds: 2 })).toThrow(PlanError);
		expect(() => expandSegments({ kind: 'focus', focusSec: 1, shortRestSec: 1, longRestSec: 1, longRestEvery: 0, rounds: 1 })).toThrow(PlanError);
	});
});

describe('projectSession', () => {
	it('推导剩余时间,一次投影可跨多段(后台回来)', () => {
		const s = startSession({ id: 's1', kind: 'training', plan: plans.training, now: T0 });
		const v = projectSession(s, T0 + 5_000)!;
		expect(v.phase).toBe('prepare');
		expect(v.remainMs).toBe(5_000);

		// prepare 10s + 8×(30+15)s = 370s;跳到 60s 处:第 2 个 work(work 起于 10+45=55s)
		const v2 = projectSession(s, T0 + 60_000)!;
		expect(v2.phase).toBe('work');
		expect(v2.round).toBe(2);
		expect(v2.remainMs).toBe(25_000);
		expect(v2.next).toEqual({ phase: 'rest', durationSec: 15 });

		// 跨到结尾之后
		expect(projectSession(s, T0 + 370_000)).toBeNull();
	});

	it('暂停时投影冻结在暂停锚点', () => {
		let s = startSession({ id: 's5', kind: 'quick', plan: plans.quick, now: T0 });
		s = pause(s, T0 + 100_000);
		// 暂停后无论过多久,投影不变
		expect(projectSession(s, T0 + 100_000)!.remainMs).toBe(200_000);
		expect(projectSession(s, T0 + 999_999)!.remainMs).toBe(200_000);
	});

	it('endedAt 后投影为 null', () => {
		let s = startSession({ id: 's6', kind: 'quick', plan: plans.quick, now: T0 });
		s = endSession(s, T0 + 1_000);
		expect(projectSession(s, T0 + 2_000)).toBeNull();
	});
});

describe('pause / resume', () => {
	it('恢复 = 整体平移,完成时刻恰好推迟暂停时长', () => {
		let s = startSession({ id: 's7', kind: 'quick', plan: plans.quick, now: T0 });
		const virtualEnd0 = s.segments[0].endAt;
		s = pause(s, T0 + 100_000);
		s = resume(s, T0 + 160_000);
		expect(s.pausedAt).toBeNull();
		expect(s.segments[0].endAt).toBe(virtualEnd0 + 60_000);
		expect(projectSession(s, T0 + 160_000)!.remainMs).toBe(200_000);
	});

	it('暂停中恢复到锚点之前(时钟回拨)不做负平移造成错乱', () => {
		let s = startSession({ id: 's8', kind: 'quick', plan: plans.quick, now: T0 });
		s = pause(s, T0 + 100_000);
		s = resume(s, T0 + 50_000); // offset 为负:段整体提前,剩余时间按锚点冻结值恢复
		const v = projectSession(s, T0 + 50_000)!;
		expect(v.remainMs).toBe(200_000);
	});

	it('幂等:重复 pause / 对未暂停 resume 原样返回', () => {
		let s = startSession({ id: 's9', kind: 'quick', plan: plans.quick, now: T0 });
		s = pause(s, T0);
		const twice = pause(s, T0 + 5_000);
		expect(twice.pausedAt).toBe(T0);
		const r = resume(s, T0 + 5_000);
		expect(r.segments[0].endAt).toBe(T0 + 300_000 + 5_000);
	});
});

describe('skip / end', () => {
	it('跳段:立即进入下一段且时间线保持连续', () => {
		let s = startSession({ id: 's10', kind: 'training', plan: plans.training, now: T0 });
		s = skip(s, T0 + 105_000); // 105s 处于第 3 组 work(100–130s)
		const v = projectSession(s, T0 + 105_000)!;
		for (let i = 1; i < s.segments.length; i++) {
			expect(s.segments[i].startAt).toBe(s.segments[i - 1].endAt);
		}
		expect(v.remainMs).toBe(s.segments[v.segmentIndex].endAt - (T0 + 105_000));
	});

	it('跳过当前段后,下一段从当前时刻开始、保持原时长', () => {
		const plan: TimerPlan = { kind: 'training', prepareSec: 0, workSec: 30, restSec: 15, rounds: 2 };
		let s = startSession({ id: 's11', kind: 'training', plan, now: T0 });
		s = skip(s, T0 + 5_000); // work 第 5 秒跳过
		const v = projectSession(s, T0 + 5_000)!;
		expect(v.phase).toBe('rest');
		expect(v.round).toBe(1);
		expect(v.remainMs).toBe(15_000);
		// 后续全部前移 25s
		expect(s.segments.at(-1)!.endAt).toBe(T0 + 90_000 - 25_000);
	});

	it('跳过末段即结束并写入 endedAt', () => {
		let s = startSession({ id: 's12', kind: 'quick', plan: plans.quick, now: T0 });
		s = skip(s, T0 + 10_000);
		expect(s.endedAt).toBe(T0 + 10_000);
		expect(projectSession(s, T0 + 11_000)).toBeNull();
	});

	it('endSession 幂等', () => {
		let s = startSession({ id: 's13', kind: 'quick', plan: plans.quick, now: T0 });
		s = endSession(s, T0 + 5_000);
		expect(endSession(s, T0 + 50_000).endedAt).toBe(T0 + 5_000);
	});
});

describe('activeMs / totalMs', () => {
	it('activeMs 排除暂停时段,endSession 后封顶', () => {
		let s = startSession({ id: 's14', kind: 'quick', plan: plans.quick, now: T0 });
		s = pause(s, T0 + 100_000);
		expect(activeMs(s)).toBe(100_000);
		s = resume(s, T0 + 160_000);
		// 恰好在恢复时刻查询:暂停期不计入,活跃消耗仍为 100s
		expect(activeMs(s, T0 + 160_000)).toBe(100_000);
		const done = endSession(s, T0 + 170_000);
		expect(activeMs(done)).toBe(110_000);
		expect(totalMs(done)).toBe(300_000);
	});
});

describe('planSessionAlarms', () => {
	it('每段尾一个,末段为 complete', () => {
		const s = startSession({ id: 's15', kind: 'focus', plan: plans.focus, now: T0 });
		const alarms = planSessionAlarms(s);
		expect(alarms).toHaveLength(8);
		expect(alarms.at(-1)).toMatchObject({ kind: 'complete', at: s.segments.at(-1)!.endAt });
		expect(alarms[0]).toMatchObject({ kind: 'phase', toPhase: 'rest', at: s.segments[0].endAt });
		const ended = endSession(s, T0 + 1);
		expect(planSessionAlarms(ended)).toHaveLength(0);
	});
});

describe('属性:任意暂停/恢复序列零漂移', () => {
	it('暂停/恢复不改变总时长,虚拟完成时刻 = 起点 + 活跃总时长 + 累计暂停', () => {
		const tc = fc.tuple(
			fc.constantFrom(...([30, 45, 60] as const)),
			fc.array(fc.tuple(fc.integer({ min: 1, max: 20_000 }), fc.integer({ min: 1, max: 10_000 })), { maxLength: 12 })
		);

		fc.assert(
			fc.property(tc, ([dur, pauses]) => {
				const plan: TimerPlan = { kind: 'quick', durationSec: dur };
				let s = startSession({ id: 'p', kind: 'quick', plan, now: T0 });
				const base = totalMs(s);
				let cursor = T0;
				let pausedTotal = 0;

				for (const [active, pausedFor] of pauses) {
					cursor += active;
					if (cursor >= T0 + base) break;
					s = pause(s, cursor);
					cursor += pausedFor;
					pausedTotal += pausedFor;
					s = resume(s, cursor);
					// 不变式:总时长不变
					expect(totalMs(s)).toBe(base);
					// 不变式:剩余时间与朴素模型一致
					const elapsedActive = cursor - T0 - pausedTotal;
					const naiveRemain = Math.max(0, base - elapsedActive);
					const v = projectSession(s, cursor);
					if (naiveRemain === 0) {
						expect(v).toBeNull();
					} else {
						expect(v!.remainMs).toBe(naiveRemain);
					}
				}
				// 完成时刻 = 起点 + 活跃总时长 + 累计暂停
				expect(s.segments.at(-1)!.endAt).toBe(T0 + base + pausedTotal);
			}),
			{ numRuns: 200 }
		);
	});

	it('任意时刻单次投影与逐段推进一致(后台跨越任意多段)', () => {
		const plan: TimerPlan = { kind: 'training', prepareSec: 5, workSec: 10, restSec: 7, rounds: 6 };
		const total = (5 + 6 * (10 + 7)) * 1000;
		fc.assert(
			fc.property(fc.integer({ min: 0, max: total + 60_000 }), (jump) => {
				const s = startSession({ id: 'bg', kind: 'training', plan, now: T0 });
				const v = projectSession(s, T0 + jump);
				// 朴素扫描实现
				const seg = s.segments.find((x) => x.endAt > T0 + jump);
				if (!seg) expect(v).toBeNull();
				else {
					expect(v!.phase).toBe(seg.phase);
					expect(v!.remainMs).toBe(seg.endAt - (T0 + jump));
					expect(v!.segmentIndex).toBe(s.segments.indexOf(seg));
				}
			}),
			{ numRuns: 300 }
		);
	});
});
