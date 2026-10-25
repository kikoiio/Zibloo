// scripts/device-smoke.mjs — 模拟器/真机上的 UI 驱动:通过 WebView 调试协议(CDP)
// 操作真实 APK 里的页面,添加一次性提醒。由 android-emulator workflow 调用。
// 前置:adb forward tcp:9222 localabstract:webview_devtools_remote_<pid> 已建立。
import { chromium } from 'playwright';

const label = process.env.REMINDER_LABEL ?? '设备冒烟提醒';
const minutes = String(process.env.REMINDER_MINUTES ?? 1);

const cdp = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = cdp.contexts()[0];
let page = context.pages().find((p) => p.url().includes('localhost'));
if (!page) {
	// WebView 可能还没完成首帧导航
	for (let i = 0; i < 20 && !page; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		page = context.pages().find((p) => p.url().includes('localhost'));
	}
}
if (!page) {
	console.error('未找到 WebView 页面;debug 构建应已启用 WebView 调试');
	process.exit(1);
}

await page.waitForSelector('.entry', { timeout: 30_000 });
await page.locator('.entry', { hasText: '记事' }).click();
await page.waitForSelector('.form', { timeout: 15_000 });
await page.fill('input[type="text"]', label);
await page.locator('.chip', { hasText: '一次性' }).click();
await page.fill('input[type="number"]', minutes);
await page.locator('.btn.add').click();
await page.waitForSelector(`.row:has-text("${label}")`, { timeout: 15_000 });
console.log(`已添加提醒:${label}(+${minutes} 分钟)`);
await cdp.close();
