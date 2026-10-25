<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '../../state/i18n.svelte.ts';
	import type { MessageKey } from '../../i18n/messages.ts';
	import { startSession } from '../../state/timer.svelte.ts';
	import { trainingPresets, loadPresets, savePreset, deletePreset } from '../../state/presets.svelte.ts';
	import type { TrainingPlan } from '../../core/timer/types.ts';
	import { onMount } from 'svelte';

	onMount(() => {
		loadPresets();
	});

	let presetName = $state('');
	let presetWarn = $state(false);

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

	function applyPreset(id: string): void {
		const p = trainingPresets.list.find((x) => x.id === id);
		if (!p) return;
		plan = { ...p.plan };
		selected = 'training.template.custom';
	}

	function save(): void {
		const preset = savePreset(presetName, $state.snapshot(plan) as TrainingPlan);
		if (!preset) {
			presetWarn = true;
			return;
		}
		presetWarn = false;
		presetName = '';
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

	<section class="card">
		<h2>{t('training.presets')}</h2>
		{#if trainingPresets.list.length > 0}
			<div class="templates">
				{#each trainingPresets.list as p (p.id)}
					<span class="tpl preset" class:active={plan.kind === 'training' && JSON.stringify(plan) === JSON.stringify(p.plan)}>
						<button class="load" onclick={() => applyPreset(p.id)}>{p.name}</button>
						<button class="drop" onclick={() => deletePreset(p.id)} aria-label="✕">✕</button>
					</span>
				{/each}
			</div>
		{/if}
		<div class="save-row">
			<input type="text" placeholder={t('training.presetName')} bind:value={presetName} />
			<button class="btn ghost" onclick={save}>{t('training.savePreset')}</button>
		</div>
		{#if presetWarn}
			<p class="warn">{t('training.presetInvalid')}</p>
		{/if}
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

	.preset {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.45rem 0.2rem 0.75rem;
	}

	.preset .load {
		color: inherit;
	}

	.preset .drop {
		color: var(--c-sub);
		padding: 0.1rem 0.35rem;
		border-radius: 8px;
		font-size: 0.85rem;
	}

	.preset .drop:hover {
		color: var(--c-danger);
	}

	.save-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.save-row input {
		flex: 1;
		min-width: 0;
	}

	.warn {
		margin: 0.5rem 0 0;
		font-size: 0.82rem;
		color: var(--c-danger);
	}

	.start {
		align-self: stretch;
		font-size: 1.05rem;
	}
</style>
