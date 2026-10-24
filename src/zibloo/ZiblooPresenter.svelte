<script lang="ts">
	// ZiblooPresenter — 只吃 ZiblooPresentation(A0 §3)。渲染 B2 五姿态帧:
	// 四帧划水循环 + 抬爪招呼;整图轻悬浮;reduced-motion 时冻结。
	import type { ZiblooPresentation } from '../core/zibloo/mapping.ts';

	let { presentation, onclick }: { presentation: ZiblooPresentation; onclick?: () => void } = $props();

	const FRAMES = ['stroke-a', 'stroke-b', 'stroke-c', 'stroke-d'] as const;
	const FRAME_URLS = FRAMES.map((f) => `/zibloo/frames/${f}.png`);
	const GREET_URL = '/zibloo/frames/greet.png';

	let frameIndex = $state(0);
	let greeting = $state(false);
	let cycleTimer: ReturnType<typeof setInterval> | null = null;

	// 姿态 → 帧循环速度;static 一律冻结在第一划水帧
	const SPEED: Record<string, number | null> = {
		'idle-float': 700,
		'train-exert': 320,
		'train-rest': 650,
		'focus-quiet': null,
		'focus-stir': 520,
		'summon-pop': 300,
		celebrate: 240
	};

	$effect(() => {
		const pose = presentation.pose;
		const speed = presentation.motion === 'static' ? null : SPEED[pose] ?? null;
		if (cycleTimer) {
			clearInterval(cycleTimer);
			cycleTimer = null;
		}
		if (greeting) return; // 招呼期间由招呼帧接管
		if (speed === null) {
			frameIndex = 0;
			return;
		}
		cycleTimer = setInterval(() => {
			frameIndex = (frameIndex + 1) % FRAMES.length;
		}, speed);
		return () => {
			if (cycleTimer) clearInterval(cycleTimer);
			cycleTimer = null;
		};
	});

	// 招呼声事件 → 显示抬爪帧一小段时间
	$effect(() => {
		if (presentation.cue === 'greet' && presentation.motion !== 'static') {
			greeting = true;
			const timer = setTimeout(() => {
				greeting = false;
			}, 1_400);
			return () => clearTimeout(timer);
		}
		greeting = false;
	});

	const float = $derived(presentation.motion !== 'static');
</script>

<div class="zibloo-wrap" class:float>
	<button
		type="button"
		class="zibloo-stage"
		class:celebrate={presentation.pose === 'celebrate'}
		class:summon={presentation.pose === 'summon-pop'}
		aria-label="Zibloo"
		onclick={onclick}
	>
		<svg viewBox="0 0 800 735" role="img" aria-hidden="true">
			{#each FRAME_URLS as url, i (url)}
				<image href={url} x="0" y="0" width="800" height="735" opacity={greeting || i === frameIndex ? 1 : 0} />
			{/each}
			<image href={GREET_URL} x="0" y="0" width="800" height="735" opacity={greeting ? 1 : 0} />
		</svg>
		{#if presentation.particles === 'bubbles' && presentation.motion !== 'static'}
			<span class="bubble b1"></span>
			<span class="bubble b2"></span>
			<span class="bubble b3"></span>
		{/if}
	</button>
</div>

<style>
	.zibloo-wrap {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.zibloo-wrap.float {
		animation: bob 3.6s ease-in-out infinite;
	}

	@keyframes bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	.zibloo-stage {
		position: relative;
		width: min(64vw, 300px);
		padding: 0;
		transition: transform 0.15s ease;
	}

	.zibloo-stage:active {
		transform: scale(0.96);
	}

	.zibloo-stage svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.zibloo-stage.summon {
		animation: pop 0.5s ease;
	}

	@keyframes pop {
		0% {
			transform: scale(0.7);
		}
		60% {
			transform: scale(1.08);
		}
		100% {
			transform: scale(1);
		}
	}

	.zibloo-stage.celebrate {
		animation: cheer 0.6s ease-in-out infinite;
	}

	@keyframes cheer {
		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}
		50% {
			transform: translateY(-14px) rotate(2deg);
		}
	}

	.bubble {
		position: absolute;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.75);
		box-shadow: inset 0 0 0 2px rgba(36, 129, 142, 0.25);
		animation: rise 2.6s ease-in infinite;
	}

	.b1 {
		width: 10px;
		height: 10px;
		left: 18%;
		animation-delay: 0s;
	}

	.b2 {
		width: 7px;
		height: 7px;
		left: 28%;
		animation-delay: 0.9s;
	}

	.b3 {
		width: 13px;
		height: 13px;
		left: 12%;
		animation-delay: 1.7s;
	}

	@keyframes rise {
		0% {
			opacity: 0;
			transform: translateY(0);
		}
		15% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-90px);
		}
	}
</style>
