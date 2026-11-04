import { describe, expect, it } from 'vitest';
import { addUtcDays, digestTrends, mergeTrends, type RawHit, type TrendRecord } from './hit.ts';

function hit(key: string, score: number, gained = 0): RawHit {
	return {
		platform: 'github',
		key,
		name: key,
		url: `https://github.com/${key}`,
		description: '',
		score,
		secondary: 0,
		rank: 1,
		language: null,
		gained
	};
}

function record(key: string, firstSeen: string, lastSeen: string, gained = 0): TrendRecord {
	const raw = hit(key, 1, gained);
	const history = [{ date: firstSeen, score: 1, gained: firstSeen === lastSeen ? gained : 10, rank: 1 }];
	if (lastSeen !== firstSeen) {
		const previous = addUtcDays(lastSeen, -1);
		if (previous !== firstSeen) history.push({ date: previous, score: 1, gained: 10, rank: 1 });
		history.push({ date: lastSeen, score: 1, gained, rank: 1 });
	}
	return {
		...raw,
		id: `github:${key}`,
		firstSeen,
		lastSeen,
		consecutiveDays: firstSeen === lastSeen ? 1 : 2,
		seenDates: firstSeen === lastSeen ? [firstSeen] : [firstSeen, lastSeen],
		note: '',
		history
	};
}

describe('mergeTrends / digest', () => {
	it('再次收取保留第一次看见的日期,并更新分数', () => {
		const prev: TrendRecord[] = [record('a/b', '2026-10-01', '2026-10-01')];
		const next = mergeTrends(prev, [hit('a/b', 9, 4), hit('c/d', 2)], '2026-10-30');
		const kept = next.find((item) => item.id === 'github:a/b');
		const added = next.find((item) => item.id === 'github:c/d');
		expect(kept?.firstSeen).toBe('2026-10-01');
		expect(kept?.lastSeen).toBe('2026-10-30');
		expect(kept?.score).toBe(9);
		expect(kept?.gained).toBe(4);
		expect(kept?.consecutiveDays).toBe(1);
		expect(added?.firstSeen).toBe('2026-10-30');
	});

	it('昨天还在、今天还在则连续天数加一', () => {
		const prev: TrendRecord[] = [record('a/b', '2026-10-29', '2026-10-29')];
		const next = mergeTrends(prev, [hit('a/b', 3)], '2026-10-30');
		expect(next[0]?.consecutiveDays).toBe(2);
	});

	it('日报把今天新的、还在加速、仍在的、掉出的分开', () => {
		const items: TrendRecord[] = [
			record('new', '2026-10-30', '2026-10-30', 8),
			record('heat', '2026-10-01', '2026-10-30', 20),
			record('stay', '2026-10-01', '2026-10-30', 5),
			record('drop', '2026-10-01', '2026-10-29', 3)
		];
		const buckets = digestTrends(items, '2026-10-30');
		expect(buckets.find((b) => b.id === 'new')?.itemIds).toEqual(['github:new']);
		expect(buckets.find((b) => b.id === 'heat')?.itemIds).toEqual(['github:heat']);
		expect(buckets.find((b) => b.id === 'stay')?.itemIds).toEqual(['github:stay']);
		expect(buckets.find((b) => b.id === 'drop')?.itemIds).toEqual(['github:drop']);
	});
});
