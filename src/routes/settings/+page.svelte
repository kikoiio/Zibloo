<script lang="ts">
	import { t } from '../../state/i18n.svelte.ts';
	import { settings, setLocale, setVoice, setMuted } from '../../state/settings.svelte.ts';
	import { ports } from '../../state/ports.svelte.ts';
	import { makeBackup, parseBackup } from '../../core/data/transfer.ts';
	import { trainingPresets, replacePresets } from '../../state/presets.svelte.ts';
	import { exportBackupData, restoreFromBackup } from '../../state/history.svelte.ts';
	import { loadReminders, reminders } from '../../state/reminders.svelte.ts';
	import { onMount } from 'svelte';

	onMount(() => {
		void loadReminders();
	});

	let importWarn = $state('');

	async function exportData(): Promise<void> {
		const file = makeBackup(await exportBackupData());
		const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `zibloo-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function importData(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const parsed = parseBackup(await file.text());
		if (!parsed.ok) {
			importWarn = t('settings.importInvalid');
			return;
		}
		if (!confirm(t('settings.importConfirm'))) return;
		const backup = parsed.backup;
		await restoreFromBackup(backup.data);
		replacePresets(backup.data.presets);
		importWarn = '';
		// 提醒规则已变:全量重排后整页刷新恢复各 store
		await loadReminders();
		reminders.list = backup.data.reminders;
		location.reload();
	}
	import { type VoicePreset, type Cue } from '../../core/zibloo/cues.ts';
	import type { MessageKey } from '../../i18n/messages.ts';

	const VOICES: { value: VoicePreset | 'muted'; key: MessageKey }[] = [
		{ value: 'chirrup', key: 'settings.voice.chirrup' },
		{ value: 'breeze', key: 'settings.voice.breeze' },
		{ value: 'muted', key: 'settings.voice.muted' }
	];

	/** 试听:语义标签 → 叫声 ID(与计时器同一映射表) */
	const AUDITIONS: { cue: Cue; key: MessageKey }[] = [
		{ cue: 'greet', key: 'settings.cue.greet' },
		{ cue: 'work', key: 'settings.cue.work' },
		{ cue: 'rest', key: 'settings.cue.rest' },
		{ cue: 'complete', key: 'settings.cue.complete' },
		{ cue: 'reminder', key: 'settings.cue.reminder' }
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

	function audition(cue: Cue): void {
		ports.audioPort.stopAll();
		ports.audioPort.play(cue);
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
		<h2>{t('settings.data')}</h2>
		<div class="chips">
			<button class="btn ghost" onclick={exportData}>{t('settings.export')}</button>
			<label class="btn ghost file">
				{t('settings.import')}
				<input type="file" accept="application/json,.json" hidden onchange={importData} />
			</label>
		</div>
		{#if importWarn}
			<p class="warn">{importWarn}</p>
		{/if}
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

	.file {
		cursor: pointer;
	}

	.warn {
		margin: 0.7rem 0 0;
		font-size: 0.82rem;
		color: var(--c-danger);
	}
</style>
