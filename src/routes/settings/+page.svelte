<script lang="ts">
	import { t } from '../../state/i18n.svelte.ts';
	import { settings, setLocale, setVoice, setMuted } from '../../state/settings.svelte.ts';
	import { ports } from '../../state/ports.svelte.ts';
	import { exportAll } from '../../persistence/db.ts';
	import { type VoicePreset, type AudioCue } from '../../core/zibloo/cues.ts';
	import type { MessageKey } from '../../i18n/messages.ts';

	const VOICES: { value: VoicePreset | 'muted'; key: MessageKey }[] = [
		{ value: 'chirrup', key: 'settings.voice.chirrup' },
		{ value: 'breeze', key: 'settings.voice.breeze' },
		{ value: 'muted', key: 'settings.voice.muted' }
	];

	/** 试听:语义标签 → 叫声 ID(与计时器同一映射表) */
	const AUDITIONS: { cue: AudioCue; key: MessageKey }[] = [
		{ cue: 'call', key: 'settings.cue.greet' },
		{ cue: 'rise2', key: 'settings.cue.work' },
		{ cue: 'fall2', key: 'settings.cue.rest' },
		{ cue: 'cheer3', key: 'settings.cue.complete' },
		{ cue: 'chime', key: 'settings.cue.reminder' }
	];

	function pickVoice(value: VoicePreset | 'muted'): void {
		if (value === 'muted') setMuted(true);
		else {
			setMuted(false);
			setVoice(value);
		}
	}

	function currentVoice(): VoicePreset | 'muted' {
		return settings.muted ? 'muted' : settings.voice;
	}

	function audition(cue: AudioCue): void {
		ports.audioPort.stopAll();
		ports.audioPort.play(cue);
	}

	async function exportData(): Promise<void> {
		const data = await exportAll();
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `zibloo-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<main class="page">
	<div class="page-head">
		<a href="/">←</a>
		<h1>{t('settings.title')}</h1>
	</div>

	<section class="card">
		<h2>{t('settings.language')}</h2>
		<div class="chips">
			<button class="chip" class:active={settings.locale === 'zh-CN'} onclick={() => setLocale('zh-CN')}>中文</button>
			<button class="chip" class:active={settings.locale === 'en'} onclick={() => setLocale('en')}>English</button>
		</div>
	</section>

	<section class="card">
		<h2>{t('settings.voice')}</h2>
		<div class="chips">
			{#each VOICES as v (v.value)}
				<button class="chip" class:active={currentVoice() === v.value} onclick={() => pickVoice(v.value)}>
					{t(v.key)}
				</button>
			{/each}
		</div>
		{#if !settings.muted}
			<div class="audition">
				<span class="cap">{t('settings.audition')}</span>
				{#each AUDITIONS as a (a.cue)}
					<button class="chip small" onclick={() => audition(a.cue)}>{t(a.key)}</button>
				{/each}
			</div>
		{/if}
	</section>

	<section class="card">
		<h2>{t('settings.export')}</h2>
		<button class="btn ghost" onclick={exportData}>{t('settings.export')}</button>
	</section>

	<section class="card">
		<h2>{t('settings.about')}</h2>
		<p class="about">Zibloo · {t('settings.version')} 0.1.0 (P1)</p>
		<p class="about note">{t('settings.webReliability')}</p>
	</section>
</main>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	h2 {
		font-size: 0.95rem;
		margin: 0 0 0.7rem;
		color: var(--c-sub);
	}

	.chips {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.chip {
		padding: 0.5rem 1rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: inset 0 0 0 2px var(--c-shadow);
	}

	.chip.active {
		box-shadow: inset 0 0 0 2px var(--c-primary);
		color: var(--c-primary);
		font-weight: 600;
	}

	.chip.small {
		padding: 0.35rem 0.8rem;
		font-size: 0.85rem;
	}

	.audition {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}

	.cap {
		font-size: 0.85rem;
		color: var(--c-sub);
	}

	.about {
		margin: 0;
		color: var(--c-sub);
		font-size: 0.9rem;
	}

	.about.note {
		font-size: 0.82rem;
	}
</style>
