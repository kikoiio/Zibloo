// core/history/history.ts — 历史记录类型与统计纯函数(P1:今日陪伴;图表在 P2)。
import type { SessionKind } from '../timer/types.ts';
import { startOfDay } from '../tz.ts';

export type HistoryStatus = 'completed' | 'ended-early' | 'skipped';

export type HistoryEntry = {
	id: string;
	sessionId: string;
	kind: SessionKind;
	startedAt: number;
	endedAt: number;
	totalMs: number;
	activeMs: number;
	status: HistoryStatus;
};

/** 由会话结束时点推导记录状态:全程消费完=完整;跳过过=skipped;其余=提前结束。 */
export function statusFor(activeMsValue: number, totalMsValue: number, skipped: boolean): HistoryStatus {
	if (skipped) return 'skipped';
	return activeMsValue >= totalMsValue - 1000 ? 'completed' : 'ended-early';
}

export type DaySummary = { focusMs: number; trainingMs: number; quickMs: number; sessions: number };

/** 今日陪伴统计:Zibloo 今天陪你专注/训练/快捷计时了多久。 */
export function summarizeDay(entries: readonly HistoryEntry[], epoch: number, tz: string): DaySummary {
	const start = startOfDay(epoch, tz);
	const summary: DaySummary = { focusMs: 0, trainingMs: 0, quickMs: 0, sessions: 0 };
	for (const e of entries) {
		if (e.startedAt < start || e.startedAt >= start + 86_400_000) continue;
		summary[e.kind === 'focus' ? 'focusMs' : e.kind === 'training' ? 'trainingMs' : 'quickMs'] += e.activeMs;
		summary.sessions += 1;
	}
	return summary;
}
