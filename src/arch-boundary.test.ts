import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A0 §3:依赖方向单向。UI 层(routes/zibloo)只许走 state/core/i18n,
// 禁止直连 platform/@capacitor/dexie/persistence——平台副作用一律经 state 编排。
const UI_DIRS = [join(import.meta.dirname, 'routes'), join(import.meta.dirname, 'zibloo')];

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else if (p.endsWith('.svelte') || p.endsWith('.ts')) out.push(p);
	}
	return out;
}

describe('UI 层依赖边界', () => {
	it('routes/ 与 zibloo/ 禁止直引 platform / @capacitor / dexie / persistence', () => {
		const banned = ['/platform', '@capacitor', 'dexie', '/persistence'];
		for (const dir of UI_DIRS) {
			for (const file of walk(dir)) {
				const src = readFileSync(file, 'utf8');
				const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
				for (const spec of imports) {
					const hit = banned.find((b) => spec.includes(b));
					expect({ file, spec, hit: hit ?? null }).toEqual({ file, spec, hit: null });
				}
			}
		}
	});
});
