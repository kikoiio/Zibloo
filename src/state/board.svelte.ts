// 看板:热点缓存、已钉上的计时卡片。收取走全部来源。
import type { PomodoroPlan, QuickPlan, TimerPlan, TrainingPlan } from '../core/timer/types.ts';
import { mergeTrends, PLATFORMS, type HistoryPoint, type Platform, type RawHit, type TrendRecord } from '../core/trending/hit.ts';
import { PARSERS, parseGitstock } from '../core/trending/parse.ts';
import { GITSTOCK_DAILY, SOURCES } from '../core/trending/sources.ts';
import { fetchText } from '../platform/web/http.ts';

const TREND_KEY = 'zibloo.board.trends.v1';
const PIN_KEY = 'zibloo.board.pinned.v1';

export type PinnedCard = {
	id: string;
	label: string;
	plan: TimerPlan;
};

export const board: {
	trends: TrendRecord[];
	pinned: PinnedCard[];
	collecting: boolean;
	collectError: string | null;
	lastCollectAt: number | null;
} = $state({
	trends: [],
	pinned: [],
	collecting: false,
	collectError: null,
	lastCollectAt: null
});

let loaded = false;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function persistTrends(): void {
	localStorage.setItem(TREND_KEY, JSON.stringify({ at: board.lastCollectAt, items: board.trends }));
}

function persistPinned(): void {
	localStorage.setItem(PIN_KEY, JSON.stringify(board.pinned));
}

function finite(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function revivePinnedPlan(value: unknown): TimerPlan | null {
	if (!isRecord(value)) return null;
	if (value.kind === 'quick') {
		const durationSec = finite(value.durationSec);
		if (durationSec === null || durationSec <= 0) return null;
		return { kind: 'quick', durationSec };
	}
	if (value.kind === 'training') {
		const prepareSec = finite(value.prepareSec);
		const workSec = finite(value.workSec);
		const restSec = finite(value.restSec);
		const rounds = finite(value.rounds);
		if (prepareSec === null || workSec === null || restSec === null || rounds === null) return null;
		if (workSec <= 0 || restSec <= 0 || rounds < 1) return null;
		return { kind: 'training', prepareSec, workSec, restSec, rounds };
	}
	if (value.kind === 'focus') {
		const focusSec = finite(value.focusSec);
		const shortRestSec = finite(value.shortRestSec);
		const longRestSec = finite(value.longRestSec);
		const longRestEvery = finite(value.longRestEvery);
		const rounds = finite(value.rounds);
		if (focusSec === null || shortRestSec === null || longRestSec === null || longRestEvery === null || rounds === null) {
			return null;
		}
		if (focusSec <= 0 || shortRestSec <= 0 || longRestSec <= 0 || longRestEvery < 1 || rounds < 1) return null;
		return { kind: 'focus', focusSec, shortRestSec, longRestSec, longRestEvery, rounds };
	}
	return null;
}

function loadPinned(raw: unknown): PinnedCard[] {
	if (!Array.isArray(raw)) return [];
	const out: PinnedCard[] = [];
	for (const row of raw) {
		if (!isRecord(row) || typeof row.id !== 'string' || typeof row.label !== 'string') continue;
		const plan = revivePinnedPlan(row.plan);
		if (!plan) continue;
		out.push({ id: row.id, label: row.label, plan });
	}
	return out;
}

export function loadBoard(): void {
	if (loaded || typeof localStorage === 'undefined') return;
	loaded = true;
	try {
		const trendRaw: unknown = JSON.parse(localStorage.getItem(TREND_KEY) ?? '{}');
		if (isRecord(trendRaw) && Array.isArray(trendRaw.items)) {
			const revived: TrendRecord[] = [];
			for (const item of trendRaw.items) {
				const trend = reviveTrend(item);
				if (trend) revived.push(trend);
			}
			board.trends = revived;
			board.lastCollectAt = typeof trendRaw.at === 'number' ? trendRaw.at : null;
		}
	} catch {
		board.trends = [];
	}
	try {
		const pinRaw: unknown = JSON.parse(localStorage.getItem(PIN_KEY) ?? '[]');
		board.pinned = loadPinned(pinRaw);
	} catch {
		board.pinned = [];
	}
}

function isPlatform(value: unknown): value is Platform {
	return PLATFORMS.some((platform) => platform === value);
}

function reviveTrend(value: unknown): TrendRecord | null {
	if (!isRecord(value) || !isPlatform(value.platform)) return null;
	if (typeof value.id !== 'string' || typeof value.key !== 'string' || typeof value.name !== 'string' || typeof value.url !== 'string') {
		return null;
	}
	if (typeof value.firstSeen !== 'string' || typeof value.lastSeen !== 'string') return null;
	const seenDates = stringList(value.seenDates);
	const history = historyList(value.history);
	return {
		id: value.id,
		platform: value.platform,
		key: value.key,
		name: value.name,
		url: value.url,
		description: typeof value.description === 'string' ? value.description : '',
		score: typeof value.score === 'number' ? value.score : 0,
		secondary: typeof value.secondary === 'number' ? value.secondary : 0,
		rank: typeof value.rank === 'number' ? value.rank : 0,
		language: typeof value.language === 'string' ? value.language : null,
		gained: typeof value.gained === 'number' ? value.gained : 0,
		firstSeen: value.firstSeen,
		lastSeen: value.lastSeen,
		consecutiveDays: typeof value.consecutiveDays === 'number' && value.consecutiveDays > 0 ? value.consecutiveDays : 1,
		seenDates: seenDates.length > 0 ? seenDates : [value.lastSeen],
		note: typeof value.note === 'string' ? value.note : '',
		history
	};
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const row of value) {
		if (typeof row === 'string') out.push(row);
	}
	return out;
}

function historyList(value: unknown): HistoryPoint[] {
	if (!Array.isArray(value)) return [];
	const out: HistoryPoint[] = [];
	for (const row of value) {
		if (!isRecord(row) || typeof row.date !== 'string') continue;
		out.push({
			date: row.date,
			score: typeof row.score === 'number' ? row.score : 0,
			gained: typeof row.gained === 'number' ? row.gained : 0,
			rank: typeof row.rank === 'number' ? row.rank : 0
		});
	}
	return out;
}

export function setNote(id: string, note: string): void {
	loadBoard();
	board.trends = board.trends.map((item) => (item.id === id ? { ...item, note } : item));
	persistTrends();
}

export function pinAdhoc(input: { label: string; plan: TrainingPlan | PomodoroPlan | QuickPlan }): PinnedCard {
	loadBoard();
	const card: PinnedCard = { id: `adhoc:${crypto.randomUUID()}`, label: input.label, plan: input.plan };
	const kept = board.pinned.filter((item) => item.id.startsWith('adhoc:')).slice(-29);
	const rest = board.pinned.filter((item) => !item.id.startsWith('adhoc:'));
	board.pinned = [...rest, ...kept, card];
	persistPinned();
	return card;
}

export async function collectTrends(): Promise<void> {
	loadBoard();
	if (board.collecting) return;
	board.collecting = true;
	board.collectError = null;
	try {
		const today = new Date().toISOString().slice(0, 10);
		const errors: string[] = [];
		const hits: RawHit[] = [];
		await Promise.all(
			SOURCES.map(async (source) => {
				try {
					const body = await fetchText(source.url);
					let parsed = PARSERS[source.platform](body);
					if (source.platform === 'github' && parsed.length === 0) {
						parsed = parseGitstock(await fetchText(GITSTOCK_DAILY));
					}
					if (parsed.length === 0) errors.push(`${source.platform} empty`);
					hits.push(...parsed);
				} catch (error) {
					if (source.platform === 'github') {
						try {
						hits.push(...parseGitstock(await fetchText(GITSTOCK_DAILY)));
							return;
						} catch {
							// fall through to the original error
						}
					}
					const message = error instanceof Error ? error.message : 'failed';
					errors.push(`${source.platform} ${message}`);
				}
			})
		);
		if (hits.length > 0) {
			board.trends = mergeTrends(board.trends, hits, today).slice(-400);
			board.lastCollectAt = Date.now();
			persistTrends();
		}
		board.collectError = errors.length > 0 ? errors.join(' · ') : null;
	} catch (error) {
		board.collectError = error instanceof Error ? error.message : 'collection failed';
	} finally {
		board.collecting = false;
	}
}
