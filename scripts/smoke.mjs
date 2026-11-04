// scripts/smoke.mjs — 网页版冒烟验收:构建产物上跑 Chromium,
// 覆盖看板入口、快捷计时全流程、看板训练跳段与声音资产。
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

	await page.goto(BASE, { waitUntil: 'load' });
	await page.waitForSelector('.zb-app', { timeout: 10_000 });

	// 主页是一块按来源分组的看板:热点 + 计时卡片,无侧栏/日报/独立训练页
	check('主页加载', (await page.locator('.zb-app').count()) === 1);
	check('无侧栏', (await page.locator('.zb-side, .zb-nav').count()) === 0);
	check('计时块', await page.locator('.zb-source', { hasText: '计时' }).first().isVisible());
	check('快捷计时卡片', await page.locator('.zb-card.quick', { hasText: '1 分钟' }).first().isVisible());
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

	// 快捷计时 1 分钟留在看板上
	await page.locator('.quick .btn', { hasText: '1 分钟' }).click();
	await page.waitForSelector('.zb-run .remain');
	const remain1 = await page.locator('.zb-run .remain').textContent();
	check('看板倒计时出现', /^(00:5\d|00:60|01:00)$/.test((remain1 ?? '').trim()), `remain=${remain1}`);
	check('看板阶段标签', await page.locator('.zb-run .phase').first().isVisible());
	await page.screenshot({ path: `${ART}/smoke-run.png` });

	// 暂停/继续
	await page.locator('.zb-run .btn', { hasText: '暂停' }).click();
	await page.waitForSelector('.zb-run.paused');
	const remainPaused = await page.locator('.zb-run .remain').textContent();
	await sleep(1300);
	const remainStill = await page.locator('.zb-run .remain').textContent();
	check('暂停后倒计时冻结', remainPaused === remainStill, `${remainPaused} vs ${remainStill}`);
	await page.locator('.zb-run .btn', { hasText: '继续' }).click();
	await page.waitForSelector('.zb-run:not(.paused)');
	check('继续后恢复', true);

	await page.locator('.zb-run .btn', { hasText: '结束' }).click();
	await page.waitForSelector('.zb-run', { state: 'detached' });
	check('结束留在看板', page.url().replace(/\/$/, '') === BASE.replace(/\/$/, ''));

	// 看板训练模板:跳过准备进入运动,再跳进休息
	await page.locator('.zb-card', { hasText: '经典 30/15' }).locator('.btn', { hasText: '开始' }).click();
	await page.waitForSelector('.zb-run .phase');
	await page.locator('.zb-run .btn', { hasText: '跳过本段' }).click();
	await page.waitForSelector('.phase:has-text("运动")', { timeout: 3000 });
	check('训练在看板上进入运动', true);
	await page.locator('.zb-run .btn', { hasText: '跳过本段' }).click();
	await page.waitForSelector('.phase:has-text("休息")', { timeout: 3000 });
	check('跳段后进入休息', true);
	await page.locator('.zb-run .btn', { hasText: '结束' }).click();
	await page.waitForSelector('.phase:has-text("休息")', { state: 'detached' });
	check('训练结束留在看板', true);

	// 两张计时可以并行,单独暂停一张不影响另一张
	const quickCard = page.locator('.zb-card.quick', { hasText: '1 分钟' });
	const trainingCard = page.locator('.zb-card', { hasText: '经典 30/15' });
	await quickCard.locator('.btn', { hasText: '1 分钟' }).click();
	await trainingCard.locator('.btn', { hasText: '开始' }).click();
	await page.waitForFunction(() => document.querySelectorAll('.zb-run').length === 2);
	check('两张计时同时运行', (await page.locator('.zb-run').count()) === 2);
	await quickCard.locator('.btn', { hasText: '暂停' }).click();
	await page.waitForSelector('.zb-card.quick.zb-run.paused');
	const trainingRemainBefore = await trainingCard.locator('.remain').textContent();
	await sleep(1300);
	const trainingRemainAfter = await trainingCard.locator('.remain').textContent();
	check('暂停一张时另一张继续走', trainingRemainBefore !== trainingRemainAfter);
	await quickCard.locator('.btn', { hasText: '继续' }).click();
	await trainingCard.locator('.btn', { hasText: '结束' }).click();
	await quickCard.locator('.btn', { hasText: '结束' }).click();
	await page.waitForFunction(() => document.querySelectorAll('.zb-run').length === 0);
	check('多卡均可独立结束', (await page.locator('.zb-run').count()) === 0);

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
