// state/i18n.svelte.ts — 响应式 t():读 settings.locale。
import { translate, type MessageKey } from '../i18n/messages.ts';
import { settings } from './settings.svelte.ts';

export function t(key: MessageKey, params?: Record<string, string | number>): string {
	return translate(settings.locale, key, params);
}
