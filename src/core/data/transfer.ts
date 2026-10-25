// core/data/transfer.ts — 备份/预设文件的版本化信封(纯函数)。
// 导入是用户数据的破坏性操作:解析与校验必须在这里完成,UI 只做确认与落地。
import type { HistoryEntry } from '../history/history.ts';
import type { Reminder } from '../reminders/rule.ts';
import type { TrainingPreset } from '../timer/presets.ts';

export const BACKUP_KIND = 'zibloo-backup';
export const BACKUP_VERSION = 1;

export type BackupData = {
	history: HistoryEntry[];
	reminders: Reminder[];
	presets: TrainingPreset[];
};

export type BackupFile = {
	kind: typeof BACKUP_KIND;
	version: number;
	exportedAt: number;
	data: BackupData;
};

export type BackupParseResult =
	| { ok: true; backup: BackupFile }
	| { ok: false; error: 'not-json' | 'wrong-kind' | 'unsupported-version' | 'bad-shape' };

export function makeBackup(data: BackupData): BackupFile {
	return { kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: Date.now(), data };
}

function isArray(x: unknown): x is unknown[] {
	return Array.isArray(x);
}

export function parseBackup(raw: string): BackupParseResult {
	let obj: unknown;
	try {
		obj = JSON.parse(raw);
	} catch {
		return { ok: false, error: 'not-json' };
	}
	if (typeof obj !== 'object' || obj === null) return { ok: false, error: 'wrong-kind' };
	const file = obj as Record<string, unknown>;
	if (file.kind !== BACKUP_KIND) return { ok: false, error: 'wrong-kind' };
	if (file.version !== BACKUP_VERSION) return { ok: false, error: 'unsupported-version' };
	const data = file.data;
	if (typeof data !== 'object' || data === null) return { ok: false, error: 'bad-shape' };
	const d = data as Record<string, unknown>;
	if (!isArray(d.history) || !isArray(d.reminders) || !isArray(d.presets)) {
		return { ok: false, error: 'bad-shape' };
	}
	return {
		ok: true,
		backup: {
			kind: BACKUP_KIND,
			version: BACKUP_VERSION,
			exportedAt: typeof file.exportedAt === 'number' ? file.exportedAt : 0,
			data: {
				history: d.history as HistoryEntry[],
				reminders: d.reminders as Reminder[],
				presets: d.presets as TrainingPreset[]
			}
		}
	};
}
