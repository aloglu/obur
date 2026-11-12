<script lang="ts">
	// The full-screen celebration, opened from the achievement toast: the number counting up, the picture dropping in,
	// the comparison and its line, and confetti that falls and stays (client/confetti.ts). A tap on the background
	// throws it up like a snow globe. Reduced motion shows the same screen still, without confetti. Done or Escape
	// closes it; nothing else waits on it, and the page behind is held still.
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { page } from '$app/state';
	import { celebration, closeCelebration } from '#lib/client/celebration.svelte.ts';
	import { STILL, countFor, scatter, step, stir, type Piece } from '#lib/client/confetti.ts';
	import { lockPageScroll } from '#lib/client/scroll-lock.ts';
	import Picture from './Picture.svelte';
	import {
		achievementDetail,
		achievementEyebrow,
		achievementLine,
		achievementPicture,
		achievementTitle
	} from './text.ts';

	const CONFETTI = [
		'--badge-coral',
		'--badge-amber',
		'--badge-green',
		'--badge-blue',
		'--badge-rose'
	];
	let shown = $state(0);
	let done = $state<HTMLButtonElement>();
	let canvas = $state<HTMLCanvasElement>();
	const TICK = 1 / 60;
	const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

	let stirConfetti: (() => void) | undefined;

	function poke(event: MouseEvent) {
		if (!(event.target as Element).closest('a, button')) stirConfetti?.();
	}

	$effect(() => {
		if (!celebration.open) return;
		return lockPageScroll();
	});

	$effect(() => {
		const node = canvas;
		if (!celebration.open || !node || reduced()) return;
		const context = node.getContext('2d');
		if (!context) return;
		const style = getComputedStyle(node);
		const colours = CONFETTI.map((name) => style.getPropertyValue(name).trim());
		const box = { width: node.clientWidth, height: node.clientHeight };
		let pieces: Piece[] = scatter(countFor(box.width), box, colours.length);
		const down = { x: 0, y: 1 };
		let owed = 0;
		let frame = 0;
		let last = 0;
		let quiet = 0;

		const wake = () => {
			quiet = 0;
			delete node.dataset.still;
			if (!frame) {
				last = 0;
				frame = requestAnimationFrame(tick);
			}
		};
		const fit = () => {
			const ratio = Math.min(devicePixelRatio || 1, 3);
			box.width = node.clientWidth;
			box.height = node.clientHeight;
			node.width = Math.round(box.width * ratio);
			node.height = Math.round(box.height * ratio);
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			wake();
		};
		const draw = () => {
			context.clearRect(0, 0, box.width, box.height);
			for (const p of pieces) {
				// Paper turning over as it falls: never quite edge-on, so a resting piece stays visible.
				const turn = Math.cos(p.flip);
				const sin = Math.sin(p.angle);
				const cos = Math.cos(p.angle);
				const tall = (Math.sign(turn) || 1) * Math.max(Math.abs(turn), 0.4);
				context.save();
				context.transform(cos, sin, -sin * tall, cos * tall, p.x, p.y);
				context.fillStyle = colours[p.colour];
				context.fillRect(-4.5, -7, 9, 14);
				context.restore();
			}
		};
		const tick = (now: number) => {
			// Always moved on in sixtieths of a second, however often the screen draws: the pile settles the same on a
			// slow phone. A long gap (the app was in the background) is a couple of steps, not a leap.
			owed = Math.min(owed + (now - (last || now)) / 1000, 3 * TICK);
			last = now;
			for (; owed >= TICK; owed -= TICK) {
				quiet = step(pieces, box, down, TICK) < STILL ? quiet + 1 : 0;
			}
			draw();
			// Still for half a second: stop drawing until something moves it.
			frame = quiet < 30 ? requestAnimationFrame(tick) : 0;
			if (!frame) node.dataset.still = 'true';
		};

		stirConfetti = () => {
			stir(pieces, down);
			wake();
		};

		const sized = new ResizeObserver(fit);
		sized.observe(node);
		fit();
		return () => {
			cancelAnimationFrame(frame);
			sized.disconnect();
			stirConfetti = undefined;
			pieces = [];
		};
	});

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
	<!-- Tapping the background only plays with the confetti: decoration, with nothing for a keyboard to miss. -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		aria-label={m.achievement_celebration({ title: achievementTitle(a) })}
		onclick={poke}
		class="celebrate fixed inset-0 isolate z-50 flex flex-col items-center justify-center gap-3 overflow-hidden px-7 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+40px)] text-center"
	>
		{#if !reduced()}
			<canvas
				bind:this={canvas}
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 -z-10 size-full"
			></canvas>
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
		<!-- Not when replayed from the badge page itself. -->
		{#if page.url.pathname !== resolve('/(app)/achievements')}
			<a
				href={resolve('/(app)/achievements')}
				onclick={closeCelebration}
				class="done grid min-h-11 place-items-center px-3 text-[0.9375rem] font-semibold text-accent"
				>{m.achievement_see_all()}</a
			>
		{/if}
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
