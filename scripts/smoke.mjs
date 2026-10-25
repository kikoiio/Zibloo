// scripts/smoke.mjs — 网页版冒烟验收:构建产物上跑 Chromium,
// 覆盖主页入口、快捷计时全流程、提醒 CRUD、语言切换与声音资产。
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
	await page.waitForSelector('img.lockup', { timeout: 10_000 });

	// 主页:字标、问候、三模式入口(ssr=false 纯客户端挂载,必须等元素而非数网络)
	check('主页加载', (await page.locator('img.lockup').count()) === 1);
	for (const name of ['训练', '专注', '记事']) {
		check(`入口可见:${name}`, await page.locator('.entry', { hasText: name }).first().isVisible());
	}
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

	// 快捷计时 1 分钟 → 运行页
	await page.locator('.quick .btn', { hasText: '1 分钟' }).click();
	await page.waitForURL('**/run');
	await page.waitForSelector('.remain');
	const remain1 = await page.locator('.remain').textContent();
	check('运行页倒计时出现', /^(00:5\d|00:60|01:00)$/.test((remain1 ?? '').trim()), `remain=${remain1}`);
	check('运行页阶段标签', await page.locator('.phase').first().isVisible());
	await page.screenshot({ path: `${ART}/smoke-run.png` });

	// 暂停/继续
	await page.locator('.btn', { hasText: '暂停' }).click();
	await page.waitForSelector('.clock.paused');
	const remainPaused = await page.locator('.remain').textContent();
	await sleep(1300);
	const remainStill = await page.locator('.remain').textContent();
	check('暂停后倒计时冻结', remainPaused === remainStill, `${remainPaused} vs ${remainStill}`);
	await page.locator('.btn', { hasText: '继续' }).click();
	await page.waitForSelector('.clock:not(.paused)');
	check('继续后恢复', true);

	// 结束 → 回主页(快捷计时单段,跳段即结束,跳段语义在下面训练流程验证)
	await page.locator('.btn', { hasText: '结束' }).click();
	await page.waitForURL(BASE + '/', { timeout: 8000 });
	check('结束回主页', true);

	// 训练:自定义 5s/5s×2 组,验证跳段进入休息;顺带验证预设保存/加载
	await page.locator('.entry', { hasText: '训练' }).click();
	await page.waitForSelector('.steppers');
	const nums = page.locator('.steppers input[type="number"]');
	await nums.nth(0).fill('0');
	await nums.nth(1).fill('5');
	await nums.nth(2).fill('5');
	await nums.nth(3).fill('2');
	await page.fill('.save-row input', '冒烟预设');
	await page.locator('.save-row .btn').click();
	await page.waitForSelector('.preset .load:has-text("冒烟预设")');
	check('预设保存成功', true);
	await nums.nth(1).fill('9');
	await page.locator('.preset .load', { hasText: '冒烟预设' }).click();
	check(
		'预设加载恢复参数',
		(await nums.nth(1).inputValue()) === '5'
	);
	await page.locator('.preset .drop').first().click();
	await page.waitForSelector('.preset', { state: 'detached' });
	check('预设删除成功', true);
	await nums.nth(0).fill('0');
	await nums.nth(1).fill('5');
	await nums.nth(2).fill('5');
	await nums.nth(3).fill('2');
	await page.locator('.btn.start').click();
	await page.waitForURL('**/run');
	await page.waitForSelector('.phase:has-text("运动")', { timeout: 3000 });
	check('训练开始进入运动', true);
	await page.locator('.btn', { hasText: '跳过本段' }).click();
	await page.waitForSelector('.phase:has-text("休息")', { timeout: 3000 });
	check('跳段后进入休息', true);
	await page.locator('.btn', { hasText: '结束' }).click();
	await page.waitForURL(BASE + '/', { timeout: 8000 });
	check('训练结束回主页', true);

	// 提醒页:新增一条每日提醒(用 30 秒后的一次性提醒验证 unschedulable 之外的排期路径)
	await page.locator('.entry', { hasText: '记事' }).click();
	await page.waitForSelector('.form');
	await page.fill('input[type="text"]', '冒烟测试提醒');
	await page.locator('.chip', { hasText: '一次性' }).click();
	await page.fill('input[type="number"]', '30');
	await page.locator('.btn.add').click();
	await page.waitForSelector('.row:has-text("冒烟测试提醒")');
	check('提醒新增成功', true);
	await page.screenshot({ path: `${ART}/smoke-reminders.png` });
	await page.locator('.row .del').first().click();
	await page.waitForSelector('.row:has-text("冒烟测试提醒")', { state: 'detached' });
	check('提醒删除成功', true);

	// 英文界面
	await page.goto(`${BASE}/settings`, { waitUntil: 'load' });
	await page.waitForSelector('.chip', { timeout: 10_000 });
	await page.locator('.chip', { hasText: 'English' }).click();
	await page.goto(BASE, { waitUntil: 'load' });
	await page.waitForSelector('.entry', { timeout: 10_000 });
	check('英文界面切换', await page.locator('.entry', { hasText: 'Training' }).first().isVisible());
	await page.screenshot({ path: `${ART}/smoke-home-en.png` });

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
