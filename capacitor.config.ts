import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'io.zibloo.app',
	appName: 'Zibloo',
	webDir: 'build',
	android: {
		// 网页版与 App 同源;P1 不做热更新服务
		allowMixedContent: false
	}
};

export default config;
