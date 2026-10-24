<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '../../state/i18n.svelte.ts';
	import { startSession } from '../../state/timer.svelte.ts';
	import type { PomodoroPlan } from '../../core/timer/types.ts';

	const FOCUS_MIN = [15, 20, 25, 50];
	const SHORT_MIN = [3, 5, 10];

	let plan: PomodoroPlan = $state({
		kind: 'focus',
		focusSec: 25 * 60,
		shortRestSec: 5 * 60,
		longRestSec: 15 * 60,
		longRestEvery: 4,
		rounds: 4
	});

	function start(): void {
		startSession('focus', $state.snapshot(plan) as PomodoroPlan);
		goto('/run');
	}
</script>

<main class="page">
	<div class="page-head">
		<a href="/">←</a>
		<h1>{t('focus.title')}</h1>
	</div>

	<section class="card">
		<h2>{t('focus.length')}</h2>
		<div class="chips">
			{#each FOCUS_MIN as n (n)}
				<button class="chip" class:active={plan.focusSec === n * 60} onclick={() => (plan.focusSec = n * 60)}>{n}</button>
			{/each}
		</div>
	</section>

	<section class="card">
		<h2>{t('focus.shortRest')}</h2>
		<div class="chips">
			{#each SHORT_MIN as n (n)}
				<button class="chip" class:active={plan.shortRestSec === n * 60} onclick={() => (plan.shortRestSec = n * 60)}>{n}</button>
			{/each}
		</div>
	</section>

	<section class="card grid2">
		<label>
			{t('focus.longRest')}
			<input type="number" min="1" max="60" bind:value={plan.longRestSec} />
		</label>
		<label>
			{t('focus.longRestEvery')}
			<input type="number" min="1" max="8" bind:value={plan.longRestEvery} />
		</label>
		<label>
			{t('focus.rounds')}
			<input type="number" min="1" max="12" bind:value={plan.rounds} />
		</label>
	</section>

	<button class="btn start" onclick={start}>{t('focus.start')}</button>
</main>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	h2 {
		font-size: 1rem;
		margin: 0 0 0.75rem;
		color: var(--c-sub);
		font-weight: 600;
	}

	.chips {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.chip {
		padding: 0.55rem 1.1rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: inset 0 0 0 2px var(--c-shadow);
	}

	.chip.active {
		box-shadow: inset 0 0 0 2px var(--c-focus-accent);
		color: var(--c-focus-accent);
		font-weight: 700;
	}

	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
	}

	.grid2 label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9rem;
		color: var(--c-sub);
	}

	.start {
		font-size: 1.05rem;
	}
</style>
