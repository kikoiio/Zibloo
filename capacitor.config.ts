import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'io.zibloo.app',
	appName: 'Zibloo',
	webDir: 'build',
	android: {
		// 网页版与 App 同源;不做热更新服务
		allowMixedContent: false
	},
	plugins: {
		// 安卓上由原生发请求,热点来源不受浏览器跨域限制
		CapacitorHttp: {
			enabled: true
		}
	}
};

export default config;
