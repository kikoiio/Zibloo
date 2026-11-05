<script lang="ts">
	import { onMount } from 'svelte';
	import { compact, PLATFORM_LABEL, PLATFORM_SCORE, type TrendRecord } from '../core/trending/hit.ts';
	import { discoverItems, type DiscoverySort, type DiscoveryView } from '../core/trending/discovery.ts';
	import * as engine from '../core/timer/engine.ts';
	import type { QuickPlan } from '../core/timer/types.ts';
	import { board, collectTrends, loadBoard, toggleSaved } from '../state/board.svelte.ts';
	import { t } from '../state/i18n.svelte.ts';
	import { boardPresentation, endCard, loadRuns, pauseCard, resumeCard, runFor, runs, startCardRun } from '../state/runs.svelte.ts';
	import { greet } from '../state/timer.svelte.ts';
	import ZiblooPresenter from '../zibloo/ZiblooPresenter.svelte';
	import TrendDrawer from './TrendDrawer.svelte';
	import './board.css';

	const SIMPLE_TIMER_ID = 'timer:simple';
	const PAGE_SIZE = 24;
	let query = $state('');
	let durationMinutes = $state<number | undefined>(25);
	let openId = $state<string | null>(null);
	let helpOpen = $state(false);
	let view = $state<DiscoveryView>('discover');
	let sort = $state<DiscoverySort>('recent');
	let visibleLimit = $state(PAGE_SIZE);
	const today = new Date().toISOString().slice(0, 10);
	const canStartTimer = $derived(
		durationMinutes !== undefined && Number.isInteger(durationMinutes) && durationMinutes >= 1 && durationMinutes <= 1440
	);
	const timerRun = $derived(runFor(SIMPLE_TIMER_ID));
	const timerPhase = $derived(timerRun ? engine.projectSession(timerRun.session, runs.now || Date.now()) : null);

	onMount(() => {
		loadBoard();
		loadRuns();
		function onKey(event: KeyboardEvent): void {
			const target = event.target;
			const tag = target instanceof HTMLElement ? target.tagName : '';
			const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target instanceof HTMLElement && target.isContentEditable);
			if (event.key === 'Escape') {
				openId = null;
				helpOpen = false;
				return;
			}
			if (event.key === '/' && !typing) {
				event.preventDefault();
				document.querySelector<HTMLInputElement>('.zb-search input')?.focus();
				return;
			}
			if (event.key === '?' && !typing) {
				event.preventDefault();
				helpOpen = !helpOpen;
				return;
			}
			if (typing) return;
			if (event.key.toLowerCase() === 'c') void collectTrends();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const presentation = $derived(boardPresentation());
	const trendById = $derived(new Map(board.trends.map((item) => [item.id, item])));
	const openItem = $derived(openId ? (trendById.get(openId) ?? null) : null);
	const orderedItems = $derived(
		discoverItems({ items: board.trends, query, view, savedIds: board.savedIds, sort })
	);
	const visibleItems = $derived(orderedItems.slice(0, visibleLimit));

	function quickPlan(minutes: number): QuickPlan {
		return { kind: 'quick', durationSec: minutes * 60 };
	}

	function startTimer(): void {
		if (!canStartTimer || durationMinutes === undefined) return;
		startCardRun({ cardId: SIMPLE_TIMER_ID, kind: 'quick', plan: quickPlan(durationMinutes) });
	}

	function formatRemain(ms: number): string {
		const total = Math.max(0, Math.ceil(ms / 1000));
		return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}

	function formatCollectAt(at: number | null): string {
		if (at === null) return t('board.neverCollect');
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
	}

	function formatDate(value: string): string {
		const timestamp = Date.parse(`${value}T00:00:00.000Z`);
		if (!Number.isFinite(timestamp)) return value;
		return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(timestamp);
	}

	function showMore(): void {
		visibleLimit += PAGE_SIZE;
	}
</script>

<div class="zb-app">
	<header class="zb-top">
		<ZiblooPresenter presentation={presentation} onclick={greet} size="companion" />
		<strong class="zb-name">Zibloo</strong>
		<label class="zb-search">
			<input type="search" bind:value={query} placeholder={t('board.search')} aria-label={t('board.search')} />
		</label>
		<span class="zb-meta">
			<span>{board.lastCollectAt === null ? formatCollectAt(null) : t('board.lastCollectAt', { time: formatCollectAt(board.lastCollectAt) })}</span>
			<span class="zb-total">{t('board.itemCount', { n: board.trends.length })}</span>
		</span>
		<button type="button" class="zb-collect" onclick={() => void collectTrends()} disabled={board.collecting}>
			{board.collecting ? t('board.collecting') : t('board.collect')}
		</button>
	</header>

	<main class="zb-main">
		{#if board.collectError}
			<aside class="zb-error" role="status">
				<strong>{t('board.collectIssue')}</strong>
				<span>{t('board.collectIssueHint')}</span>
				<details><summary>{t('board.details')}</summary><code>{board.collectError}</code></details>
			</aside>
		{/if}
		{#if board.saveError}<p class="zb-error" role="alert">{t('board.saveFailed')}</p>{/if}

		<section class="zb-intro">
			<div>
				<h1>{t('board.title')}</h1>
				<p>{t('board.subtitle')}</p>
			</div>
			<button class="zb-help-trigger" type="button" aria-label={t('board.helpButton')} onclick={() => (helpOpen = true)}>?</button>
		</section>

		<section class="zb-timer-bar" aria-label={t('board.timers')}>
			<div class="zb-timer-symbol" aria-hidden="true">◷</div>
			<div class="zb-timer-copy">
				<strong>{t('quick.title')}</strong>
				<small>{t('board.timerHint')}</small>
			</div>
			{#if timerRun && timerPhase}
				<strong class="zb-timer-remain" aria-live="off">{formatRemain(timerPhase.remainMs)}</strong>
				{#if timerRun.session.pausedAt !== null}<span class="zb-timer-status">{t('timer.paused')}</span>{/if}
				<div class="zb-timer-actions">
					{#if timerRun.session.pausedAt !== null}
						<button class="btn" type="button" onclick={() => resumeCard(SIMPLE_TIMER_ID)}>{t('run.resume')}</button>
					{:else}
						<button class="btn" type="button" onclick={() => pauseCard(SIMPLE_TIMER_ID)}>{t('run.pause')}</button>
					{/if}
					<button class="btn quiet" type="button" onclick={() => endCard(SIMPLE_TIMER_ID)}>{t('run.end')}</button>
				</div>
			{:else}
				<label class="zb-duration-control">
					<span>{t('timer.duration')}</span>
					<input aria-label={t('timer.duration')} type="number" min="1" max="1440" step="1" bind:value={durationMinutes} />
					<span>{t('common.min')}</span>
				</label>
				<button class="btn zb-start" type="button" onclick={startTimer} disabled={!canStartTimer}>{t('common.start')}</button>
			{/if}
		</section>

		{#if board.trends.length === 0}
			<section class="zb-empty-state">
				<h2>{t('board.emptyTitle')}</h2>
				<p>{t('board.emptyTrends')}</p>
				<button class="zb-collect" type="button" onclick={() => void collectTrends()} disabled={board.collecting}>
					{board.collecting ? t('board.collecting') : t('board.collectNow')}
				</button>
			</section>
		{:else}
			<section class="zb-discovery" aria-label={t('board.board')}>
				<div class="zb-discovery-head">
					<div class="zb-view-switch" aria-label={t('board.board')}>
						<button type="button" class:active={view === 'discover'} aria-pressed={view === 'discover'} onclick={() => (view = 'discover')}>
							{t('board.discover')}
						</button>
						<button type="button" class:active={view === 'saved'} aria-pressed={view === 'saved'} onclick={() => (view = 'saved')}>
							{t('board.saved')}<span>{board.savedIds.length}</span>
						</button>
					</div>
					<label class="zb-sort-control">
						<span>{t('board.sort')}</span>
						<select bind:value={sort}>
							<option value="recent">{t('board.sortRecent')}</option>
							<option value="rank">{t('board.sortRank')}</option>
						</select>
					</label>
				</div>
				<p class="zb-sort-hint">{sort === 'rank' ? t('board.rankHint') : t('board.recentHint')}</p>
				<p class="zb-result-count" aria-live="polite">{t('board.results', { n: orderedItems.length })}</p>

				{#if orderedItems.length === 0}
					<div class="zb-empty-state zb-no-results">
						<h2>{view === 'saved' && !query ? t('board.savedEmptyTitle') : t('board.noResultsTitle')}</h2>
						<p>{view === 'saved' && !query ? t('board.savedEmpty') : t('board.noResults')}</p>
						{#if query}
							<button class="btn" type="button" onclick={() => (query = '')}>{t('board.clearSearch')}</button>
						{:else if view === 'saved'}
							<button class="btn" type="button" onclick={() => (view = 'discover')}>{t('board.backDiscover')}</button>
						{/if}
					</div>
				{:else}
					<div class="zb-feed">
						{#each visibleItems as item (item.id)}
							<article class="zb-card">
								<div class="zb-card-topline">
									<span class="zb-source-label">{PLATFORM_LABEL[item.platform]}</span>
									<span class="zb-source-rank">#{item.rank}</span>
									<button
									class="zb-save"
									type="button"
									aria-label={t(board.savedIds.includes(item.id) ? 'board.unsaveItem' : 'board.saveItem', { name: item.name })}
									aria-pressed={board.savedIds.includes(item.id)}
									title={t(board.savedIds.includes(item.id) ? 'board.unsave' : 'board.save')}
									onclick={() => toggleSaved(item.id)}
								>{board.savedIds.includes(item.id) ? '★' : '☆'}</button>
								</div>
								<h2><button class="zb-card-title" type="button" onclick={() => (openId = item.id)}>{item.name}</button></h2>
								<p class="zb-card-description">{item.description || t('board.noDescription')}</p>
								<div class="zb-card-signals">
									{#if item.firstSeen === today}<span class="zb-new-label">{t('board.new')}</span>{/if}
									{#if item.score > 0}<span>{compact(item.score)}{PLATFORM_SCORE[item.platform]}</span>{/if}
									{#if item.gained > 0}<span class="zb-growth">+{compact(item.gained)} {PLATFORM_SCORE[item.platform]}</span>{/if}
									{#if item.consecutiveDays > 1}<span>{t('board.days', { n: item.consecutiveDays })}</span>{/if}
									{#if item.note}<span class="zb-note-signal">{t('board.note')}</span>{/if}
									<span class="zb-last-seen">{t('board.lastSeen', { date: formatDate(item.lastSeen) })}</span>
								</div>
								<footer>
									<button class="zb-details-link" type="button" onclick={() => (openId = item.id)}>{t('board.details')}</button>
									<a href={item.url} target="_blank" rel="noreferrer" aria-label={t('board.openItem', { name: item.name })}>{t('board.open')}</a>
								</footer>
							</article>
						{/each}
					</div>
					{#if visibleItems.length < orderedItems.length}
						<div class="zb-load-more-wrap">
							<p>{t('board.shown', { n: visibleItems.length, total: orderedItems.length })}</p>
							<button class="btn" type="button" onclick={showMore}>{t('board.showMore', { n: Math.min(PAGE_SIZE, orderedItems.length - visibleItems.length) })}</button>
						</div>
					{/if}
				{/if}
			</section>
		{/if}
	</main>
</div>

{#if openItem}
	<TrendDrawer item={openItem} onClose={() => (openId = null)} />
{/if}

{#if helpOpen}
	<div class="zb-help" role="presentation">
		<button class="zb-help-backdrop" type="button" aria-label={t('board.close')} onclick={() => (helpOpen = false)}></button>
		<div class="zb-help-card" role="dialog" aria-modal="true" aria-label={t('board.help')} tabindex="-1">
			<header>
				<h2>{t('board.help')}</h2>
				<button class="btn" type="button" onclick={() => (helpOpen = false)}>{t('board.close')}</button>
			</header>
			<dl>
				<dt>/</dt><dd>{t('board.search')}</dd>
				<dt>c</dt><dd>{t('board.helpCollect')}</dd>
				<dt>esc</dt><dd>{t('board.close')}</dd>
			</dl>
		</div>
	</div>
{/if}
