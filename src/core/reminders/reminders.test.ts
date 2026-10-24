import { describe, expect, it } from 'vitest';
import { nextTrigger, type Reminder, type ReminderRule, type Weekday } from './rule.ts';
import { planAlarms } from './plan.ts';

const D = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);

describe('nextTrigger: once', () => {
	const rule: ReminderRule = { kind: 'once', at: D(2026, 10, 25, 8) };
	it('未来触发一次,过去为 null', () => {
		expect(nextTrigger(rule, D(2026, 10, 24), 'UTC')).toBe(D(2026, 10, 25, 8));
		expect(nextTrigger(rule, D(2026, 10, 25, 8), 'UTC')).toBeNull();
		expect(nextTrigger(rule, D(2027, 1, 1), 'UTC')).toBeNull();
	});
});

describe('nextTrigger: daily', () => {
	const rule: ReminderRule = { kind: 'daily', at: { hour: 8, minute: 30 } };
	it('UTC:今天未到取今天,已过取明天', () => {
		expect(nextTrigger(rule, D(2026, 10, 24, 8, 29), 'UTC')).toBe(D(2026, 10, 24, 8, 30));
		expect(nextTrigger(rule, D(2026, 10, 24, 8, 30), 'UTC')).toBe(D(2026, 10, 25, 8, 30));
	});

	it('东八区按本地墙上时刻', () => {
		// 08:30 CST = 00:30 UTC
		expect(nextTrigger(rule, D(2026, 10, 24, 0, 0), 'Asia/Shanghai')).toBe(D(2026, 10, 24, 0, 30));
		expect(nextTrigger(rule, D(2026, 10, 24, 0, 31), 'Asia/Shanghai')).toBe(D(2026, 10, 25, 0, 30));
	});

	it('夏令时缺口(不存在的本地时刻)落在当日且次日恢复正常', () => {
		// America/New_York 2027-03-14 02:00→03:00,02:30 不存在
		const rule230: ReminderRule = { kind: 'daily', at: { hour: 2, minute: 30 } };
		const t = nextTrigger(rule230, D(2027, 3, 13, 12), 'America/New_York')!;
		const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
			.formatToParts(new Date(t))
			.reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
		expect(Number(parts.month)).toBe(3);
		expect(Number(parts.day)).toBe(14);
		// 次日 02:30 存在,精确等于 02:30 EDT(= 06:30 UTC)
		const t2 = nextTrigger(rule230, t, 'America/New_York')!;
		expect(t2).toBe(D(2027, 3, 15, 6, 30));
	});
});

describe('nextTrigger: weekly', () => {
	// 2026-10-24 是周六
	const rule: ReminderRule = { kind: 'weekly', at: { hour: 19, minute: 0 }, days: [1, 3, 5] };
	it('从周六找下一个周一 19:00(本地 UTC)', () => {
		expect(nextTrigger(rule, D(2026, 10, 24, 10), 'UTC')).toBe(D(2026, 10, 26, 19));
		// 周一 19:01 → 下一个是周三
		expect(nextTrigger(rule, D(2026, 10, 26, 19, 1), 'UTC')).toBe(D(2026, 10, 28, 19));
	});

	it('空 days 永不触发', () => {
		expect(nextTrigger({ kind: 'weekly', at: { hour: 9, minute: 0 }, days: [] }, D(2026, 10, 24), 'UTC')).toBeNull();
	});
});

describe('nextTrigger: interval', () => {
	it('无窗口:epoch 网格', () => {
		const rule: ReminderRule = { kind: 'interval', everyMs: 3_600_000, window: null };
		expect(nextTrigger(rule, D(2026, 10, 24, 0, 1), 'UTC')).toBe(D(2026, 10, 24, 1));
	});

	it('带窗口:格点锚在每日窗口起点,窗口外顺延到次日', () => {
		const rule: ReminderRule = {
			kind: 'interval',
			everyMs: 7_200_000,
			window: { start: { hour: 9, minute: 0 }, end: { hour: 21, minute: 0 } }
		};
		// 10:30 → 11:00(9:00 + 2h)
		expect(nextTrigger(rule, D(2026, 10, 24, 10, 30), 'UTC')).toBe(D(2026, 10, 24, 11));
		// 窗口末尾 21:00 仍是有效格点,但 22:00 之后 → 次日 09:00
		expect(nextTrigger(rule, D(2026, 10, 24, 22), 'UTC')).toBe(D(2026, 10, 25, 9));
	});

	it('间隔小于 1 分钟无效', () => {
		expect(nextTrigger({ kind: 'interval', everyMs: 30_000, window: null }, D(2026, 10, 24), 'UTC')).toBeNull();
	});
});

describe('planAlarms', () => {
	it('过滤未启用,展开 perRule 次,按时间排序', () => {
		const reminders = [
			{ id: 'a', label: '喝水', enabled: true, rule: { kind: 'interval', everyMs: 3_600_000, window: null } as const },
			{ id: 'b', label: '吃药', enabled: false, rule: { kind: 'daily', at: { hour: 8, minute: 0 } } as const }
		];
		const { alarms, unschedulable } = planAlarms(reminders, D(2026, 10, 24, 0, 1), 'UTC', { perRule: 3 });
		expect(unschedulable).toEqual([]);
		expect(alarms).toHaveLength(3);
		expect(alarms[0].label).toBe('喝水');
		expect(alarms[0].at).toBeLessThan(alarms[1].at);
		expect(alarms[1].at).toBeLessThan(alarms[2].at);
		expect(alarms[0].reminderId).toBe('a');
	});

	it('已过期的一次性提醒进入 unschedulable(pastOnce),不静默丢弃', () => {
		const reminders = [{ id: 'x', label: '过期', enabled: true, rule: { kind: 'once', at: D(2026, 10, 1) } as const }];
		const { alarms, unschedulable } = planAlarms(reminders, D(2026, 10, 24), 'UTC');
		expect(alarms).toEqual([]);
		expect(unschedulable).toEqual([{ id: 'x', reason: 'pastOnce' }]);
	});

	it('无法展开的规则进入 unschedulable(invalidRule)', () => {
		const reminders: Reminder[] = [{ id: 'y', label: '空周', enabled: true, rule: { kind: 'weekly', at: { hour: 9, minute: 0 }, days: [] } }];
		const { unschedulable } = planAlarms(reminders, D(2026, 10, 24), 'UTC');
		expect(unschedulable).toEqual([{ id: 'y', reason: 'invalidRule' }]);
	});
});
