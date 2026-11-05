import { PLATFORM_LABEL, type TrendRecord } from './hit.ts';

export type DiscoveryView = 'discover' | 'saved';
export type DiscoverySort = 'recent' | 'rank';

export function discoverItems(input: {
	items: readonly TrendRecord[];
	query: string;
	view: DiscoveryView;
	savedIds: readonly string[];
	sort: DiscoverySort;
}): TrendRecord[] {
	const query = input.query.trim().toLowerCase();
	const tokens = query.length === 0 ? [] : query.split(/\s+/u);
	const savedIds = input.view === 'saved' ? new Set(input.savedIds) : undefined;

	const matches = input.items.filter((item) => {
		if (savedIds !== undefined && !savedIds.has(item.id)) return false;
		if (tokens.length === 0) return true;

		const searchableText = [
			item.name,
			item.description,
			item.note,
			item.language ?? '',
			PLATFORM_LABEL[item.platform]
		]
			.join(' ')
			.toLowerCase();

		return tokens.every((token) => searchableText.includes(token));
	});

	matches.sort((left, right) => {
		if (input.sort === 'rank') {
			const byLastSeen = compareText(right.lastSeen, left.lastSeen);
			if (byLastSeen !== 0) return byLastSeen;

			const byRank = compareSourceRank(left.rank, right.rank);
			if (byRank !== 0) return byRank;

			const byFirstSeen = compareText(right.firstSeen, left.firstSeen);
			if (byFirstSeen !== 0) return byFirstSeen;
		} else {
			const byFirstSeen = compareText(right.firstSeen, left.firstSeen);
			if (byFirstSeen !== 0) return byFirstSeen;

			const byLastSeen = compareText(right.lastSeen, left.lastSeen);
			if (byLastSeen !== 0) return byLastSeen;

			const byRank = compareSourceRank(left.rank, right.rank);
			if (byRank !== 0) return byRank;
		}

		return compareText(left.id, right.id);
	});

	return matches;
}

function compareSourceRank(left: number, right: number): number {
	const leftIsValid = Number.isFinite(left) && left > 0;
	const rightIsValid = Number.isFinite(right) && right > 0;

	if (leftIsValid && rightIsValid) return compareNumber(left, right);
	if (leftIsValid) return -1;
	if (rightIsValid) return 1;
	return 0;
}

function compareNumber(left: number, right: number): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
