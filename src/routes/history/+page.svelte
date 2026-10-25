<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '../../state/i18n.svelte.ts';
	import { history as historyState, loadHistory, locale } from '../../state/history.svelte.ts';

	const entries = $derived(historyState.entries);
	const summary = $derived(historyState.summary);

	onMount(() => {
		void loadHistory();
	});

	function fmt(ms: number): string {
		const min = Math.round(ms / 60_000);
		if (min < 1) return '<1 ' + t('common.min');
		return `${min} ${t('common.min')}`;
	}

	function fmtTime(epoch: number): string {
		return new Date(epoch).toLocaleString(locale(), {
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<main class="page">
	<div class="page-head">
		<a href="/">←</a>
		<h1>{t('history.title')}</h1>
	</div>

	<section class="card today">
		<h2>{t('history.today')}</h2>
		<div class="today-row">
			<div class="stat">
				<span class="num">{fmt(summary.focusMs)}</span>
				<span class="cap">{t('history.focusTime')}</span>
			</div>
			<div class="stat">
				<span class="num">{fmt(summary.trainingMs + summary.quickMs)}</span>
				<span class="cap">{t('history.trainingTime')}</span>
			</div>
			<div class="stat">
				<span class="num">{t('history.sessions', { n: summary.sessions })}</span>
				<span class="cap"></span>
			</div>
		</div>
	</section>

	<section class="card list">
		{#if entries.length === 0}
			<p class="empty">{t('history.empty')}</p>
		{:else}
			{#each entries.slice().reverse() as e (e.id)}
				<div class="row">
					<span class="kind k-{e.kind}">{t(`history.kind.${e.kind}`)}</span>
					<span class="when">{fmtTime(e.startedAt)}</span>
					<span class="dur">{fmt(e.activeMs)}</span>
					<span class="status">{t(`history.status.${e.status}`)}</span>
				</div>
			{/each}
		{/if}
	</section>
</main>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	h2 {
		font-size: 1rem;
		margin: 0 0 0.6rem;
		color: var(--c-sub);
	}

	.today-row {
		display: flex;
		gap: 1.5rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
	}

	.num {
		font-weight: 700;
		font-size: 1.15rem;
		color: var(--c-primary);
	}

	.cap {
		font-size: 0.8rem;
		color: var(--c-sub);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.empty {
		color: var(--c-sub);
		margin: 0.2rem 0;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.kind {
		font-weight: 700;
		color: var(--c-primary);
		min-width: 3.2em;
	}

	.k-focus {
		color: var(--c-focus-accent);
	}

	.k-quick {
		color: var(--c-reminder-accent);
	}

	.when {
		color: var(--c-sub);
		flex: 1;
	}

	.status {
		font-size: 0.8rem;
		color: var(--c-sub);
	}
</style>
