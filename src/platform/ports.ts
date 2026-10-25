// platform/ports.ts — 唯一允许触碰平台/原生的边界。core 定义的端口在这里实现(依赖倒置)。
import type { Cue } from '../core/zibloo/cues.ts';

export type PlannedAlarmPayload = {
	reminderId: string;
	at: number;
	label: string;
};

/** 段边界兜底闹钟(A0 §5.1):App 被杀/页面不可见时由原生到点发声 */
export type TimerAlarmPayload = {
	/** 稳定 id:sessionId:segmentIndex */
	id: string;
	at: number;
	title: string;
	body: string;
	soundRes: string;
};

export type Unsubscribe = () => void;

/**
 * 提醒闹钟域:全量替换式幂等同步,结构上无法表达「漏取消」(A0 §0)。
 * timer 域独立同步,互不清除对方的闹钟。
 */
export interface AlarmPort {
	syncAlarms(alarms: readonly PlannedAlarmPayload[]): Promise<{ degraded?: 'noExactAlarm' }>;
	/** 撤掉本端口的全部待触发(页面卸载/静音切换时用;原生端无需此操作) */
	clear(): void;
	onAlarmFired(cb: (e: { reminderId: string; firedAt: number }) => void): Unsubscribe;
	getPermission(): Promise<'granted' | 'denied' | 'unsupported'>;
	requestPermission(): Promise<'granted' | 'denied' | 'unsupported'>;
	/** 计时段边界兜底闹钟;传空数组即全部撤销 */
	syncTimerAlarms(alarms: readonly TimerAlarmPayload[]): Promise<void>;
	/** 上报页面可见性:原生据此决定兜底闹钟到点时是否自己发声(可见时让位给 JS) */
	setWebVisible(visible: boolean): void;
}

export interface AudioPort {
	play(cue: Cue): void;
	stopAll(): void;
	/** 首次用户手势时调用,解锁 WebAudio 自动播放限制 */
	unlock(): void;
}

/** 计时前台服务(A0 §5.1):保活与常驻通知,不 tick 计时;Web 端为 no-op */
export interface ForegroundPort {
	showTimer(title: string, body: string): void;
	hideTimer(): void;
}
