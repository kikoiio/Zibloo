<script lang="ts">
	import { compact, PLATFORM_SCORE, PLATFORM_SHORT, type TrendRecord } from '../core/trending/hit.ts';
	import { t } from '../state/i18n.svelte.ts';
	import { setNote } from '../state/board.svelte.ts';

	let { item, onClose }: { item: TrendRecord; onClose: () => void } = $props();

	const daily = $derived(item.history);
	const maxGain = $derived(Math.max(...daily.map((point) => point.gained), 1));
</script>

<div class="zb-backdrop" onclick={onClose} role="presentation"></div>
<div class="zb-drawer" role="dialog" aria-label={item.name}>
	<header>
		<h2>{item.name}</h2>
		<button type="button" class="btn" onclick={onClose}>{t('board.close')}</button>
	</header>
	{#if item.description}
		<p>{item.description}</p>
	{/if}
	<div class="zb-stats">
		<div>
			<span>{PLATFORM_SHORT[item.platform]}</span>
			<b>{compact(item.score)}{PLATFORM_SCORE[item.platform]}</b>
		</div>
		<div>
			<span>{t('board.today')}</span>
			<b>{item.gained > 0 ? `+${compact(item.gained)}` : '—'}</b>
		</div>
		<div>
			<span>{t('board.days', { n: item.consecutiveDays })}</span>
			<b>{item.consecutiveDays}</b>
		</div>
		<div>
			<span>{t('board.firstSeen')}</span>
			<b>{item.firstSeen}</b>
		</div>
		{#if item.language}
			<div>
				<span>{t('board.language')}</span>
				<b>{item.language}</b>
			</div>
		{/if}
	</div>
	{#if daily.length > 1}
		<div class="zb-spark" aria-hidden="true">
			{#each daily as point, index (point.date)}
				<i class:tip={index === daily.length - 1} style={`height:${Math.max(8, (point.gained / maxGain) * 100)}%`} title={`${point.date} +${point.gained}`}></i>
			{/each}
		</div>
	{/if}
	<label>
		<div>{t('board.note')}</div>
		<textarea
			value={item.note}
			placeholder={t('board.noteHint')}
			oninput={(event) => setNote(item.id, event.currentTarget.value)}
		></textarea>
	</label>
	<a class="btn" href={item.url} target="_blank" rel="noreferrer">{t('board.openSource')}</a>
</div>
