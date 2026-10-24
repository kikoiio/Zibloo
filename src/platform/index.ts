// platform/index.ts — 端口工厂。当前只装配 Web 实现;Capacitor 原生实现(端口签名不变)随后。
import type { AlarmPort, AudioPort } from './ports.ts';
import { createWebAlarmPort } from './web/alarms.ts';
import { createWebAudioPort } from './web/audio.ts';
import type { VoicePreset } from '../core/zibloo/cues.ts';

export function createPorts(opts: { getVoice: () => VoicePreset; getMuted: () => boolean }): { alarmPort: AlarmPort; audioPort: AudioPort } {
	// TODO(P1-native): Capacitor.isNativePlatform() 时装配 zibloo-alarms 原生端口
	return {
		alarmPort: createWebAlarmPort(),
		audioPort: createWebAudioPort(opts.getVoice, opts.getMuted)
	};
}

export type { AlarmPort, AudioPort } from './ports.ts';
