// core/reminders/rule.ts — 提醒规则纯函数。存「本地时刻」,时区与夏令时在函数内处理;
// 原生层(见 platform)只收绝对时刻,不理解规则语义(A0 §2.4)。
import { addDays, zonedEpoch, zonedParts } from '../tz.ts';

export type LocalTime = { hour: number; minute: number };
/** 0=周日 … 6=周六(Date.getDay 约定) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DayWindow = { start: LocalTime; end: LocalTime };

export type ReminderRule =
	| { kind: 'once'; at: number }
	| { kind: 'daily'; at: LocalTime }
	| { kind: 'weekly'; at: LocalTime; days: Weekday[] }
	| { kind: 'interval'; everyMs: number; window: DayWindow | null };

export type Reminder = {
	id: string;
	label: string;
	rule: ReminderRule;
	enabled: boolean;
};

/**
 * 规则在下一次触发(> from)的绝对时刻;永不再触发返回 null。
 * 同一规则以返回值推进光标即可单调取后续触发。
 */
export function nextTrigger(rule: ReminderRule, from: number, tz: string): number | null {
	if (rule.kind === 'once') return rule.at > from ? rule.at : null;

	if (rule.kind === 'interval') {
		if (!Number.isFinite(rule.everyMs) || rule.everyMs < 60_000) return null;
		if (!rule.window) {
			const grid = Math.ceil(from / rule.everyMs) * rule.everyMs;
			return grid > from ? grid : grid + rule.everyMs;
		}
		// 窗口内以每日窗口起点为格点锚
		const parts = zonedParts(from, tz);
		for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
			const date = addDays(parts, dayOffset);
			const startEpoch = zonedEpoch(tz, { ...date, ...rule.window.start });
			const endEpoch = zonedEpoch(tz, { ...date, ...rule.window.end });
			for (let t = startEpoch; t <= endEpoch; t += rule.everyMs) {
				if (t > from) return t;
			}
		}
		return null;
	}

	const parts = zonedParts(from, tz);
	if (rule.kind === 'daily') {
		for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
			const t = zonedEpoch(tz, { ...addDays(parts, dayOffset), ...rule.at });
			if (t > from) return t;
		}
		return null;
	}

	// weekly:从今天起 7 天内找第一个命中星期且晚于 from 的时刻
	for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
		const date = addDays(parts, dayOffset);
		const t = zonedEpoch(tz, { ...date, ...rule.at });
		if (t > from && rule.days.includes(zonedParts(t, tz).weekday as Weekday)) return t;
	}
	return null;
}
