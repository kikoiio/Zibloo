// core/reminders/plan.ts — 规则集 → 期望闹钟集合(纯)。规则表是唯一事实源,
// 原生调度只是它的投影;不一致时以规则表重排(A0 §2.2)。
import type { Reminder } from './rule.ts';
import { nextTrigger } from './rule.ts';

export type PlannedAlarm = {
	reminderId: string;
	at: number;
	/** 用户可见文本;标题用规则自带 label,不做翻译(core 保持纯) */
	label: string;
};

export type UnschedulableReason = 'pastOnce' | 'invalidRule';

export type PlanResult = {
	alarms: PlannedAlarm[];
	unschedulable: { id: string; reason: UnschedulableReason }[];
};

export type PlanOptions = {
	/** 每条规则向前展开多少次触发(默认 1,到点后重排即可滚动) */
	perRule?: number;
	/** 只保留 from 之后 horizonMs 内的触发 */
	horizonMs?: number;
};

export function planAlarms(reminders: readonly Reminder[], from: number, tz: string, opts: PlanOptions = {}): PlanResult {
	const perRule = opts.perRule ?? 1;
	const horizon = opts.horizonMs ?? Number.POSITIVE_INFINITY;
	const alarms: PlannedAlarm[] = [];
	const unschedulable: PlanResult['unschedulable'] = [];

	for (const reminder of reminders) {
		if (!reminder.enabled) continue;
		if (reminder.rule.kind === 'once' && reminder.rule.at <= from) {
			unschedulable.push({ id: reminder.id, reason: 'pastOnce' });
			continue;
		}
		const times: number[] = [];
		let cursor = from;
		for (let i = 0; i < perRule; i++) {
			const t = nextTrigger(reminder.rule, cursor, tz);
			if (t === null) break;
			times.push(t);
			cursor = t;
		}
		if (times.length === 0) {
			unschedulable.push({ id: reminder.id, reason: 'invalidRule' });
			continue;
		}
		for (const at of times) {
			if (at - from > horizon) break;
			alarms.push({ reminderId: reminder.id, at, label: reminder.label });
		}
	}

	alarms.sort((a, b) => a.at - b.at);
	return { alarms, unschedulable };
}
