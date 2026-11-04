// 各社区榜单的纯解析。输入是已经取回的正文,不发网络请求。
import type { Platform, RawHit } from './hit.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseJson(text: string): unknown {
	const value: unknown = JSON.parse(text);
	return value;
}

export function parseCount(text: string): number {
	const cleaned = text.replace(/,/g, '').replace(/\s+/g, ' ');
	const match = cleaned.match(/(\d+(?:\.\d+)?)(\s*[kKmM])?/);
	if (!match) return 0;
	const base = Number(match[1]);
	if (!Number.isFinite(base)) return 0;
	const unit = match[2]?.trim().toLowerCase();
	if (unit === 'k') return Math.round(base * 1_000);
	if (unit === 'm') return Math.round(base * 1_000_000);
	return Math.round(base);
}

function stripTags(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/\s+/g, ' ')
		.trim();
}

function hit(input: Omit<RawHit, 'gained'> & { gained?: number }): RawHit {
	return { gained: 0, ...input };
}

export function parseGithubTrending(html: string): RawHit[] {
	const hits: RawHit[] = [];
	const parts = html.split(/<article\b/i).slice(1);
	for (const [index, part] of parts.entries()) {
		const href = part.match(/href="\/([^"/?#]+)\/([^"/?#]+)"/i);
		if (!href) continue;
		const owner = href[1];
		const repo = href[2];
		const description = stripTags(part.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
		const language = part.match(/itemprop="programmingLanguage"[^>]*>([^<]+)/i)?.[1]?.trim() || null;
		const stars = parseCount(part.match(/\/stargazers"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
		const forks = parseCount(part.match(/\/forks"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
		const gained = parseCount(part.match(/([\d,]+)\s+stars\s+(today|this week|this month)/i)?.[1] ?? '');
		hits.push(
			hit({
				platform: 'github',
				key: `${owner}/${repo}`,
				name: `${owner}/${repo}`,
				url: `https://github.com/${owner}/${repo}`,
				description,
				score: stars,
				secondary: forks,
				rank: index + 1,
				language,
				gained
			})
		);
	}
	return hits;
}

export function parseHn(text: string): RawHit[] {
	const data = parseJson(text);
	if (!isRecord(data) || !Array.isArray(data.hits)) return [];
	const hits: RawHit[] = [];
	for (const [index, row] of data.hits.entries()) {
		if (!isRecord(row)) continue;
		const id = str(row.objectID);
		if (!id) continue;
		const title = str(row.title) || `HN ${id}`;
		const url = str(row.url) || `https://news.ycombinator.com/item?id=${id}`;
		hits.push(
			hit({
				platform: 'hn',
				key: id,
				name: title,
				url,
				description: str(row.author),
				score: num(row.points),
				secondary: num(row.num_comments),
				rank: index + 1,
				language: null
			})
		);
	}
	return hits;
}

export function parseLobsters(text: string): RawHit[] {
	const data = parseJson(text);
	if (!Array.isArray(data)) return [];
	const hits: RawHit[] = [];
	for (const [index, row] of data.entries()) {
		if (!isRecord(row)) continue;
		const id = str(row.short_id);
		if (!id) continue;
		const submitter = row.submitter_user;
		const owner = typeof submitter === 'string' ? submitter : isRecord(submitter) ? str(submitter.username) : '';
		const url = str(row.url) || str(row.comments_url) || `https://lobste.rs/s/${id}`;
		hits.push(
			hit({
				platform: 'lobsters',
				key: id,
				name: str(row.title) || id,
				url,
				description: str(row.description_plain).slice(0, 280),
				score: num(row.score),
				secondary: num(row.comment_count),
				rank: index + 1,
				language: null
			})
		);
	}
	return hits.slice(0, 20);
}

export function parseHuggingface(text: string): RawHit[] {
	const data = parseJson(text);
	if (!isRecord(data) || !Array.isArray(data.recentlyTrending)) return [];
	const hits: RawHit[] = [];
	for (const [index, row] of data.recentlyTrending.entries()) {
		if (!isRecord(row)) continue;
		const repo = isRecord(row.repoData) ? row.repoData : {};
		const id = str(repo.id);
		if (!id) continue;
		const type = str(row.repoType) || 'model';
		const url =
			type === 'dataset'
				? `https://huggingface.co/datasets/${id}`
				: type === 'space'
					? `https://huggingface.co/spaces/${id}`
					: `https://huggingface.co/${id}`;
		hits.push(
			hit({
				platform: 'huggingface',
				key: `${type}:${id}`,
				name: id,
				url,
				description: type,
				score: num(repo.likes),
				secondary: num(repo.downloads),
				rank: index + 1,
				language: type
			})
		);
	}
	return hits.slice(0, 15);
}

export function parseGitlab(text: string): RawHit[] {
	const data = parseJson(text);
	if (!Array.isArray(data)) return [];
	const rows: { path: string; name: string; url: string; stars: number; forks: number; description: string }[] = [];
	for (const row of data) {
		if (!isRecord(row)) continue;
		const path = str(row.path_with_namespace);
		if (!path || num(row.star_count) < 8) continue;
		rows.push({
			path,
			name: path,
			url: str(row.web_url) || `https://gitlab.com/${path}`,
			stars: num(row.star_count),
			forks: num(row.forks_count),
			description: str(row.description)
		});
	}
	rows.sort((a, b) => b.stars - a.stars);
	return rows.slice(0, 12).map((row, index) =>
		hit({
			platform: 'gitlab',
			key: row.path,
			name: row.name,
			url: row.url,
			description: row.description,
			score: row.stars,
			secondary: row.forks,
			rank: index + 1,
			language: null
		})
	);
}

export function parseCrates(text: string): RawHit[] {
	const data = parseJson(text);
	if (!isRecord(data)) return [];
	const seen = new Set<string>();
	const rows: RawHit[] = [];
	const lists = [data.just_updated, data.new_crates];
	for (const list of lists) {
		if (!Array.isArray(list)) continue;
		for (const row of list) {
			if (!isRecord(row)) continue;
			const name = str(row.name);
			if (!name || seen.has(name)) continue;
			seen.add(name);
			rows.push(
				hit({
					platform: 'crates',
					key: name,
					name,
					url: `https://crates.io/crates/${name}`,
					description: str(row.description),
					score: num(row.recent_downloads),
					secondary: num(row.downloads),
					rank: rows.length + 1,
					language: 'Rust'
				})
			);
		}
	}
	return rows.slice(0, 12).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function parseDevto(text: string): RawHit[] {
	const data = parseJson(text);
	if (!Array.isArray(data)) return [];
	const hits: RawHit[] = [];
	for (const [index, row] of data.entries()) {
		if (!isRecord(row)) continue;
		const id = row.id;
		const key = typeof id === 'number' || typeof id === 'string' ? String(id) : '';
		if (!key) continue;
		const user = isRecord(row.user) ? str(row.user.username) : '';
		hits.push(
			hit({
				platform: 'devto',
				key,
				name: str(row.title) || key,
				url: str(row.url) || `https://dev.to/${key}`,
				description: str(row.description),
				score: num(row.public_reactions_count),
				secondary: num(row.comments_count),
				rank: index + 1,
				language: user || null
			})
		);
	}
	return hits.slice(0, 12);
}

export function parseFlathub(text: string): RawHit[] {
	const data = parseJson(text);
	if (!isRecord(data) || !Array.isArray(data.hits)) return [];
	const hits: RawHit[] = [];
	for (const [index, row] of data.hits.entries()) {
		if (!isRecord(row)) continue;
		const appId = str(row.app_id) || str(row.id);
		if (!appId) continue;
		hits.push(
			hit({
				platform: 'flathub',
				key: appId,
				name: str(row.name) || appId,
				url: `https://flathub.org/apps/${appId}`,
				description: str(row.summary),
				score: num(row.installs_last_month),
				secondary: num(row.favorites_count),
				rank: index + 1,
				language: null
			})
		);
	}
	return hits.slice(0, 12);
}

export function parseProductHuntFeed(xml: string): RawHit[] {
	const hits: RawHit[] = [];
	const entries = xml.split(/<entry\b/i).slice(1);
	for (const [index, entry] of entries.entries()) {
		const title = stripTags(entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
		if (!title) continue;
		const href = entry.match(/<link[^>]*href="([^"]+)"/i)?.[1]?.split('?')[0] ?? '';
		const slug = href.split('/products/')[1] || href.split('/posts/')[1] || title;
		hits.push(
			hit({
				platform: 'producthunt',
				key: slug,
				name: title,
				url: href || `https://www.producthunt.com/products/${encodeURIComponent(slug)}`,
				description: '',
				score: 0,
				secondary: 0,
				rank: index + 1,
				language: null
			})
		);
	}
	return hits.slice(0, 20);
}

export function parseXTrends(html: string): RawHit[] {
	const hits: RawHit[] = [];
	const rows = html.split(/<tr\b/i).slice(1);
	for (const row of rows) {
		const pos = Number(stripTags(row.match(/class="pos"[^>]*>([\s\S]*?)<\//i)?.[1] ?? ''));
		const name = stripTags(row.match(/class="main"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
		if (!name || !Number.isFinite(pos) || pos <= 0) continue;
		hits.push(
			hit({
				platform: 'x',
				key: `trend:${name.toLowerCase()}`,
				name,
				url: `https://x.com/search?q=${encodeURIComponent(name)}&src=typed_query&f=live`,
				description: 'X 热点',
				score: Math.max(1, 80 - pos),
				secondary: 0,
				rank: pos,
				language: null
			})
		);
	}
	return hits.slice(0, 15);
}

/** gitstock 是 GitHub trending 的 JSON 兜底。 */
export function parseGitstock(text: string): RawHit[] {
	const data = parseJson(text);
	if (!isRecord(data) || !Array.isArray(data.items)) return [];
	const hits: RawHit[] = [];
	for (const row of data.items) {
		if (!isRecord(row)) continue;
		const owner = str(row.owner);
		const repo = str(row.repo);
		if (!owner || !repo) continue;
		hits.push(
			hit({
				platform: 'github',
				key: `${owner}/${repo}`,
				name: `${owner}/${repo}`,
				url: `https://github.com/${owner}/${repo}`,
				description: str(row.description),
				score: num(row.stars),
				secondary: num(row.forks),
				rank: num(row.rank) || hits.length + 1,
				language: str(row.language) || null,
				gained: num(row.stars_gained)
			})
		);
	}
	return hits;
}

export type SourceParse = (body: string) => RawHit[];

export const PARSERS: Record<Platform, SourceParse> = {
	github: parseGithubTrending,
	hn: parseHn,
	lobsters: parseLobsters,
	huggingface: parseHuggingface,
	gitlab: parseGitlab,
	crates: parseCrates,
	devto: parseDevto,
	flathub: parseFlathub,
	producthunt: parseProductHuntFeed,
	x: parseXTrends
};
