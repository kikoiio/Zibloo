// scripts/smoke.mjs — 网页版冒烟验收:构建产物上跑 Chromium,
// 覆盖跨来源发现、搜索、收藏、详情、单个计时器与声音资产。
// CI 里运行;本机也可 npm run smoke。
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4173;
let BASE = `http://127.0.0.1:${PORT}`;
const ART = 'artifacts';

let failures = 0;
function check(name, ok, detail = '') {
	if (ok) {
		console.log(`✓ ${name}`);
	} else {
		failures++;
		console.error(`✗ ${name} ${detail}`);
	}
}

let server = null;

function startServer(port) {
	return new Promise((resolve, reject) => {
		const child = spawn(
			'npx',
			['vite', 'preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'],
			{ stdio: 'pipe', cwd: process.cwd(), detached: true }
		);
		const fail = (err) => {
			try {
				process.kill(-child.pid, 'SIGTERM');
			} catch {}
			clearTimeout(timer);
			reject(err);
		};
		const onError = (err) => fail(err);
		const onExit = () => fail(new Error('vite preview 启动即退出(端口被占?)'));
		child.on('error', onError);
		child.on('exit', onExit);
		// 3 秒内既没 error 也没 exit 视为绑定成功
		const timer = setTimeout(() => {
			child.off('error', onError);
			child.off('exit', onExit);
			resolve(child);
		}, 3000);
	});
}

for (let attempt = 0; attempt < 6 && !server; attempt++) {
	try {
		server = await startServer(PORT + attempt);
		BASE = `http://127.0.0.1:${PORT + attempt}`;
		if (attempt > 0) console.log(`(端口 ${PORT + attempt - 1} 被占,改用 ${PORT + attempt})`);
	} catch {
		// 换下一个端口重试
	}
}
if (!server) throw new Error('无法启动预览服务器:4173-4178 全部被占');

// 硬超时:任何步骤卡死都快速失败,避免 CI 挂 10 分钟
const HARD_TIMEOUT = setTimeout(() => {
	console.error('冒烟硬超时(120s)');
	cleanup();
	process.exit(1);
}, 120_000);

function cleanup() {
	// 杀整棵进程树(npx 的孙进程也要清掉,防止孤儿占端口)
	try {
		process.kill(-server.pid, 'SIGTERM');
	} catch {
		server.kill('SIGTERM');
	}
}

try {
	let up = false;
	for (let i = 0; i < 40 && !up; i++) {
		await sleep(500);
		try {
			const res = await fetch(BASE);
			up = res.ok;
		} catch {}
	}
	if (!up) throw new Error('preview server did not start');
	mkdirSync(ART, { recursive: true });

	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	const today = new Date().toISOString().slice(0, 10);
	const sampleTrend = {
		id: 'github:example/project',
		platform: 'github',
		key: 'example/project',
		name: 'example/project',
		url: 'https://github.com/example/project',
		description: 'A local-first project for organizing research notes.',
		score: 1200,
		secondary: 80,
		rank: 1,
		language: 'TypeScript',
		gained: 24,
		firstSeen: today,
		lastSeen: today,
		consecutiveDays: 2,
		seenDates: [today],
		note: 'Compare local search.',
		history: [{ date: today, score: 1200, gained: 24, rank: 1 }]
	};
	const sampleHnTrend = {
		id: 'hn:42',
		platform: 'hn',
		key: '42',
		name: 'A local-first tools discussion',
		url: 'https://news.ycombinator.com/item?id=42',
		description: 'Useful products shared by founders.',
		score: 420,
		secondary: 18,
		rank: 1,
		language: null,
		gained: 0,
		firstSeen: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
		lastSeen: today,
		consecutiveDays: 1,
		seenDates: [today],
		note: '',
		history: [{ date: today, score: 420, gained: 0, rank: 1 }]
	};
	await page.addInitScript(({ sampleTrends }) => {
		if (!localStorage.getItem('zibloo.board.trends.v1')) {
			localStorage.setItem('zibloo.board.trends.v1', JSON.stringify({ at: Date.now(), items: sampleTrends }));
		}
		if (!localStorage.getItem('zibloo.board.saved.v1')) localStorage.setItem('zibloo.board.saved.v1', '[]');
	}, { sampleTrends: [sampleTrend, sampleHnTrend] });

	await page.goto(BASE, { waitUntil: 'load' });
	await page.waitForSelector('.zb-app', { timeout: 10_000 });

	// 主页面是跨来源发现流,来源保留为卡片标签
	check('主页加载', (await page.locator('.zb-app').count()) === 1);
	check('无侧栏', (await page.locator('.zb-side, .zb-nav').count()) === 0);
	check('紧凑计时工具条', await page.locator('.zb-timer-bar').isVisible());
	check('跨来源卡片在同一列表', (await page.locator('.zb-feed .zb-card').count()) === 2);
	const sources = await page.locator('.zb-source-label').allInnerTexts();
	check('两条卡片保留各自来源', sources.includes('GitHub') && sources.includes('Hacker News'));
	check('新发现排序优先显示新条目', (await page.locator('.zb-source-label').first().innerText()) === 'GitHub');
	await page.locator('.zb-sort-control select').selectOption('rank');
	check('榜单排序交错来源名次', (await page.locator('.zb-source-label').first().innerText()) === 'Hacker News');
	await page.locator('.zb-sort-control select').selectOption('recent');
	check('无训练页', (await page.locator('a[href="/training"]').count()) === 0);
	check('无专注页', (await page.locator('a[href="/focus"]').count()) === 0);
	check('无历史页', (await page.locator('a[href="/history"]').count()) === 0);
	check('无设置页', (await page.locator('a[href="/settings"]').count()) === 0);
	// 吉祥物姿态帧已加载
	const frameLoaded = await page.evaluate(async () => {
		const img = new Image();
		img.src = '/zibloo/frames/stroke-a.png';
		await img.decode();
		return img.naturalWidth > 0;
	});
	check('吉祥物帧资产可加载', frameLoaded);
	const soundOk = await page.evaluate(async () => {
		const res = await fetch('/sounds/chirrup/greet.wav');
		return res.ok;
	});
	check('声音资产可加载', soundOk);
	await page.screenshot({ path: `${ART}/smoke-home.png`, fullPage: true });

	// 多词搜索跨字段匹配;收藏视图可回看并在刷新后保留
	const search = page.locator('.zb-search input');
	await search.fill('compare local');
	check('搜索匹配笔记中的多个词', (await page.locator('.zb-feed .zb-card').count()) === 1 && (await page.locator('.zb-card-title').innerText()) === 'example/project');
	await search.fill('no-such-project');
	check('搜索无结果有明确提示', await page.locator('.zb-no-results h2').isVisible());
	await search.fill('');
	const saveButton = page.locator('.zb-card .zb-save').first();
	await saveButton.click();
	check('收藏状态更新', (await saveButton.getAttribute('aria-pressed')) === 'true');
	await page.locator('.zb-view-switch button').nth(1).click();
	check('收藏视图显示条目', (await page.locator('.zb-feed .zb-card').count()) === 1);
	await page.reload({ waitUntil: 'load' });
	await page.waitForSelector('.zb-app', { timeout: 10_000 });
	await page.locator('.zb-view-switch button').nth(1).click();
	check('收藏刷新后仍保留', (await page.locator('.zb-feed .zb-card').count()) === 1);
	await page.locator('.zb-card-title').click();
	check('详情抽屉显示来源', (await page.locator('.zb-drawer-origin').innerText()).includes('GitHub'));
	await page.screenshot({ path: `${ART}/smoke-detail.png`, fullPage: true });
	await page.locator('.zb-drawer textarea').fill('local research notes');
	await page.locator('.zb-drawer .btn', { hasText: '关闭' }).click();
	await search.fill('research notes');
	check('搜索可找到个人笔记', (await page.locator('.zb-feed .zb-card').count()) === 1);
	await page.screenshot({ path: `${ART}/smoke-search.png`, fullPage: true });

	// 单计时器设置时长、开始、暂停、继续与结束
	await search.fill('');
	await page.locator('.zb-duration-control input').fill('1');
	await page.locator('.zb-timer-bar .zb-start').click();
	await page.waitForSelector('.zb-timer-remain');
	const remain1 = await page.locator('.zb-timer-remain').textContent();
	check('计时器开始倒数', /^(00:5\d|00:60|01:00)$/.test((remain1 ?? '').trim()), `remain=${remain1}`);
	await page.screenshot({ path: `${ART}/smoke-run.png` });

	await page.locator('.zb-timer-bar .btn', { hasText: '暂停' }).click();
	await page.waitForSelector('.zb-timer-status');
	const remainPaused = await page.locator('.zb-timer-remain').textContent();
	await sleep(1300);
	const remainStill = await page.locator('.zb-timer-remain').textContent();
	check('暂停后倒计时冻结', remainPaused === remainStill, `${remainPaused} vs ${remainStill}`);
	await page.locator('.zb-timer-bar .btn', { hasText: '继续' }).click();
	await page.waitForSelector('.zb-timer-status', { state: 'detached' });
	check('继续后恢复', true);
	await page.locator('.zb-timer-bar .btn', { hasText: '结束' }).click();
	await page.waitForSelector('.zb-timer-remain', { state: 'detached' });
	check('结束留在看板', page.url().replace(/\/$/, '') === BASE.replace(/\/$/, ''));
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: `${ART}/smoke-mobile.png`, fullPage: true });
	const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
	check('手机宽度无横向溢出', !mobileOverflow);

	check('页面运行错误为零', errors.length === 0, errors.join('; '));

	await browser.close();
} finally {
	cleanup();
	clearTimeout(HARD_TIMEOUT);
}

if (failures > 0) {
	console.error(`\n${failures} 项未通过`);
	process.exit(1);
}
console.log('\n冒烟全部通过');
