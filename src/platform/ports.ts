// platform/ports.ts — 唯一允许触碰平台/原生的边界。core 定义的端口在这里实现(依赖倒置)。
import type { AudioCue } from '../core/zibloo/cues.ts';

export type PlannedAlarmPayload = {
	reminderId: string;
	at: number;
	label: string;
};

export type Unsubscribe = () => void;

/** 全量替换式幂等同步:结构上无法表达「漏取消」(A0 §0)。 */
export interface AlarmPort {
	syncAlarms(alarms: readonly PlannedAlarmPayload[]): Promise<{ degraded?: 'noExactAlarm' }>;
	/** 撤掉本端口的全部待触发(页面卸载/静音切换时用;原生端无需此操作) */
	clear(): void;
	onAlarmFired(cb: (e: { reminderId: string; firedAt: number }) => void): Unsubscribe;
	getPermission(): 'granted' | 'denied' | 'unsupported';
	requestPermission(): Promise<'granted' | 'denied' | 'unsupported'>;
}

export interface AudioPort {
	play(cue: AudioCue): void;
	stopAll(): void;
	/** 首次用户手势时调用,解锁 WebAudio 自动播放限制 */
	unlock(): void;
}
