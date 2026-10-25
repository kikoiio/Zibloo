// state/presets.svelte.ts — 自定义训练预设(本地,localStorage)。
import { makePreset, revivePresets, type TrainingPreset } from '../core/timer/presets.ts';
import type { TrainingPlan } from '../core/timer/types.ts';

const STORAGE_KEY = 'zibloo.training-presets.v1';

export const trainingPresets: { list: TrainingPreset[] } = $state({ list: [] });

export function loadPresets(): void {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		trainingPresets.list = raw ? revivePresets(JSON.parse(raw)) : [];
	} catch {
		trainingPresets.list = [];
	}
}

function persist(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(trainingPresets.list));
}

/** 返回 null = 名称或参数非法(UI 提示,不静默) */
export function savePreset(name: string, plan: TrainingPlan): TrainingPreset | null {
	const preset = makePreset(name, plan, Date.now());
	if (!preset) return null;
	trainingPresets.list = [...trainingPresets.list, preset];
	persist();
	return preset;
}

export function deletePreset(id: string): void {
	trainingPresets.list = trainingPresets.list.filter((p) => p.id !== id);
	persist();
}

export function replacePresets(list: TrainingPreset[]): void {
	trainingPresets.list = list;
	persist();
}
