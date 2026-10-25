// persistence/db.ts — Dexie(IndexedDB)单栈持久化(A0 §1)。仓库不上抛,只在浏览器内使用。
import Dexie, { type EntityTable } from 'dexie';
import type { HistoryEntry } from '../core/history/history.ts';
import type { Reminder } from '../core/reminders/rule.ts';
import type { TrainingPreset } from '../core/timer/presets.ts';
import type { BackupData } from '../core/data/transfer.ts';

type ZiblooDb = Dexie & {
	history: EntityTable<HistoryEntry, 'id'>;
	reminders: EntityTable<Reminder, 'id'>;
};

let _db: ZiblooDb | null = null;

/** 惰性创建;仅浏览器调用。 */
export function getDb(): ZiblooDb {
	if (!_db) {
		_db = new Dexie('zibloo') as ZiblooDb;
		// v1 误用自增主键存 UUID 字符串,写入会被 IndexedDB 拒绝(静默失败);
		// 主键不能原地改:v2 删表,v3 以外置主键重建(id 由应用侧 UUID 生成)
		_db.version(1).stores({
			history: '++id, startedAt, kind',
			reminders: '++id, enabled'
		});
		_db.version(2).stores({
			history: null,
			reminders: null
		});
		_db.version(3).stores({
			history: 'id, startedAt, kind',
			reminders: 'id, enabled'
		});
	}
	return _db;
}

export async function exportAll(): Promise<{ history: HistoryEntry[]; reminders: Reminder[] }> {
	const db = getDb();
	return {
		history: await db.history.toArray(),
		reminders: await db.reminders.toArray()
	};
}

/** 整包恢复(确认覆盖后调用):先清空再写入,失败即中断。 */
export async function restoreBackup(data: BackupData): Promise<void> {
	const db = getDb();
	await db.transaction('rw', db.history, db.reminders, async () => {
		await Promise.all([db.history.clear(), db.reminders.clear()]);
		if (data.history.length > 0) await db.history.bulkPut(data.history);
		if (data.reminders.length > 0) await db.reminders.bulkPut(data.reminders);
	});
}
