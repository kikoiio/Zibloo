// platform/index.ts — 浏览器能力装配。
import type { AudioPort } from './ports.ts';
import { createWebAudioPort } from './web/audio.ts';
import type { VoicePreset } from '../core/zibloo/cues.ts';

export function createPorts(opts: {
	getVoice: () => VoicePreset;
	getMuted: () => boolean;
}): { audioPort: AudioPort } {
	return { audioPort: createWebAudioPort(opts.getVoice, opts.getMuted) };
}

export type { AudioPort } from './ports.ts';
