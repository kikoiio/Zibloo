// 开发时走 Vite 代理,避开浏览器跨域。安卓上 CapacitorHttp 会接管 fetch。
const DEV_PROXY = '/api/fetch';

export async function fetchText(url: string): Promise<string> {
	const target = import.meta.env.DEV ? `${DEV_PROXY}?url=${encodeURIComponent(url)}` : url;
	const response = await fetch(target, { headers: { accept: 'text/html,application/json,application/xml;q=0.9,*/*;q=0.8' } });
	if (!response.ok) throw new Error(String(response.status));
	return response.text();
}
