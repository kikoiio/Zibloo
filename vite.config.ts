import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

function collectProxy(): Plugin {
	return {
		name: 'zibloo-collect-proxy',
		configureServer(server) {
			server.middlewares.use('/api/fetch', (req, res) => {
				void (async () => {
					try {
						const host = req.headers.host ?? '127.0.0.1';
						const target = new URL(req.url ?? '/', `http://${host}`).searchParams.get('url');
						if (!target || !target.startsWith('https://')) {
							res.statusCode = 400;
							res.end('bad url');
							return;
						}
						const response = await fetch(target, {
							headers: { accept: '*/*', 'user-agent': 'Mozilla/5.0 (compatible; Zibloo/0.1)' }
						});
						res.statusCode = response.status;
						const type = response.headers.get('content-type');
						if (type) res.setHeader('content-type', type);
						res.end(Buffer.from(await response.arrayBuffer()));
					} catch (error) {
						res.statusCode = 502;
						res.end(error instanceof Error ? error.message : 'fetch failed');
					}
				})();
			});
		}
	};
}

export default defineConfig({
	plugins: [
		collectProxy(),
		sveltekit({
			adapter: adapter()
		})
	],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
