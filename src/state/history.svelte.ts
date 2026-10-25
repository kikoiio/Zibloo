// state/history.svelte.ts — 历史读取与备份恢复的编排(persistence 只允许 state 触碰)。
import { getDb, exportAll, restoreBackup } from '../persistence/db.ts';
import { summarizeDay, type DaySummary, type HistoryEntry } from '../core/history/history.ts';
import { settings } from './settings.svelte.ts';
import type { BackupData } from '../core/data/transfer.ts';

export const history: { entries: HistoryEntry[]; summary: DaySummary } = $state({
	entries: [],
	summary: { focusMs: 0, trainingMs: 0, quickMs: 0, sessions: 0 }
});

function tz(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export async function loadHistory(): Promise<void> {
	if (typeof window === 'undefined') return;
	const entries = await getDb().history.orderBy('startedAt').reverse().limit(100).toArray();
	history.entries = entries.reverse();
	history.summary = summarizeDay(history.entries, Date.now(), tz());
}

export async function exportBackupData(): Promise<BackupData> {
	const { history: h, reminders } = await exportAll();
	const { trainingPresets } = await import('./presets.svelte.ts');
	return { history: h, reminders, presets: trainingPresets.list };
}

export async function restoreFromBackup(data: BackupData): Promise<void> {
	await restoreBackup(data);
}

export function locale(): string {
	return settings.locale === 'en' ? 'en-US' : 'zh-CN';
}
