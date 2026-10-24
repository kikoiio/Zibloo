// persistence/db.ts — Dexie(IndexedDB)单栈持久化(A0 §1)。仓库不上抛,只在浏览器内使用。
import Dexie, { type EntityTable } from 'dexie';
import type { HistoryEntry } from '../core/history/history.ts';
import type { Reminder } from '../core/reminders/rule.ts';

type ZiblooDb = Dexie & {
	history: EntityTable<HistoryEntry, 'id'>;
	reminders: EntityTable<Reminder, 'id'>;
};

let _db: ZiblooDb | null = null;

/** 惰性创建;仅浏览器调用。 */
export function getDb(): ZiblooDb {
	if (!_db) {
		_db = new Dexie('zibloo') as ZiblooDb;
		_db.version(1).stores({
			history: '++id, startedAt, kind',
			reminders: '++id, enabled'
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
