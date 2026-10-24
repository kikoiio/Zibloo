// state/reminders.svelte.ts — 提醒规则表(唯一事实源)与全量重排编排。
import { planAlarms, type PlannedAlarm } from '../core/reminders/plan.ts';
import type { Reminder, ReminderRule } from '../core/reminders/rule.ts';
import { getDb } from '../persistence/db.ts';
import { ports } from './ports.svelte.ts';
import { flashReminder } from './timer.svelte.ts';

export const reminders: {
	list: Reminder[];
	loaded: boolean;
	unschedulable: { id: string; reason: string }[];
	degraded: boolean;
	nextFires: Map<string, number>;
} = $state({
	list: [],
	loaded: false,
	unschedulable: [],
	degraded: false,
	nextFires: new Map()
});

function timezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** 规则表 → 期望闹钟集合 → AlarmPort 全量幂等同步(A0 §2.2)。 */
export async function syncReminderAlarms(): Promise<void> {
	if (typeof window === 'undefined') return;
	const { alarms, unschedulable } = planAlarms(reminders.list, Date.now(), timezone());
	const result = await ports.alarmPort.syncAlarms(
		alarms.map((a: PlannedAlarm) => ({ reminderId: a.reminderId, at: a.at, label: a.label }))
	);
	reminders.degraded = result.degraded === 'noExactAlarm';
	reminders.unschedulable = unschedulable;
	reminders.nextFires = new Map(alarms.map((a) => [a.reminderId, a.at]));
}

export async function loadReminders(): Promise<void> {
	if (typeof window === 'undefined' || reminders.loaded) return;
	reminders.list = await getDb().reminders.toArray();
	reminders.loaded = true;
	await syncReminderAlarms();
	// 到点回调(页面存活期间):Web 降级路径;原生路径由系统通知承担
	ports.alarmPort.onAlarmFired(() => {
		flashReminder();
	});
}

export async function addReminder(label: string, rule: ReminderRule): Promise<void> {
	const reminder: Reminder = { id: crypto.randomUUID(), label, rule, enabled: true };
	await getDb().reminders.add(reminder);
	reminders.list = [...reminders.list, reminder];
	await syncReminderAlarms();
}

export async function toggleReminder(id: string): Promise<void> {
	const target = reminders.list.find((r) => r.id === id);
	if (!target) return;
	const updated = { ...target, enabled: !target.enabled };
	await getDb().reminders.put(updated);
	reminders.list = reminders.list.map((r) => (r.id === id ? updated : r));
	await syncReminderAlarms();
}

export async function deleteReminder(id: string): Promise<void> {
	await getDb().reminders.delete(id);
	reminders.list = reminders.list.filter((r) => r.id !== id);
	await syncReminderAlarms();
}
