import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, BACKUP_KIND, BACKUP_VERSION } from './transfer.ts';
import type { HistoryEntry, HistoryStatus } from '../history/history.ts';
import type { Reminder } from '../reminders/rule.ts';
import type { TrainingPreset } from '../timer/presets.ts';
import type { TrainingPlan } from '../timer/types.ts';

const plan: TrainingPlan = { kind: 'training', prepareSec: 10, workSec: 30, restSec: 15, rounds: 8 };

const history: HistoryEntry[] = [
	{
		id: 'h1',
		sessionId: 's1',
		kind: 'quick',
		startedAt: 1_700_000_000_000,
		endedAt: 1_700_000_300_000,
		totalMs: 300_000,
		activeMs: 300_000,
		status: 'completed' as HistoryStatus
	}
];

const reminders: Reminder[] = [{ id: 'r1', label: '喝水', enabled: true, rule: { kind: 'daily', at: { hour: 9, minute: 0 } } }];

const presets: TrainingPreset[] = [{ id: 'p1', name: '我的计划', plan, createdAt: 1 }];

describe('备份信封', () => {
	it('make → parse 往返一致', () => {
		const file = makeBackup({ history, reminders, presets });
		const raw = JSON.stringify(file);
		const result = parseBackup(raw);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.backup.data.history).toEqual(history);
			expect(result.backup.data.reminders).toEqual(reminders);
			expect(result.backup.data.presets).toEqual(presets);
			expect(result.backup.version).toBe(BACKUP_VERSION);
		}
	});

	it('非 JSON / 错误 kind / 错误版本 / 缺字段 分别给出确定错误', () => {
		expect(parseBackup('not json{{{')).toEqual({ ok: false, error: 'not-json' });
		expect(parseBackup(JSON.stringify({ kind: 'other', version: 1 }))).toEqual({ ok: false, error: 'wrong-kind' });
		expect(parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 99, data: {} }))).toEqual({
			ok: false,
			error: 'unsupported-version'
		});
		expect(parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 1 }))).toEqual({ ok: false, error: 'bad-shape' });
		expect(parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 1, data: { history: 'x' } }))).toEqual({
			ok: false,
			error: 'bad-shape'
		});
	});
});
