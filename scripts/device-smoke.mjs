// scripts/device-smoke.mjs — 模拟器/真机上的 UI 驱动:绕过 Playwright 的
// connectOverCDP(它连接时调 Browser.setDownloadBehavior,Android WebView 不支持),
// 直接走原生 CDP:连接页面 target 的 WebSocket,用一次 Runtime.evaluate 在页面侧
// 完成整套操作。前置:adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>。
const label = process.env.REMINDER_LABEL ?? '设备冒烟提醒';
const minutes = String(process.env.REMINDER_MINUTES ?? 1);

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

// 页面侧执行完整流程:进提醒页 → 填名称 → 选一次性 → 填分钟 → 添加 → 等行出现。
// Svelte 的 bind:value 监听 input 事件,所以赋值后必须 dispatch。
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
		await waitFor(() => document.querySelectorAll('.entry').length >= 3, '主页入口');
		const entry = [...document.querySelectorAll('.entry')].find((e) => e.textContent.includes('记事'));
		entry.click();
		await waitFor(() => document.querySelector('.form'), '提醒表单');
		const text = document.querySelector('.form input[type="text"]');
		text.value = ${JSON.stringify(label)};
		text.dispatchEvent(new Event('input', { bubbles: true }));
		const once = [...document.querySelectorAll('.chip')].find((c) => c.textContent.trim() === '一次性');
		once.click();
		const num = document.querySelector('.form input[type="number"]');
		num.value = ${JSON.stringify(minutes)};
		num.dispatchEvent(new Event('input', { bubbles: true }));
		document.querySelector('.btn.add').click();
		await waitFor(
			() => [...document.querySelectorAll('.row')].some((r) => r.textContent.includes(${JSON.stringify(label)})),
			'提醒列表出现新行'
		);
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
console.log(`已添加提醒:${label}(+${minutes} 分钟)`);
