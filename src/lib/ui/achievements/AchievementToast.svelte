<script lang="ts">
	// The moment an achievement lands: a toast like the others, never blocking; tapping it opens the celebration.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';
	import {
		celebration,
		dismissToast,
		holdToast,
		openCelebration,
		releaseToast
	} from '#lib/client/celebration.svelte.ts';
	import { swipeAway } from '#lib/client/swipe-away.ts';
	import Picture from './Picture.svelte';
	import { achievementDetail, achievementPicture, achievementTitle } from './text.ts';
</script>

{#if celebration.toast}
	{@const a = celebration.toast}
	{@const title = achievementTitle(a)}
	{@const detail = achievementDetail(a)}
	<!-- Swiped away on a phone; for a keyboard and screen readers, Dismiss shows only when reached. -->
	<div
		use:swipeAway={{ ondismiss: dismissToast, onhold: holdToast, onrelease: releaseToast }}
		class="achievement-toast pointer-events-auto flex max-w-[min(440px,100%)] min-w-0 items-center rounded-tile bg-toast-bg text-toast-text shadow-toast"
	>
		<button
			type="button"
			onclick={openCelebration}
			aria-label={m.achievement_toast_open({ title, detail: detail.replace(/[.!?…]$/, '') })}
			class="flex min-w-0 flex-1 items-center gap-3 rounded-tile py-3 pr-3 pl-3 text-left"
		>
			<span class="pop grid size-10 shrink-0 place-items-center rounded-full bg-surface"
				><Picture hex={achievementPicture(a)} size={30} /></span
			>
			<span class="min-w-0 flex-1">
				<span class="block text-[0.9375rem] font-bold">{title}</span>
				{#if detail}<span class="block text-[0.8125rem] opacity-75">{detail}</span>{/if}
			</span>
			<ChevronRight size={20} aria-hidden="true" class="shrink-0 opacity-70" />
		</button>
		<button
			type="button"
			onclick={dismissToast}
			aria-label={m.toast_dismiss()}
			class="sr-only shrink-0 place-items-center rounded-small focus-visible:not-sr-only focus-visible:mr-2 focus-visible:grid focus-visible:min-h-11 focus-visible:min-w-11 focus-visible:outline-2 focus-visible:outline-current"
			><X size={18} strokeWidth={2.4} aria-hidden="true" /></button
		>
	</div>
{/if}

<style>
	.achievement-toast {
		animation: rise 260ms cubic-bezier(0.2, 0.9, 0.3, 1.1) backwards;
	}
	.pop {
		animation: pop 520ms 120ms cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
	}
	@keyframes rise {
		from {
			transform: translateY(16px);
			opacity: 0;
		}
	}
	@keyframes pop {
		from {
			transform: scale(0.6);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.achievement-toast,
		.pop {
			animation: none;
		}
	}
</style>
