<script lang="ts">
	// The moment an achievement lands: a toast like the others, never blocking; tapping it opens the celebration.
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { celebration, openCelebration } from '#lib/client/celebration.svelte.ts';
	import Picture from './Picture.svelte';
	import { achievementDetail, achievementPicture, achievementTitle } from './text.ts';
</script>

{#if celebration.toast}
	{@const a = celebration.toast}
	{@const title = achievementTitle(a)}
	{@const detail = achievementDetail(a)}
	<button
		type="button"
		onclick={openCelebration}
		aria-label={m.achievement_toast_open({ title, detail })}
		class="achievement-toast pointer-events-auto flex max-w-[440px] min-w-0 items-center gap-3 rounded-tile bg-toast-bg py-3 pr-3 pl-3 text-left text-toast-text shadow-toast"
	>
		<span class="pop grid size-10 shrink-0 place-items-center rounded-full bg-surface"
			><Picture hex={achievementPicture(a)} size={30} /></span
		>
		<span class="min-w-0 flex-1">
			<span class="block text-[15px] font-bold">{title}</span>
			{#if detail}<span class="block text-[13px] opacity-75">{detail}</span>{/if}
		</span>
		<ChevronRight size={20} aria-hidden="true" class="shrink-0 opacity-70" />
	</button>
{/if}

<style>
	.achievement-toast {
		animation: rise 260ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
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
