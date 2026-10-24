// platform/web/audio.ts — Web 降级实现:HTMLAudioElement 播放 /sounds/<voice>/<event>.wav。
import type { AudioPort } from '../ports.ts';
import { soundUrl, type AudioCue, type VoicePreset } from '../../core/zibloo/cues.ts';

export function createWebAudioPort(getVoice: () => VoicePreset, getMuted: () => boolean): AudioPort {
	const elements = new Map<string, HTMLAudioElement>();

	function elementFor(cue: AudioCue): HTMLAudioElement {
		const voice = getVoice();
		const key = `${voice}/${cue}`;
		let el = elements.get(key);
		if (!el) {
			el = new Audio(soundUrl(voice, cue));
			el.preload = 'auto';
			elements.set(key, el);
		}
		return el;
	}

	return {
		play(cue) {
			if (getMuted()) return;
			const el = elementFor(cue);
			el.currentTime = 0;
			el.play().catch(() => {
				// 自动播放策略拒绝:等待 unlock 后的下一次事件
			});
		},
		stopAll() {
			for (const el of elements.values()) {
				el.pause();
				el.currentTime = 0;
			}
		},
		unlock() {
			if (getMuted()) return;
			const el = elementFor('call');
			el.volume = 0;
			el.play().then(() => {
				el.pause();
				el.currentTime = 0;
				el.volume = 1;
			}).catch(() => {});
		}
	};
}
