import { describe, expect, it } from 'vitest';
import { parseGithubTrending, parseGitstock, parseHn, parseXTrends } from './parse.ts';

describe('trending parsers', () => {
	it('从 GitHub trending 片段抽出仓库', () => {
		const html = `
			<article class="Box-row">
				<h2><a href="/octo/board">octo / board</a></h2>
				<p>A board for trends</p>
				<span itemprop="programmingLanguage">TypeScript</span>
				<a href="/octo/board/stargazers">1,234</a>
				<a href="/octo/board/forks">56</a>
				<span>321 stars today</span>
			</article>`;
		const hits = parseGithubTrending(html);
		expect(hits).toHaveLength(1);
		expect(hits[0]?.name).toBe('octo/board');
		expect(hits[0]?.score).toBe(1234);
		expect(hits[0]?.gained).toBe(321);
		expect(hits[0]?.language).toBe('TypeScript');
		expect(hits[0]?.url).toBe('https://github.com/octo/board');
	});

	it('从 HN JSON 抽出首页', () => {
		const hits = parseHn(
			JSON.stringify({
				hits: [{ objectID: '9', title: 'Show HN: Zibloo', url: 'https://example.com', points: 12, num_comments: 3, author: 'neo' }]
			})
		);
		expect(hits[0]?.name).toBe('Show HN: Zibloo');
		expect(hits[0]?.score).toBe(12);
		expect(hits[0]?.key).toBe('9');
	});

	it('从 X 热点表抽出话题', () => {
		const html = `<tr><td class="pos">2</td><td class="main"><a href="/topic">#opensource</a></td></tr>`;
		const hits = parseXTrends(html);
		expect(hits[0]?.name).toBe('#opensource');
		expect(hits[0]?.rank).toBe(2);
	});

	it('从 gitstock JSON 抽出仓库和今日增量', () => {
		const hits = parseGitstock(
			JSON.stringify({
				items: [
					{
						rank: 1,
						owner: 'octo',
						repo: 'board',
						description: 'A board',
						language: 'TypeScript',
						stars: 99,
						forks: 2,
						stars_gained: 17
					}
				]
			})
		);
		expect(hits[0]?.name).toBe('octo/board');
		expect(hits[0]?.gained).toBe(17);
		expect(hits[0]?.score).toBe(99);
	});
});
