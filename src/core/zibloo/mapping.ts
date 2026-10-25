// core/zibloo/mapping.ts — appState → ZiblooPresentation 的唯一实现(PRD §2.2 状态表)。
// 无持久数值,每次现算;前台动画与后台通知共用同一份语义(A0 §2.3)。
import type { PhaseView, SessionKind } from '../timer/types.ts';
import type { Cue } from './cues.ts';

export type ActivityKind = 'none' | SessionKind;

export type MapZiblooInput = {
	activity: ActivityKind;
	/** 运行中会话的当前投影;无会话或已完成为 null */
	view: PhaseView | null;
	paused: boolean;
	/** 完成庆祝瞬间(到点/完成反馈) */
	celebrating: boolean;
	/** 提醒召唤(提醒到点) */
	reminding: boolean;
	/** 用户点按角色打招呼 */
	greeted: boolean;
	reducedMotion: boolean;
};

export type ZiblooPose =
	| 'idle-float'
	| 'train-exert'
	| 'train-rest'
	| 'focus-quiet'
	| 'focus-stir'
	| 'summon-pop'
	| 'celebrate';

export type ZiblooExpression = 'blink' | 'sparkle' | 'happy' | 'focused' | 'wide';

export type MotionPreset = 'full' | 'static';

export type ZiblooPresentation = {
	pose: ZiblooPose;
	expression: ZiblooExpression;
	motion: MotionPreset;
	/** P2 装饰叠加,非替换;P1 恒空 */
	overlay: string[];
	cue: Cue | null;
	particles: 'bubbles' | 'none';
	/** 后台/锁屏降级通知文案键,与前台同表派生 */
	notification: { titleKey: string; bodyKey: string } | null;
};

export function mapZibloo(input: MapZiblooInput): ZiblooPresentation {
	const base = { overlay: [] as string[], motion: (input.reducedMotion ? 'static' : 'full') as MotionPreset };

	// 优先级:召唤 > 庆祝 > 打招呼 > 运行中 > 待机(PRD §2.2 表顺序)
	if (input.reminding) {
		return {
			...base,
			pose: 'summon-pop',
			expression: 'sparkle',
			cue: 'reminder',
			particles: 'bubbles',
			notification: { titleKey: 'zibloo.notif.reminder.title', bodyKey: 'zibloo.notif.reminder.body' }
		};
	}
	if (input.celebrating) {
		return {
			...base,
			pose: 'celebrate',
			expression: 'happy',
			cue: 'complete',
			particles: 'bubbles',
			notification: { titleKey: 'zibloo.notif.complete.title', bodyKey: 'zibloo.notif.complete.body' }
		};
	}
	if (input.greeted) {
		return { ...base, pose: 'idle-float', expression: 'happy', cue: 'greet', particles: 'bubbles', notification: null };
	}

	if (input.view && input.activity !== 'none') {
		const { phase } = input.view;
		if (input.paused) {
			// 暂停:安静陪伴,减少动作
			return { ...base, motion: 'static', pose: 'focus-quiet', expression: 'blink', cue: null, particles: 'none', notification: notifFor(input.activity) };
		}
		if (input.activity === 'training' || input.activity === 'quick') {
			if (phase === 'work') {
				return { ...base, pose: 'train-exert', expression: 'wide', cue: 'work', particles: 'bubbles', notification: notifFor(input.activity) };
			}
			// prepare / rest 都按放松陪伴
			return { ...base, pose: 'train-rest', expression: 'blink', cue: phase === 'rest' || phase === 'long-rest' ? 'rest' : null, particles: 'none', notification: notifFor(input.activity) };
		}
		// focus
		if (phase === 'work') {
			return { ...base, pose: 'focus-quiet', expression: 'focused', cue: null, particles: 'none', notification: notifFor('focus') };
		}
		// 休息:苏醒伸展
		return { ...base, pose: 'focus-stir', expression: 'blink', cue: 'rest', particles: 'none', notification: notifFor('focus') };
	}

	return { ...base, pose: 'idle-float', expression: 'blink', cue: null, particles: input.reducedMotion ? 'none' : 'bubbles', notification: null };
}

function notifFor(kind: SessionKind): { titleKey: string; bodyKey: string } {
	switch (kind) {
		case 'training':
			return { titleKey: 'zibloo.notif.training.title', bodyKey: 'zibloo.notif.training.body' };
		case 'focus':
			return { titleKey: 'zibloo.notif.focus.title', bodyKey: 'zibloo.notif.focus.body' };
		case 'quick':
			return { titleKey: 'zibloo.notif.quick.title', bodyKey: 'zibloo.notif.quick.body' };
	}
}
