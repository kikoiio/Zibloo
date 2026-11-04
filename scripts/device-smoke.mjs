// scripts/device-smoke.mjs — 模拟器/真机上的 UI 驱动:绕过 Playwright 的
// connectOverCDP(它连接时调 Browser.setDownloadBehavior,Android WebView 不支持),
// 直接走原生 CDP:连接页面 target 的 WebSocket,用一次 Runtime.evaluate 在页面侧
// 完成整套操作。前置:adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>。
// SMOKE_MODE=timer(默认) 在看板上开始 1 分钟快捷计时;
// SMOKE_MODE=board 只确认看板已打开。
const mode = process.env.SMOKE_MODE ?? 'timer';

const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const target = list.find((t) => t.type === 'page' && t.url.includes('localhost'));
if (!target) {
	console.error('未找到应用页面 target:', list.map((t) => `${t.type} ${t.url}`).join(', '));
	process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	ws.addEventListener('open', resolve);
	ws.addEventListener('error', reject);
});

function evaluate(expression) {
	return new Promise((resolve, reject) => {
		const id = 1;
		ws.addEventListener(
			'message',
			(event) => {
				const msg = JSON.parse(String(event.data));
				if (msg.id === id) {
					if (msg.error) reject(new Error(msg.error.message));
					else resolve(msg.result);
				}
			},
			{ once: true }
		);
		ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
	});
}

const result = await evaluate(`
	(async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
		const waitFor = async (fn, what, timeoutMs = 20000) => {
			const start = Date.now();
			while (Date.now() - start < timeoutMs) {
				const v = fn();
				if (v) return v;
				await sleep(300);
			}
			throw new Error('等待超时: ' + what);
		};
		await waitFor(() => document.querySelector('.zb-app'), '看板');
		await waitFor(
			() => [...document.querySelectorAll('.zb-source h2')].some((c) => (c.textContent || '').includes('计时')),
			'计时块'
		);
		await waitFor(
			() => [...document.querySelectorAll('.zb-card.quick')].some((c) => (c.textContent || '').includes('1 分钟')),
			'快捷计时卡片'
		);
		if (${JSON.stringify(mode)} === 'board') return 'OK';
		const btn = await waitFor(
			() => [...document.querySelectorAll('.quick .btn')].find((b) => (b.textContent || '').includes('1 分钟')),
			'1 分钟快捷计时'
		);
		btn.click();
		await waitFor(() => document.querySelector('.zb-run .remain'), '看板倒计时');
		await sleep(1000);
		return 'OK';
	})()
`);

ws.close();
if (result.exceptionDetails) {
	console.error('页面侧执行失败:', JSON.stringify(result.exceptionDetails, null, 2));
	process.exit(1);
}
if (result.result?.value !== 'OK') {
	console.error('意外返回:', JSON.stringify(result.result));
	process.exit(1);
}
console.log(mode === 'board' ? '看板已打开' : '已开始 1 分钟快捷计时');
