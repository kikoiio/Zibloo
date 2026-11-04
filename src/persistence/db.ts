// persistence/db.ts — Dexie 存计时历史。仓库不上抛,只在浏览器内使用。
import Dexie, { type EntityTable } from 'dexie';
import type { HistoryEntry } from '../core/history/history.ts';
import type { BackupData } from '../core/data/transfer.ts';

type ZiblooDb = Dexie & {
	history: EntityTable<HistoryEntry, 'id'>;
};

let _db: ZiblooDb | null = null;

/** 惰性创建;仅浏览器调用。 */
export function getDb(): ZiblooDb {
	if (!_db) {
		_db = new Dexie('zibloo') as ZiblooDb;
		// v1 误用自增主键存 UUID 字符串,写入会被 IndexedDB 拒绝(静默失败);
		// 主键不能原地改:v2 删表,v3 以外置主键重建(id 由应用侧 UUID 生成);
		// v4 去掉提醒表,产品只留计时与热点。
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
		_db.version(4).stores({
			history: 'id, startedAt, kind',
			reminders: null
		});
	}
	return _db;
}

export async function exportAll(): Promise<{ history: HistoryEntry[] }> {
	const db = getDb();
	return {
		history: await db.history.toArray()
	};
}

/** 整包恢复(确认覆盖后调用):先清空再写入,失败即中断。 */
export async function restoreBackup(data: BackupData): Promise<void> {
	const db = getDb();
	await db.transaction('rw', db.history, async () => {
		await db.history.clear();
		if (data.history.length > 0) await db.history.bulkPut(data.history);
	});
}
