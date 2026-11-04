<script lang="ts">
	import { onMount } from 'svelte';
	import {
		compact,
		PLATFORM_LABEL,
		PLATFORM_SCORE,
		PLATFORMS,
		type Platform,
		type TrendRecord
	} from '../core/trending/hit.ts';
	import * as engine from '../core/timer/engine.ts';
	import type { Phase, PomodoroPlan, QuickPlan, TrainingPlan } from '../core/timer/types.ts';
	import type { MessageKey } from '../i18n/messages.ts';
	import { loadBoard, collectTrends, board } from '../state/board.svelte.ts';
	import { t } from '../state/i18n.svelte.ts';
	import { loadPresets, trainingPresets } from '../state/presets.svelte.ts';
	import { boardPresentation, endCard, loadRuns, pauseCard, resumeCard, runFor, runs, skipCard, startCardRun } from '../state/runs.svelte.ts';
	import { greet } from '../state/timer.svelte.ts';
	import ZiblooPresenter from '../zibloo/ZiblooPresenter.svelte';
	import TrendDrawer from './TrendDrawer.svelte';
	import './board.css';

	type TrendCard = {
		kind: 'trend';
		id: string;
		title: string;
		detail: string;
		href: string;
		platform: Platform;
		language: string | null;
	};
	type TimerCard =
		| { kind: 'training'; id: string; title: string; detail: string; plan: TrainingPlan }
		| { kind: 'focus'; id: string; title: string; detail: string; plan: PomodoroPlan }
		| { kind: 'quick'; id: string; title: string; detail: string; plan: QuickPlan };
	type Card = TrendCard | TimerCard;

	const TEMPLATES: { id: string; label: MessageKey; plan: TrainingPlan }[] = [
		{ id: 'training:classic', label: 'training.template.classic', plan: { kind: 'training', prepareSec: 10, workSec: 30, restSec: 15, rounds: 8 } },
		{ id: 'training:tabata', label: 'training.template.tabata', plan: { kind: 'training', prepareSec: 10, workSec: 20, restSec: 10, rounds: 8 } },
		{ id: 'training:strength', label: 'training.template.strength', plan: { kind: 'training', prepareSec: 10, workSec: 40, restSec: 20, rounds: 6 } },
		{ id: 'training:endurance', label: 'training.template.endurance', plan: { kind: 'training', prepareSec: 10, workSec: 60, restSec: 30, rounds: 4 } }
	];
	const FOCUS_MIN = [15, 20, 25, 50];
	const QUICK_MIN = [1, 3, 5, 10];

	let query = $state('');
	let openId = $state<string | null>(null);
	let helpOpen = $state(false);
	const today = new Date().toISOString().slice(0, 10);

	onMount(() => {
		loadBoard();
		loadRuns();
		loadPresets();
		function onKey(event: KeyboardEvent): void {
			const tag = (event.target as HTMLElement | null)?.tagName;
			const typing = tag === 'INPUT' || tag === 'TEXTAREA';
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
			if (event.key === 'c') void collectTrends();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const presentation = $derived(boardPresentation());

	function focusPlan(minutes: number): PomodoroPlan {
		return { kind: 'focus', focusSec: minutes * 60, shortRestSec: 5 * 60, longRestSec: 15 * 60, longRestEvery: 4, rounds: 4 };
	}

	function quickPlan(minutes: number): QuickPlan {
		return { kind: 'quick', durationSec: minutes * 60 };
	}

	function matches(title: string, detail: string, extra = ''): boolean {
		const q = query.trim().toLowerCase();
		if (!q) return true;
		return `${title} ${detail} ${extra}`.toLowerCase().includes(q);
	}

	const timerCards = $derived.by(() => {
		const list: TimerCard[] = [];
		for (const template of TEMPLATES) {
			const title = t(template.label);
			const detail = `${template.plan.workSec}/${template.plan.restSec} × ${template.plan.rounds}`;
			if (matches(title, detail)) list.push({ kind: 'training', id: template.id, title, detail, plan: template.plan });
		}
		for (const preset of trainingPresets.list) {
			const detail = `${preset.plan.workSec}/${preset.plan.restSec} × ${preset.plan.rounds}`;
			if (matches(preset.name, detail)) list.push({ kind: 'training', id: `preset:${preset.id}`, title: preset.name, detail, plan: preset.plan });
		}
		for (const minutes of FOCUS_MIN) {
			const title = `${t('mode.focus.name')} ${minutes}`;
			if (matches(title, '')) list.push({ kind: 'focus', id: `focus:${minutes}`, title, detail: t('mode.focus.desc'), plan: focusPlan(minutes) });
		}
		for (const minutes of QUICK_MIN) {
			const title = t('quick.minutes', { n: minutes });
			if (matches(title, '')) list.push({ kind: 'quick', id: `quick:${minutes}`, title, detail: t('quick.title'), plan: quickPlan(minutes) });
		}
		for (const pinned of board.pinned) {
			if (!matches(pinned.label, '')) continue;
			if (pinned.plan.kind === 'training') {
				list.push({
					kind: 'training',
					id: pinned.id,
					title: pinned.label,
					detail: `${pinned.plan.workSec}/${pinned.plan.restSec} × ${pinned.plan.rounds}`,
					plan: pinned.plan
				});
			} else if (pinned.plan.kind === 'focus') {
				list.push({ kind: 'focus', id: pinned.id, title: pinned.label, detail: t('mode.focus.desc'), plan: pinned.plan });
			} else {
				list.push({ kind: 'quick', id: pinned.id, title: pinned.label, detail: t('quick.title'), plan: pinned.plan });
			}
		}
		return [...list].sort((a, b) => Number(Boolean(runFor(b.id))) - Number(Boolean(runFor(a.id))));
	});

	const sourceGroups = $derived.by(() => {
		const groups: { platform: Platform; cards: TrendCard[] }[] = [];
		for (const platform of PLATFORMS) {
			const cards: TrendCard[] = [];
			for (const trend of board.trends) {
				if (trend.platform !== platform) continue;
				const extra = `${PLATFORM_LABEL[trend.platform]} ${trend.note} ${trend.language ?? ''}`;
				if (!matches(trend.name, trend.description, extra)) continue;
				cards.push({
					kind: 'trend',
					id: trend.id,
					title: trend.name,
					detail: trend.description,
					href: trend.url,
					platform: trend.platform,
					language: trend.language
				});
			}
			if (cards.length > 0) groups.push({ platform, cards });
		}
		return groups;
	});

	const trendById = $derived(new Map(board.trends.map((item: TrendRecord) => [item.id, item])));
	const openItem = $derived(openId ? (trendById.get(openId) ?? null) : null);

	function phaseKey(phase: Phase): MessageKey {
		switch (phase) {
			case 'work':
				return 'phase.work';
			case 'rest':
				return 'phase.rest';
			case 'long-rest':
				return 'phase.long-rest';
			case 'prepare':
				return 'phase.prepare';
			default: {
				const neverPhase: never = phase;
				return neverPhase;
			}
		}
	}

	function formatRemain(ms: number): string {
		const total = Math.max(0, Math.ceil(ms / 1000));
		const minutes = Math.floor(total / 60);
		const seconds = total % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	function start(card: Card): void {
		if (card.kind === 'trend') return;
		startCardRun({ cardId: card.id, kind: card.kind, plan: card.plan });
	}

	function formatCollectAt(at: number | null): string {
		if (at === null) return t('board.neverCollect');
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
	}

	function openTrend(card: Card): void {
		if (card.kind === 'trend') openId = card.id;
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
			{#if runs.items.length > 0}<span class="zb-running">{t('board.runningMany', { n: runs.items.length })}</span>{/if}
			<span>{board.lastCollectAt === null ? formatCollectAt(null) : t('board.lastCollectAt', { time: formatCollectAt(board.lastCollectAt) })}</span>
			<span class="zb-total">{t('board.itemCount', { n: board.trends.length })}</span>
		</span>
		<button type="button" class="zb-collect" onclick={() => void collectTrends()} disabled={board.collecting}>
			{board.collecting ? t('board.collecting') : t('board.collect')}
		</button>
	</header>

	<main class="zb-main">
		{#if board.collectError}
			<p class="zb-error">{board.collectError}</p>
		{/if}

		{#if board.trends.length === 0}
			<div class="zb-empty-state">
				<p>{t('board.emptyTrends')}</p>
				<button type="button" class="zb-collect" onclick={() => void collectTrends()} disabled={board.collecting}>
					{board.collecting ? t('board.collecting') : t('board.collectNow')}
				</button>
			</div>
		{/if}

		<div class="zb-board" role="region" aria-label={t('board.board')}>
			{#if timerCards.length > 0}
				<section class="zb-source zb-timers" aria-label={t('board.timers')}>
					<header>
						<h2>{t('board.timers')}</h2>
						<small>{timerCards.length}</small>
					</header>
					<div class="zb-source-cards">
						{#each timerCards as card (card.id)}
							{@render tile(card)}
						{/each}
					</div>
				</section>
			{/if}
			{#each sourceGroups as group (group.platform)}
				<section class="zb-source" aria-label={PLATFORM_LABEL[group.platform]}>
					<header>
						<h2>{PLATFORM_LABEL[group.platform]}</h2>
						<small>{group.cards.length}</small>
					</header>
					<div class="zb-source-cards">
						{#each group.cards as card (card.id)}
							{@render tile(card)}
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</main>
</div>

{#if openItem}
	<TrendDrawer item={openItem} onClose={() => (openId = null)} />
{/if}

{#if helpOpen}
	<div class="zb-help" onclick={() => (helpOpen = false)} role="presentation">
		<div class="zb-help-card">
			<h2>{t('board.help')}</h2>
			<dl>
				<dt>/</dt>
				<dd>{t('board.search')}</dd>
				<dt>c</dt>
				<dd>{t('board.helpCollect')}</dd>
				<dt>esc</dt>
				<dd>{t('board.close')}</dd>
			</dl>
		</div>
	</div>
{/if}

{#snippet tile(card: Card)}
	{@const run = runFor(card.id)}
	{@const phase = run ? engine.projectSession(run.session, runs.now || Date.now()) : null}
	{#if card.kind === 'trend'}
		<div
			class="zb-card"
			class:selected={openId === card.id}
			role="button"
			tabindex="0"
			onclick={() => openTrend(card)}
			onkeydown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					openTrend(card);
				}
			}}
		>
			{@render face(card, run, phase)}
		</div>
	{:else}
		<div
			class="zb-card timer"
			class:quick={card.kind === 'quick'}
			class:clock={run !== null}
			class:paused={run !== null && run.session.pausedAt !== null}
			class:zb-run={run !== null}
			role="group"
			aria-label={card.title}
		>
			{@render face(card, run, phase)}
		</div>
	{/if}
{/snippet}

{#snippet face(card: Card, run: ReturnType<typeof runFor>, phase: ReturnType<typeof engine.projectSession>)}
	{#if card.kind === 'trend'}
		{@const trend = trendById.get(card.id)}
		<h3>{card.title}</h3>
		{#if card.detail}<p>{card.detail}</p>{/if}
		{#if trend}
			<div class="zb-item-meta">
				{#if trend.gained > 0}
					<span class="zb-heat">+{compact(trend.gained)}</span>
				{/if}
				{#if trend.language}
					<span>{trend.language}</span>
				{/if}
				<span>{compact(trend.score)}{PLATFORM_SCORE[trend.platform]}</span>
				{#if trend.consecutiveDays > 1}
					<span>{t('board.days', { n: trend.consecutiveDays })}</span>
				{/if}
				{#if trend.lastSeen === today && trend.firstSeen !== today}
					<span>{t('board.reappeared')}</span>
				{/if}
				{#if trend.note}
					<span>{t('board.note')}</span>
				{/if}
			</div>
		{/if}
	{:else}
		<h3>{card.title}</h3>
		{#if card.detail}<p>{card.detail}</p>{/if}
	{/if}
	{#if run && phase}
		<p class="remain">{formatRemain(phase.remainMs)}</p>
		<p class="phase">{t(phaseKey(phase.phase))} · {t('run.round', { n: phase.round, m: phase.rounds })}</p>
		<div class="zb-actions">
			{#if run.session.pausedAt !== null}
				<button type="button" class="btn" onclick={() => resumeCard(card.id)}>{t('run.resume')}</button>
			{:else}
				<button type="button" class="btn" onclick={() => pauseCard(card.id)}>{t('run.pause')}</button>
			{/if}
			<button type="button" class="btn" onclick={() => skipCard(card.id)}>{t('run.skip')}</button>
			<button type="button" class="btn" onclick={() => endCard(card.id)}>{t('run.end')}</button>
		</div>
	{:else if card.kind === 'training' || card.kind === 'focus' || card.kind === 'quick'}
		<button type="button" class="btn" onclick={() => start(card)}>{card.kind === 'quick' ? card.title : t('common.start')}</button>
	{/if}
{/snippet}
