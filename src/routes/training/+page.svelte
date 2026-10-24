<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '../../state/i18n.svelte.ts';
	import type { MessageKey } from '../../i18n/messages.ts';
	import { startSession } from '../../state/timer.svelte.ts';
	import type { TrainingPlan } from '../../core/timer/types.ts';

	const TEMPLATES: { key: MessageKey; plan: TrainingPlan }[] = [
		{ key: 'training.template.classic', plan: { kind: 'training', prepareSec: 10, workSec: 30, restSec: 15, rounds: 8 } },
		{ key: 'training.template.tabata', plan: { kind: 'training', prepareSec: 10, workSec: 20, restSec: 10, rounds: 8 } },
		{ key: 'training.template.strength', plan: { kind: 'training', prepareSec: 10, workSec: 40, restSec: 20, rounds: 6 } },
		{ key: 'training.template.endurance', plan: { kind: 'training', prepareSec: 10, workSec: 60, restSec: 30, rounds: 4 } }
	];

	let plan: TrainingPlan = $state({ ...TEMPLATES[0].plan });
	let selected = $state<string>(TEMPLATES[0].key);

	function pick(key: string): void {
		selected = key;
		const tpl = TEMPLATES.find((x) => x.key === key);
		if (tpl) plan = { ...tpl.plan };
	}

	function start(): void {
		startSession('training', $state.snapshot(plan) as TrainingPlan);
		goto('/run');
	}
</script>

<main class="page">
	<div class="page-head">
		<a href="/">←</a>
		<h1>{t('training.title')}</h1>
	</div>

	<section class="card">
		<h2>{t('training.template')}</h2>
		<div class="templates">
			{#each TEMPLATES as tpl (tpl.key)}
				<button class="tpl" class:active={selected === tpl.key} onclick={() => pick(tpl.key)}>
					{t(tpl.key)}
				</button>
			{/each}
			<button class="tpl" class:active={selected === 'training.template.custom'} onclick={() => (selected = 'training.template.custom')}>
				{t('training.template.custom')}
			</button>
		</div>
	</section>

	<section class="card steppers">
		<label>
			{t('training.prepare')}
			<input type="number" min="0" max="120" bind:value={plan.prepareSec} oninput={() => (selected = 'training.template.custom')} />
		</label>
		<label>
			{t('training.work')}
			<input type="number" min="1" max="600" bind:value={plan.workSec} oninput={() => (selected = 'training.template.custom')} />
		</label>
		<label>
			{t('training.rest')}
			<input type="number" min="1" max="600" bind:value={plan.restSec} oninput={() => (selected = 'training.template.custom')} />
		</label>
		<label>
			{t('training.rounds')}
			<input type="number" min="1" max="30" bind:value={plan.rounds} oninput={() => (selected = 'training.template.custom')} />
		</label>
	</section>

	<button class="btn start" onclick={start}>{t('training.start')}</button>
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
	}

	.templates {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tpl {
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: inset 0 0 0 2px var(--c-shadow);
		color: var(--c-text);
	}

	.tpl.active {
		box-shadow: inset 0 0 0 2px var(--c-primary);
		color: var(--c-primary);
		font-weight: 600;
	}

	.steppers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
	}

	.steppers label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9rem;
		color: var(--c-sub);
	}

	.start {
		align-self: stretch;
		font-size: 1.05rem;
	}
</style>
