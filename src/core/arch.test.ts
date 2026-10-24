import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A0 §3:依赖方向单向,core 不依赖任何人。此测试扫描源码强制边界,
// 替代 ESLint no-restricted-imports 的最小实现。
const CORE_DIR = import.meta.dirname;

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else if (p.endsWith('.ts')) out.push(p);
	}
	return out;
}

describe('core 层依赖边界', () => {
	it('core 非测试文件禁止 import svelte/dexie/capacitor/kit', () => {
		const banned = ['svelte', 'dexie', '@capacitor', '$app', '$lib', 'vitest'];
		for (const file of walk(CORE_DIR)) {
			if (file.endsWith('.test.ts')) continue;
			const src = readFileSync(file, 'utf8');
			for (const token of banned) {
				expect({ file, token, hit: src.includes(token) }).toEqual({ file, token, hit: false });
			}
		}
	});

	it('core 测试文件只允许 vitest/fast-check/相对导入/node 内建', () => {
		const allowed = ['vitest', 'fast-check', 'node:'];
		for (const file of walk(CORE_DIR)) {
			if (!file.endsWith('.test.ts')) continue;
			const imports = [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
			for (const spec of imports) {
				const ok = spec.startsWith('.') || allowed.some((a) => spec.startsWith(a));
				expect({ file, spec, ok }).toEqual({ file, spec, ok: true });
			}
		}
	});
});
