// platform/capacitor/zibloo-alarms.ts — 自写插件的 TS 封装(仅 Android 原生可用)。
import { registerPlugin } from '@capacitor/core';

export type NativeAlarm = {
	reminderId: string;
	at: number;
	title: string;
	body: string;
	soundRes: string;
};

export interface ZiblooAlarmsPlugin {
	/** 全量替换式幂等同步 */
	syncAlarms(alarms: { alarms: NativeAlarm[] }): Promise<{ degraded: boolean }>;
	getPermission(): Promise<{ state: 'granted' | 'denied' }>;
	requestPermission(): Promise<{ state: 'granted' | 'denied' }>;
	showTimerNotification(opts: { title: string; body: string }): Promise<void>;
	hideTimerNotification(): Promise<void>;
	addListener(
		eventName: 'alarmFired',
		cb: (e: { reminderId: string; firedAt: number }) => void
	): Promise<PluginListenerHandle>;
}

export interface PluginListenerHandle {
	remove: () => Promise<void>;
}

export const ZiblooAlarms = registerPlugin<ZiblooAlarmsPlugin>('ZiblooAlarms');
