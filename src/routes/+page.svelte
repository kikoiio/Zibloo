<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '../state/i18n.svelte.ts';
	import type { MessageKey } from '../i18n/messages.ts';
	import { settings } from '../state/settings.svelte.ts';
	import { timer, startSession, greet } from '../state/timer.svelte.ts';
	import * as engine from '../core/timer/engine.ts';
	import { mapZibloo } from '../core/zibloo/mapping.ts';
	import type { PhaseView } from '../core/timer/types.ts';
	import ZiblooPresenter from '../zibloo/ZiblooPresenter.svelte';

	const hour = new Date().getHours();
	const greetingKey: MessageKey = hour < 11 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';

	const QUICK = [1, 3, 5, 10];

	function startQuick(minutes: number): void {
		startSession('quick', { kind: 'quick', durationSec: minutes * 60 });
		goto('/run');
	}

	// 主页投影:与引擎同一推导,不复制逻辑
	function projectSafe(): PhaseView | null {
		const s = timer.session;
		if (!s || s.endedAt !== null) return null;
		const eff = s.pausedAt ?? (timer.now || Date.now());
		return engine.projectSession(s, eff);
	}

	const presentation = $derived(
		mapZibloo({
			activity: timer.session?.kind ?? 'none',
			view: timer.session ? projectSafe() : null,
			paused: timer.session !== null && timer.session.pausedAt !== null,
			celebrating: timer.celebrating,
			reminding: timer.reminding,
			greeted: timer.greeted,
			reducedMotion: settings.reducedMotion
		})
	);
</script>

<main class="home">
	<img class="lockup" src="/zibloo/zibloo-lockup.svg" alt="zibloo" />
	<p class="greeting">{t(greetingKey)}</p>

	<div class="stage">
		<ZiblooPresenter presentation={presentation} onclick={greet} />
	</div>

	<div class="entries">
		<a class="card entry training" href="/training">
			<span class="emoji">🏃</span>
			<strong>{t('mode.training.name')}</strong>
			<span class="desc">{t('mode.training.desc')}</span>
		</a>
		<a class="card entry focus" href="/focus">
			<span class="emoji">🎯</span>
			<strong>{t('mode.focus.name')}</strong>
			<span class="desc">{t('mode.focus.desc')}</span>
		</a>
		<a class="card entry reminder" href="/reminders">
			<span class="emoji">⏰</span>
			<strong>{t('mode.reminder.name')}</strong>
			<span class="desc">{t('mode.reminder.desc')}</span>
		</a>
	</div>

	<section class="card quick">
		<h2>{t('quick.title')}</h2>
		<div class="quick-row">
			{#each QUICK as n (n)}
				<button class="btn ghost" onclick={() => startQuick(n)}>{t('quick.minutes', { n })}</button>
			{/each}
		</div>
	</section>

	<footer>
		<a href="/history">{t('history.title')}</a>
		<span>·</span>
		<a href="/settings">{t('settings.title')}</a>
	</footer>
</main>

<style>
	.home {
		max-width: 560px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		min-height: 100dvh;
	}

	.lockup {
		width: min(62vw, 240px);
		margin-top: 0.5rem;
	}

	.greeting {
		margin: 0;
		color: var(--c-sub);
	}

	.stage {
		width: 100%;
		margin: 0.5rem 0;
	}

	.entries {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		width: 100%;
	}

	.entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1rem 0.5rem;
		text-align: center;
		color: var(--c-text);
		border-top: 4px solid var(--c-primary);
	}

	.entry.focus {
		border-top-color: var(--c-focus-accent);
	}

	.entry.reminder {
		border-top-color: var(--c-reminder-accent);
	}

	.entry .emoji {
		font-size: 1.6rem;
	}

	.entry .desc {
		font-size: 0.78rem;
		color: var(--c-sub);
	}

	.quick {
		width: 100%;
	}

	.quick h2 {
		font-size: 1rem;
		margin: 0 0 0.75rem;
	}

	.quick-row {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	footer {
		display: flex;
		gap: 0.75rem;
		color: var(--c-sub);
		margin-top: auto;
	}

	@media (max-width: 480px) {
		.entries {
			grid-template-columns: 1fr;
		}
		.entry {
			flex-direction: row;
			justify-content: flex-start;
			gap: 0.75rem;
			text-align: left;
		}
	}
</style>
