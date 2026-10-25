import { describe, expect, it } from 'vitest';
import { mapZibloo } from './mapping.ts';
import type { PhaseView } from '../timer/types.ts';

const T0 = 1_700_000_000_000;

function view(phase: PhaseView['phase'], remainMs = 30_000): PhaseView {
	return { phase, round: 2, rounds: 4, remainMs, segmentIndex: 1, next: null };
}

const idle = { activity: 'none' as const, view: null, paused: false, celebrating: false, reminding: false, greeted: false, reducedMotion: false };

describe('mapZibloo:PRD §2.2 状态表', () => {
	it('待机:漂浮、眨眼、气泡', () => {
		const p = mapZibloo(idle);
		expect(p).toMatchObject({ pose: 'idle-float', expression: 'blink', particles: 'bubbles', cue: null, motion: 'full' });
		expect(p.notification).toBeNull();
	});

	it('提醒召唤优先级最高:跳出 + 提醒声 + 气泡', () => {
		const p = mapZibloo({ ...idle, activity: 'training', view: view('work'), reminding: true });
		expect(p).toMatchObject({ pose: 'summon-pop', expression: 'sparkle', cue: 'reminder', particles: 'bubbles' });
		expect(p.notification).toMatchObject({ titleKey: 'zibloo.notif.reminder.title' });
	});

	it('庆祝:欢快动作 + 完成三连', () => {
		const p = mapZibloo({ ...idle, celebrating: true });
		expect(p).toMatchObject({ pose: 'celebrate', expression: 'happy', cue: 'complete', particles: 'bubbles' });
	});

	it('点按打招呼:招呼声 + 开心', () => {
		const p = mapZibloo({ ...idle, greeted: true });
		expect(p).toMatchObject({ pose: 'idle-float', expression: 'happy', cue: 'greet' });
	});

	it('训练 work:加油姿态 + 上扬两声;rest:放松 + 下沉两声;prepare 无段切换声', () => {
		const work = mapZibloo({ ...idle, activity: 'training', view: view('work') });
		expect(work).toMatchObject({ pose: 'train-exert', expression: 'wide', cue: 'work' });
		const rest = mapZibloo({ ...idle, activity: 'training', view: view('rest') });
		expect(rest).toMatchObject({ pose: 'train-rest', cue: 'rest', particles: 'none' });
		const prep = mapZibloo({ ...idle, activity: 'training', view: view('prepare') });
		expect(prep).toMatchObject({ pose: 'train-rest', cue: null });
	});

	it('专注 work:安静收起触手,不发声;休息:苏醒伸展', () => {
		const work = mapZibloo({ ...idle, activity: 'focus', view: view('work') });
		expect(work).toMatchObject({ pose: 'focus-quiet', expression: 'focused', cue: null, particles: 'none' });
		const rest = mapZibloo({ ...idle, activity: 'focus', view: view('long-rest') });
		expect(rest).toMatchObject({ pose: 'focus-stir', cue: 'rest' });
	});

	it('暂停:静止陪伴,不发段切换声', () => {
		const p = mapZibloo({ ...idle, activity: 'training', view: view('work'), paused: true });
		expect(p).toMatchObject({ pose: 'focus-quiet', motion: 'static', cue: null, particles: 'none' });
	});

	it('减少动态效果:motion 冻结为 static,待机也不冒泡', () => {
		const p = mapZibloo({ ...idle, reducedMotion: true });
		expect(p).toMatchObject({ motion: 'static', particles: 'none' });
		const run = mapZibloo({ ...idle, activity: 'training', view: view('work'), reducedMotion: true });
		expect(run).toMatchObject({ motion: 'static' });
	});

	it('快捷计时按训练语义呈现', () => {
		const p = mapZibloo({ ...idle, activity: 'quick', view: view('work') });
		expect(p).toMatchObject({ pose: 'train-exert' });
	});
});
