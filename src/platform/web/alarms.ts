// platform/web/alarms.ts — Web 降级实现:页面存活期内的 setTimeout 闹钟。
// 网页版明确不承诺 PRD §4.1(V1–V3 验收对象为安卓端)。
import type { AlarmPort, PlannedAlarmPayload, Unsubscribe } from '../ports.ts';

const MAX_TIMEOUT = 2_147_000_000; // setTimeout 上限(留余量)

export function createWebAlarmPort(): AlarmPort {
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const listeners = new Set<(e: { reminderId: string; firedAt: number }) => void>();

	function clearAll() {
		for (const t of timers) clearTimeout(t);
		timers.clear();
	}

	return {
		async syncAlarms(alarms) {
			clearAll();
			const now = Date.now();
			for (const alarm of alarms) {
				const delay = alarm.at - now;
				if (delay <= 0) continue;
				const t = setTimeout(() => {
					timers.delete(t);
					for (const cb of listeners) cb({ reminderId: alarm.reminderId, firedAt: Date.now() });
				}, Math.min(delay, MAX_TIMEOUT));
				timers.add(t);
			}
			// Web 端永远不是精确闹钟:如实上报降级
			return { degraded: 'noExactAlarm' };
		},
		clear: clearAll,
		onAlarmFired(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		getPermission: () => 'unsupported',
		async requestPermission() {
			return 'unsupported';
		}
	};
}

export type { PlannedAlarmPayload, Unsubscribe };
