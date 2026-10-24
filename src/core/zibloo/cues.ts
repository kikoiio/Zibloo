// core/zibloo/cues.ts — 段语义 → 叫声 ID 的唯一映射表(PRD §2.4:运动上扬/休息下沉/完成三连)。

export type AudioCue = 'rise2' | 'fall2' | 'cheer3' | 'call' | 'chime';

/** 语义事件(cue 何时发生) */
export type CueEvent = 'work-start' | 'rest-start' | 'complete' | 'greet' | 'reminder';

export function cueForEvent(event: CueEvent): AudioCue {
	switch (event) {
		case 'work-start':
			return 'rise2';
		case 'rest-start':
			return 'fall2';
		case 'complete':
			return 'cheer3';
		case 'greet':
			return 'call';
		case 'reminder':
			return 'chime';
	}
}

/** 叫声 ID → 音频资产事件名(对应 static/sounds/<voice>/<event>.wav) */
export function soundEventForCue(cue: AudioCue): 'work' | 'rest' | 'complete' | 'greet' | 'reminder' {
	switch (cue) {
		case 'rise2':
			return 'work';
		case 'fall2':
			return 'rest';
		case 'cheer3':
			return 'complete';
		case 'call':
			return 'greet';
		case 'chime':
			return 'reminder';
	}
}

export type VoicePreset = 'chirrup' | 'breeze';

export function soundUrl(voice: VoicePreset, cue: AudioCue): string {
	return `/sounds/${voice}/${soundEventForCue(cue)}.wav`;
}
