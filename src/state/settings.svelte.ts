// state/settings.svelte.ts — 偏好设置(语言/声音/静音)。声音偏好持久化于 localStorage。
import type { Locale } from '../i18n/messages.ts';
import type { VoicePreset } from '../core/zibloo/cues.ts';

export type Settings = {
	locale: Locale;
	voice: VoicePreset;
	muted: boolean;
	reducedMotion: boolean;
};

const STORAGE_KEY = 'zibloo.settings.v1';

export const settings: Settings = $state({
	locale: 'zh-CN',
	voice: 'chirrup',
	muted: false,
	reducedMotion: false
});

export function loadSettings(): void {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const saved = JSON.parse(raw) as Partial<Settings>;
			if (saved.locale === 'en' || saved.locale === 'zh-CN') settings.locale = saved.locale;
			if (saved.voice === 'chirrup' || saved.voice === 'breeze') settings.voice = saved.voice;
			settings.muted = saved.muted === true;
		}
	} catch {
		// 损坏的偏好按默认处理
	}
	settings.reducedMotion =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function saveSettings(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({ locale: settings.locale, voice: settings.voice, muted: settings.muted })
	);
}

export function setLocale(locale: Locale): void {
	settings.locale = locale;
	saveSettings();
}

export function setVoice(voice: VoicePreset): void {
	settings.voice = voice;
	// 切回非静音时,清掉与其他草稿绑定的旧偏好
	saveSettings();
}

export function setMuted(muted: boolean): void {
	settings.muted = muted;
	saveSettings();
}
