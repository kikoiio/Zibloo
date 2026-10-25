// core/zibloo/cues.ts — 叫声的单一概念体系(PRD §2.4)。
// Cue id 直接对应声音资产事件名:<voice>/<cue>.wav;语义只此一份,不再区分事件名/音频名两套词汇。
export type Cue = 'work' | 'rest' | 'complete' | 'greet' | 'reminder';

export type VoicePreset = 'chirrup' | 'breeze';

export function soundUrl(voice: VoicePreset, cue: Cue): string {
	return `/sounds/${voice}/${cue}.wav`;
}
