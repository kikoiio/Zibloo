// state/ports.svelte.ts — 单例端口装配,读写 settings。
import { createPorts } from '../platform/index.ts';
import { settings } from './settings.svelte.ts';

export const ports = createPorts({
	getVoice: () => settings.voice,
	getMuted: () => settings.muted
});

// 首次用户手势解锁音频(自动播放策略)
if (typeof window !== 'undefined') {
	window.addEventListener(
		'pointerdown',
		() => ports.audioPort.unlock(),
		{ once: true, capture: true }
	);
}
