<script lang="ts">
	import { t } from '../../state/i18n.svelte.ts';
	import {
		reminders,
		loadReminders,
		addReminder,
		toggleReminder,
		deleteReminder
	} from '../../state/reminders.svelte.ts';
	import type { ReminderRule, Weekday } from '../../core/reminders/rule.ts';
	import type { MessageKey } from '../../i18n/messages.ts';
	import { onMount } from 'svelte';

	onMount(() => {
		void loadReminders();
	});

	let label = $state('');
	let kind = $state<'once' | 'daily' | 'weekly' | 'interval'>('daily');
	let onceMinutes = $state(30);
	let atTime = $state('08:30');
	let days = $state<number[]>([1, 3, 5]);
	let everyMinutes = $state(120);
	let windowEnabled = $state(false);
	let windowStart = $state('09:00');
	let windowEnd = $state('21:00');

	const WEEKDAY_KEYS = ['weekday.0', 'weekday.1', 'weekday.2', 'weekday.3', 'weekday.4', 'weekday.5', 'weekday.6'] as const satisfies readonly MessageKey[];

	const KINDS: { k: 'once' | 'daily' | 'weekly' | 'interval'; key: MessageKey }[] = [
		{ k: 'once', key: 'reminders.once' },
		{ k: 'daily', key: 'reminders.daily' },
		{ k: 'weekly', key: 'reminders.weekly' },
		{ k: 'interval', key: 'reminders.interval' }
	];

	function parseTime(s: string): { hour: number; minute: number } {
		const [h, m] = s.split(':').map(Number);
		return { hour: h || 0, minute: m || 0 };
	}

	async function add(): Promise<void> {
		if (!label.trim()) return;
		let rule: ReminderRule;
		if (kind === 'once') {
			rule = { kind: 'once', at: Date.now() + onceMinutes * 60_000 };
		} else if (kind === 'daily') {
			rule = { kind: 'daily', at: parseTime(atTime) };
		} else if (kind === 'weekly') {
			rule = { kind: 'weekly', at: parseTime(atTime), days: [...days].sort() as Weekday[] };
		} else {
			rule = {
				kind: 'interval',
				everyMs: everyMinutes * 60_000,
				window: windowEnabled
					? { start: parseTime(windowStart), end: parseTime(windowEnd) }
					: null
			};
		}
		await addReminder(label.trim(), rule);
		label = '';
	}

	function ruleText(r: ReminderRule): string {
		if (r.kind === 'once') return t('reminders.onceIn', { n: Math.max(1, Math.round((r.at - Date.now()) / 60_000)) });
		if (r.kind === 'daily') return `${t('reminders.daily')} ${String(r.at.hour).padStart(2, '0')}:${String(r.at.minute).padStart(2, '0')}`;
		if (r.kind === 'weekly')
			return `${t('reminders.weekly')} ${r.days.map((d) => t(WEEKDAY_KEYS[d])).join('/')} ${String(r.at.hour).padStart(2, '0')}:${String(r.at.minute).padStart(2, '0')}`;
		const base = t('reminders.everyMinutes', { n: Math.round(r.everyMs / 60_000) });
		return r.window ? `${base} ${t('reminders.window')} ${String(r.window.start.hour).padStart(2, '0')}:${String(r.window.start.minute).padStart(2, '0')}–${String(r.window.end.hour).padStart(2, '0')}:${String(r.window.end.minute).padStart(2, '0')}` : base;
	}

	const unschedulableIds = $derived(new Set(reminders.unschedulable.map((u) => u.id)));
</script>

<main class="page">
	<div class="page-head">
		<a href="/">←</a>
		<h1>{t('reminders.title')}</h1>
	</div>

	{#if reminders.degraded}
		<p class="degraded">⚠ {t('settings.webReliability')}</p>
	{/if}

	<section class="card list">
		{#if reminders.list.length === 0}
			<p class="empty">{t('reminders.empty')}</p>
		{:else}
			{#each reminders.list as r (r.id)}
				<div class="row" class:off={!r.enabled}>
					<label class="switch">
						<input type="checkbox" checked={r.enabled} onchange={() => toggleReminder(r.id)} />
					</label>
					<div class="meta">
						<strong>{r.label}</strong>
						<span class="rule">
							{ruleText(r.rule)}
							{#if unschedulableIds.has(r.id)}
								<em class="warn">{t('reminders.unschedulableOnce')}</em>
							{/if}
						</span>
					</div>
					<button class="del" onclick={() => deleteReminder(r.id)} aria-label={t('reminders.delete')}>✕</button>
				</div>
			{/each}
		{/if}
	</section>

	<section class="card form">
		<h2>{t('reminders.new')}</h2>
		<label class="field">
			{t('reminders.label')}
			<input type="text" placeholder={t('reminders.labelPlaceholder')} bind:value={label} />
		</label>

		<div class="kinds">
			{#each KINDS as entry (entry.k)}
				<button class="chip" class:active={kind === entry.k} onclick={() => (kind = entry.k)}>{t(entry.key)}</button>
			{/each}
		</div>

		{#if kind === 'once'}
			<label class="field">
				{t('reminders.onceLabel')}
				<input type="number" min="1" bind:value={onceMinutes} />
			</label>
		{:else if kind === 'daily'}
			<label class="field">
				{t('reminders.time')}
				<input type="time" bind:value={atTime} />
			</label>
		{:else if kind === 'weekly'}
			<label class="field">
				{t('reminders.time')}
				<input type="time" bind:value={atTime} />
			</label>
			<div class="kinds">
				{#each WEEKDAY_KEYS as key, d (key)}
					<button
						class="chip"
						class:active={days.includes(d)}
						onclick={() => (days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
					>
						{t(key)}
					</button>
				{/each}
			</div>
		{:else}
			<label class="field">
				{t('reminders.everyLabel')}
				<input type="number" min="1" bind:value={everyMinutes} />
			</label>
			<label class="switchline">
				<input type="checkbox" bind:checked={windowEnabled} />
				{t('reminders.window')}
			</label>
			{#if windowEnabled}
				<div class="times">
					<input type="time" bind:value={windowStart} />
					<span>–</span>
					<input type="time" bind:value={windowEnd} />
				</div>
			{/if}
		{/if}

		<button class="btn add" onclick={add}>{t('reminders.add')}</button>
	</section>
</main>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.degraded {
		margin: 0;
		font-size: 0.85rem;
		color: var(--c-danger);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.empty {
		color: var(--c-sub);
		margin: 0.2rem 0;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.row.off .meta {
		opacity: 0.55;
	}

	.meta {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.rule {
		font-size: 0.82rem;
		color: var(--c-sub);
	}

	.warn {
		color: var(--c-danger);
		font-style: normal;
		margin-left: 0.4rem;
	}

	.del {
		color: var(--c-sub);
		padding: 0.3rem 0.5rem;
		border-radius: 8px;
	}

	.del:hover {
		color: var(--c-danger);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	h2 {
		font-size: 1rem;
		margin: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.88rem;
		color: var(--c-sub);
	}

	.kinds {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.chip {
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: inset 0 0 0 2px var(--c-shadow);
	}

	.chip.active {
		box-shadow: inset 0 0 0 2px var(--c-reminder-accent);
		color: var(--c-reminder-accent);
		font-weight: 600;
	}

	.switchline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--c-sub);
	}

	.times {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.add {
		align-self: flex-start;
	}
</style>
