<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '../../state/i18n.svelte.ts';
	import { timer, currentView, pause, resume, skip, end } from '../../state/timer.svelte.ts';
	import { settings } from '../../state/settings.svelte.ts';
	import { mapZibloo } from '../../core/zibloo/mapping.ts';
	import { cueForEvent, type CueEvent } from '../../core/zibloo/cues.ts';
	import type { Phase } from '../../core/timer/types.ts';
	import { ports } from '../../state/ports.svelte.ts';
	import ZiblooPresenter from '../../zibloo/ZiblooPresenter.svelte';

	let lastSegmentIndex = $state(-1);

	const view = $derived(currentView());
	const session = $derived(timer.session);

	const PHASE_KEYS = {
		prepare: 'run.prepare',
		work: 'run.work',
		rest: 'run.rest',
		'long-rest': 'run.longRest'
	} as const satisfies Record<Phase, Parameters<typeof t>[0]>;

	// 段切换 → 语义叫声(PRD §2.4:运动上扬/休息下沉;prepare 无声)
	function cueFor(phase: Phase): CueEvent | null {
		if (phase === 'work') return 'work-start';
		if (phase === 'rest' || phase === 'long-rest') return 'rest-start';
		return null;
	}

	$effect(() => {
		const v = view;
		if (!v) return;
		if (v.segmentIndex !== lastSegmentIndex) {
			const cue = cueFor(v.phase);
			if (cue) ports.audioPort.play(cueForEvent(cue));
			lastSegmentIndex = v.segmentIndex;
		}
	});

	// 完成/结束 → 回主页
	$effect(() => {
		if (timer.completedAt !== null && !timer.celebrating) {
			goto('/');
		}
	});

	const remainText = $derived.by(() => {
		if (!view) return '00:00';
		const total = Math.max(0, Math.ceil(view.remainMs / 1000));
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});

	const phaseKey = $derived(view ? PHASE_KEYS[view.phase] : PHASE_KEYS.work);

	const paused = $derived(session !== null && session.pausedAt !== null);

	const presentation = $derived(
		mapZibloo({
			activity: session?.kind ?? 'none',
			view,
			paused,
			celebrating: timer.celebrating,
			reminding: timer.reminding,
			greeted: timer.greeted,
			reducedMotion: settings.reducedMotion
		})
	);
</script>

<main class="page run">
	{#if !session}
		<h1>{t('run.none')}</h1>
		<a class="btn" href="/">{t('settings.backHome')}</a>
	{:else if timer.celebrating}
		<h1>{t('run.completed')}</h1>
		<div class="stage">
			<ZiblooPresenter presentation={presentation} />
		</div>
	{:else if view}
		<div class="stage">
			<ZiblooPresenter presentation={presentation} />
		</div>
		<p class="round">{t('run.round', { n: view.round, m: view.rounds })}</p>
		<div class="clock" class:paused>
			<span class="phase">{t(phaseKey)}</span>
			<span class="remain">{remainText}</span>
		</div>
		{#if view.next}
			<p class="next">{t('run.next', { phase: t(`phase.${view.next.phase}`), sec: Math.round(view.next.durationSec) })}</p>
		{/if}
		<div class="controls">
			{#if paused}
				<button class="btn" onclick={resume}>{t('run.resume')}</button>
			{:else}
				<button class="btn" onclick={pause}>{t('run.pause')}</button>
			{/if}
			<button class="btn ghost" onclick={skip}>{t('run.skip')}</button>
			<button class="btn danger" onclick={end}>{t('run.end')}</button>
		</div>
	{/if}
</main>

<style>
	.run {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		text-align: center;
	}

	.stage {
		width: min(60vw, 280px);
	}

	.round {
		color: var(--c-sub);
		margin: 0;
	}

	.clock {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.clock.paused {
		opacity: 0.6;
	}

	.phase {
		font-size: 1.1rem;
		color: var(--c-primary);
		font-weight: 700;
	}

	.remain {
		font-size: 3.4rem;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		line-height: 1.1;
	}

	.next {
		color: var(--c-sub);
		margin: 0;
		font-size: 0.9rem;
	}

	.controls {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}
</style>
