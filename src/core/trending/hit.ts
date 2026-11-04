export const PLATFORMS = [
	'github',
	'hn',
	'lobsters',
	'huggingface',
	'gitlab',
	'crates',
	'devto',
	'flathub',
	'producthunt',
	'x'
] as const;

export type Platform = (typeof PLATFORMS)[number];

export type RawHit = {
	platform: Platform;
	key: string;
	name: string;
	url: string;
	description: string;
	score: number;
	secondary: number;
	rank: number;
	language: string | null;
	gained: number;
};

export type HistoryPoint = {
	date: string;
	score: number;
	gained: number;
	rank: number;
};

export type TrendRecord = RawHit & {
	id: string;
	firstSeen: string;
	lastSeen: string;
	consecutiveDays: number;
	seenDates: string[];
	note: string;
	history: HistoryPoint[];
};

export const PLATFORM_SHORT: Record<Platform, string> = {
	github: 'GH',
	hn: 'HN',
	lobsters: 'LB',
	huggingface: 'HF',
	gitlab: 'GL',
	crates: 'CR',
	devto: 'DEV',
	flathub: 'FH',
	producthunt: 'PH',
	x: 'X'
};

export const PLATFORM_LABEL: Record<Platform, string> = {
	github: 'GitHub',
	hn: 'Hacker News',
	lobsters: 'Lobsters',
	huggingface: 'Hugging Face',
	gitlab: 'GitLab',
	crates: 'crates.io',
	devto: 'DEV',
	flathub: 'Flathub',
	producthunt: 'Product Hunt',
	x: 'X'
};

export const PLATFORM_SCORE: Record<Platform, string> = {
	github: '★',
	hn: 'pts',
	lobsters: 'pts',
	huggingface: '♥',
	gitlab: '★',
	crates: 'dl',
	devto: '♥',
	flathub: '↑',
	producthunt: '▲',
	x: '#'
};

export function trendId(hit: Pick<RawHit, 'platform' | 'key'>): string {
	return `${hit.platform}:${hit.key}`;
}

export function addUtcDays(iso: string, days: number): string {
	const stamp = Date.parse(`${iso}T00:00:00.000Z`);
	if (!Number.isFinite(stamp)) return iso;
	return new Date(stamp + days * 86_400_000).toISOString().slice(0, 10);
}

export function heatOf(item: Pick<TrendRecord, 'platform' | 'score' | 'gained' | 'rank'>): number {
	if (item.platform === 'github') {
		if (item.gained <= 0) return 0;
		return item.gained / Math.max(item.score - item.gained, 1);
	}
	if (item.rank > 0) return 1 / item.rank;
	return 0;
}

export function compact(n: number): string {
	if (n >= 1_000_000) {
		const v = n / 1_000_000;
		return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}m`;
	}
	if (n >= 1000) {
		const v = n / 1000;
		return `${n >= 10_000 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}k`;
	}
	return String(n);
}

function uniqueDates(dates: readonly string[]): string[] {
	return [...new Set(dates)].sort().slice(-60);
}

function mergeHistory(prev: readonly HistoryPoint[], today: string, hit: RawHit): HistoryPoint[] {
	const point: HistoryPoint = { date: today, score: hit.score, gained: hit.gained, rank: hit.rank };
	const kept = prev.filter((row) => row.date !== today);
	kept.push(point);
	return kept.sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
}

function consecutiveDays(old: TrendRecord | undefined, today: string): number {
	if (!old) return 1;
	if (old.lastSeen === today) return old.consecutiveDays;
	if (old.lastSeen === addUtcDays(today, -1)) return old.consecutiveDays + 1;
	return 1;
}

/** 新收取覆盖同 id 的分数与文案,保留第一次看见的日期和笔记。没再出现的旧条目留着,判断不丢。 */
export function mergeTrends(prev: readonly TrendRecord[], hits: readonly RawHit[], today: string): TrendRecord[] {
	const map = new Map(prev.map((item) => [item.id, item]));
	for (const hit of hits) {
		const id = trendId(hit);
		const old = map.get(id);
		map.set(id, {
			...hit,
			id,
			firstSeen: old?.firstSeen ?? today,
			lastSeen: today,
			consecutiveDays: consecutiveDays(old, today),
			seenDates: uniqueDates([...(old?.seenDates ?? []), today]),
			note: old?.note ?? '',
			history: mergeHistory(old?.history ?? [], today, hit)
		});
	}
	return [...map.values()];
}

export type DigestBucket = {
	id: 'new' | 'heat' | 'stay' | 'drop';
	itemIds: string[];
};

function byHeat(items: readonly TrendRecord[], ids: string[]): string[] {
	const lookup = new Map(items.map((item) => [item.id, item]));
	return [...ids].sort((a, b) => {
		const left = lookup.get(a);
		const right = lookup.get(b);
		return heatOf(right ?? emptyHeat) - heatOf(left ?? emptyHeat);
	});
}

const emptyHeat: Pick<TrendRecord, 'platform' | 'score' | 'gained' | 'rank'> = {
	platform: 'hn',
	score: 0,
	gained: 0,
	rank: 0
};

function gainedOn(item: TrendRecord, date: string): number | null {
	const point = item.history.find((row) => row.date === date);
	return point ? point.gained : null;
}

/** 今日第一次出现 / 相对昨天还在加速 / 今天还在 / 今天没再收到。 */
export function digestTrends(items: readonly TrendRecord[], today: string): DigestBucket[] {
	const yesterday = addUtcDays(today, -1);
	const fresh: string[] = [];
	const hotter: string[] = [];
	const stay: string[] = [];
	const drop: string[] = [];
	for (const item of items) {
		const todayGain = gainedOn(item, today);
		const yesterdayGain = gainedOn(item, yesterday);
		if (item.firstSeen === today) fresh.push(item.id);
		else if (todayGain !== null && yesterdayGain !== null) {
			if (todayGain > yesterdayGain) hotter.push(item.id);
			else stay.push(item.id);
		} else if (yesterdayGain !== null && todayGain === null) drop.push(item.id);
		else if (item.lastSeen === today) stay.push(item.id);
		else drop.push(item.id);
	}
	return [
		{ id: 'new', itemIds: byHeat(items, fresh) },
		{ id: 'heat', itemIds: byHeat(items, hotter) },
		{ id: 'stay', itemIds: byHeat(items, stay) },
		{ id: 'drop', itemIds: byHeat(items, drop) }
	];
}
