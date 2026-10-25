// core/timer/presets.ts — 自定义训练预设:保存当前参数为命名条目,避免反复设置(PRD §3.2)。
import type { TrainingPlan } from './types.ts';
import { expandSegments, PlanError } from './engine.ts';

export type TrainingPreset = {
	id: string;
	name: string;
	plan: TrainingPlan;
	createdAt: number;
};

const MAX_NAME = 30;

/** 校验并归一;名字为空/超长或参数非法时返回 null(UI 据此提示,不静默)。 */
export function makePreset(name: string, plan: TrainingPlan, now: number): TrainingPreset | null {
	const clean = name.trim().slice(0, MAX_NAME);
	if (!clean) return null;
	try {
		expandSegments(plan); // 复用计划校验:非法参数直接拒绝
	} catch {
		return null;
	}
	return { id: crypto.randomUUID(), name: clean, plan: { ...plan }, createdAt: now };
}

/** 从外部数据(备份导入)恢复预设:逐条校验,坏的跳过不炸。 */
export function revivePresets(raw: unknown[]): TrainingPreset[] {
	const out: TrainingPreset[] = [];
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const p = item as Record<string, unknown>;
		if (typeof p.id !== 'string' || typeof p.name !== 'string') continue;
		const plan = p.plan as TrainingPlan | undefined;
		if (plan?.kind !== 'training') continue;
		try {
			expandSegments(plan);
		} catch (e) {
			if (!(e instanceof PlanError)) throw e;
			continue;
		}
		out.push({
			id: p.id,
			name: p.name.slice(0, MAX_NAME),
			plan: { ...plan },
			createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0
		});
	}
	return out;
}
