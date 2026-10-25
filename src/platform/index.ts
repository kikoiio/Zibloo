// platform/index.ts — 端口工厂:Android 原生走 zibloo-alarms 插件,其余走 Web 降级实现。
import type { AlarmPort, AudioPort, ForegroundPort } from './ports.ts';
import { createWebAlarmPort } from './web/alarms.ts';
import { createWebAudioPort } from './web/audio.ts';
import { createCapacitorAlarmPort } from './capacitor/alarms.ts';
import { ZiblooAlarms } from './capacitor/zibloo-alarms.ts';
import { Capacitor } from '@capacitor/core';
import type { VoicePreset } from '../core/zibloo/cues.ts';

const webForeground: ForegroundPort = {
	showTimer() {},
	hideTimer() {}
};

const nativeForeground: ForegroundPort = {
	showTimer(title, body) {
		void ZiblooAlarms.showTimerNotification({ title, body });
	},
	hideTimer() {
		void ZiblooAlarms.hideTimerNotification();
	}
};

export function createPorts(opts: {
	getVoice: () => VoicePreset;
	getMuted: () => boolean;
	getReminderTitle: (label: string) => string;
	getReminderBody: () => string;
}): { alarmPort: AlarmPort; audioPort: AudioPort; foregroundPort: ForegroundPort } {
	const audioPort = createWebAudioPort(opts.getVoice, opts.getMuted);
	if (Capacitor.isNativePlatform()) {
		return {
			alarmPort: createCapacitorAlarmPort(
				() => opts.getVoice(),
				opts.getReminderTitle,
				opts.getReminderBody
			),
			audioPort,
			foregroundPort: nativeForeground
		};
	}
	return { alarmPort: createWebAlarmPort(), audioPort, foregroundPort: webForeground };
}

export type { AlarmPort, AudioPort, ForegroundPort } from './ports.ts';
