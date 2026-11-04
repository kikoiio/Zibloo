// platform/ports.ts — 浏览器能力接口,供状态层通过 Web 实现播放提示音。
import type { Cue } from '../core/zibloo/cues.ts';

export interface AudioPort {
	play(cue: Cue): void;
	stopAll(): void;
	/** 首次用户手势时调用,解锁浏览器自动播放限制 */
	unlock(): void;
}
