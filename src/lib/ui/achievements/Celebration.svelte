<script lang="ts">
	// The full-screen celebration, opened from the achievement toast: the number counting up, the picture dropping in,
	// the comparison and its line, a little confetti. Reduced motion shows the same screen still. Done or Escape
	// closes it; nothing else waits on it.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { celebration, closeCelebration } from '#lib/client/celebration.svelte.ts';
	import Picture from './Picture.svelte';
	import {
		achievementDetail,
		achievementEyebrow,
		achievementLine,
		achievementPicture,
		achievementTitle
	} from './text.ts';

	const CONFETTI = [
		'var(--badge-coral)',
		'var(--badge-amber)',
		'var(--badge-green)',
		'var(--badge-blue)',
		'var(--badge-rose)'
	];
	let shown = $state(0);
	let done = $state<HTMLButtonElement>();
	const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	const pieces = Array.from({ length: 36 }, (_, i) => ({
		left: Math.random() * 100,
		colour: CONFETTI[i % CONFETTI.length],
		dx: (Math.random() - 0.5) * 160,
		rot: Math.random() * 720,
		duration: 1.6 + Math.random() * 1.6,
		delay: Math.random() * 0.5
	}));

	$effect(() => {
		const a = celebration.open;
		if (!a) return;
		done?.focus();
		const target = typeof a.level === 'number' ? a.level : 0;
		if (reduced() || !target) {
			shown = target;
			return;
		}
		const t0 = performance.now();
		let frame = 0;
		const step = (t: number) => {
			const k = Math.min(1, (t - t0) / 900);
			shown = Math.round(target * (1 - (1 - k) ** 3));
			if (k < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
</script>

<svelte:window onkeydown={(e) => celebration.open && e.key === 'Escape' && closeCelebration()} />

{#if celebration.open}
	{@const a = celebration.open}
	<div
		role="dialog"
		aria-modal="true"
		aria-label={m.achievement_celebration({ title: achievementTitle(a) })}
		class="celebrate fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-hidden px-7 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+40px)] text-center"
	>
		{#if !reduced()}
			{#each pieces as p, i (i)}
				<i
					class="confetti"
					aria-hidden="true"
					style:left="{p.left}%"
					style:background={p.colour}
					style:--dx="{p.dx}px"
					style:--rot="{p.rot}deg"
					style:animation-duration="{p.duration}s"
					style:animation-delay="{p.delay}s"
				></i>
			{/each}
		{/if}
		<p class="text-[0.8125rem] font-bold tracking-[0.06em] text-muted uppercase">
			{achievementEyebrow(a)}
		</p>
		{#if a.kind === 'first'}
			<p class="font-display text-[2.125rem] leading-tight font-extrabold">{achievementTitle(a)}</p>
		{:else}
			<p
				class="font-display text-[4rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums"
			>
				{a.kind === 'goal'
					? String(a.level).replace('.', ',')
					: shown}{#if a.kind !== 'streak'}<small class="font-sans text-[1.75rem] text-muted">
						kg</small
					>{/if}
			</p>
		{/if}
		<div class="stage relative grid h-[150px] place-items-center" aria-hidden="true">
			<span class="absolute bottom-0.5 h-3.5 w-24 rounded-[50%] shadow"></span>
			<span class="obj"><Picture hex={achievementPicture(a)} size={120} /></span>
		</div>
		{#if a.kind === 'weight'}
			<p class="says font-display text-[1.5rem] leading-tight font-extrabold">
				{achievementDetail(a)}.
			</p>
		{/if}
		<p class="sub max-w-[28ch] text-[0.9375rem] text-muted">{achievementLine(a)}</p>
		<button
			bind:this={done}
			type="button"
			onclick={closeCelebration}
			class="done mt-2.5 min-h-[52px] min-w-[200px] rounded-tile bg-fill px-6 text-[1.0625rem] font-[750] text-on-accent"
			>{m.achievement_done()}</button
		>
		<a
			href={resolve('/(app)/achievements')}
			onclick={closeCelebration}
			class="done grid min-h-11 place-items-center px-3 text-[0.9375rem] font-semibold text-accent"
			>{m.achievement_see_all()}</a
		>
	</div>
{/if}

<style>
	.celebrate {
		background: radial-gradient(circle at 50% 38%, var(--soft), var(--bg) 70%);
	}
	.says {
		max-width: 16ch;
		text-wrap: balance;
		animation: rise 500ms 500ms ease-out both;
	}
	.sub {
		animation: rise 500ms 700ms ease-out both;
	}
	.done {
		animation: rise 500ms 1000ms ease-out both;
	}
	.obj {
		will-change: transform;
		animation: drop 760ms cubic-bezier(0.34, 1.45, 0.64, 1) both;
	}
	.shadow {
		background: rgb(0 0 0 / 0.14);
		will-change: transform, opacity;
		animation: shade 760ms cubic-bezier(0.34, 1.45, 0.64, 1) both;
	}
	.confetti {
		position: absolute;
		top: -12px;
		width: 9px;
		height: 14px;
		border-radius: 2px;
		will-change: transform;
		animation: fall cubic-bezier(0.25, 0.5, 0.5, 1) forwards;
	}
	@keyframes drop {
		from {
			transform: translate3d(0, -240px, 0) rotate(-14deg) scale(0.92);
		}
	}
	@keyframes shade {
		from {
			transform: scale(0.3);
			opacity: 0;
		}
	}
	@keyframes rise {
		from {
			transform: translateY(16px);
			opacity: 0;
		}
	}
	@keyframes fall {
		to {
			transform: translate3d(var(--dx), 110vh, 0) rotate(var(--rot));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.says,
		.sub,
		.done,
		.obj,
		.shadow {
			animation: none;
		}
	}
</style>
