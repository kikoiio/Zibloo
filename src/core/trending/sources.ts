import type { Platform } from './hit.ts';

export type SourceSpec = {
	platform: Platform;
	url: string;
};

/** 日榜。解析在 parse.ts,这里只登记取数地址。 */
export const GITSTOCK_DAILY = 'https://gitstock.org/api/v1/github/trending?period=daily';

export const SOURCES: readonly SourceSpec[] = [
	{ platform: 'github', url: 'https://github.com/trending?since=daily' },
	{ platform: 'hn', url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=18' },
	{ platform: 'lobsters', url: 'https://lobste.rs/hottest.json' },
	{ platform: 'huggingface', url: 'https://huggingface.co/api/trending?limit=15' },
	{
		platform: 'gitlab',
		url: 'https://gitlab.com/api/v4/projects?order_by=last_activity_at&sort=desc&visibility=public&simple=true&per_page=100'
	},
	{ platform: 'crates', url: 'https://crates.io/api/v1/summary' },
	{ platform: 'devto', url: 'https://dev.to/api/articles?top=1&per_page=12' },
	{ platform: 'flathub', url: 'https://flathub.org/api/v2/collection/trending?page=1&per_page=12' },
	{ platform: 'producthunt', url: 'https://www.producthunt.com/feed' },
	{ platform: 'x', url: 'https://getdaytrends.com/' }
];
