// platform/capacitor/alarms.ts — AlarmPort 的原生实现:插件全量同步 + 到点事件上报。
import type { AlarmPort, PlannedAlarmPayload, Unsubscribe } from '../ports.ts';
import { ZiblooAlarms, type NativeAlarm } from './zibloo-alarms.ts';

export function createCapacitorAlarmPort(
	getVoice: () => string,
	getReminderTitle: (label: string) => string,
	getReminderBody: () => string
): AlarmPort {
	let handle: { remove: () => Promise<void> } | null = null;

	function payloadOf(alarms: readonly PlannedAlarmPayload[]): NativeAlarm[] {
		return alarms.map((a) => ({
			reminderId: a.reminderId,
			at: a.at,
			title: getReminderTitle(a.label),
			body: getReminderBody(),
			soundRes: `${getVoice()}_reminder`
		}));
	}

	return {
		async syncAlarms(alarms) {
			const result = await ZiblooAlarms.syncAlarms({ alarms: payloadOf(alarms) });
			return result.degraded ? { degraded: 'noExactAlarm' } : {};
		},
		clear() {
			// 原生端没有"页内计时器"概念;全量同步语义已覆盖清理
		},
		onAlarmFired(cb): Unsubscribe {
			void ZiblooAlarms.addListener('alarmFired', cb).then((h) => {
				handle = h;
			});
			return () => {
				void handle?.remove();
			};
		},
		async getPermission() {
			const { state } = await ZiblooAlarms.getPermission();
			return state;
		},
		async requestPermission() {
			const { state } = await ZiblooAlarms.requestPermission();
			return state;
		}
	};
}
