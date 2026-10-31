<script lang="ts">
	// docs/ui.md "Toast": bottom-left of the main area on desktop, above the tab bar on phones; 5 s; role="status".
	import Check from '@lucide/svelte/icons/check';
	import { m } from '#lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { dismissToast, restoreToast, toast } from '#lib/client/toast.svelte.ts';
	import AchievementToast from '../achievements/AchievementToast.svelte';

	onMount(restoreToast);

	async function undo() {
		const action = toast.current?.undo;
		dismissToast();
		await action?.();
	}
</script>

<div
	role="status"
	aria-live="polite"
	class="pointer-events-none fixed inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] z-40 flex flex-col items-center gap-2 desk:inset-x-auto desk:bottom-6 desk:left-[calc(232px+28px)] desk:items-start"
>
	<!-- An achievement sits above an ordinary toast when both show. -->
	<AchievementToast />
	{#if toast.current}
		{#key toast.current.id}
			<div
				class="toast pointer-events-auto flex max-w-[440px] min-w-0 items-center gap-3 rounded-tile bg-toast-bg py-3 pr-2 pl-3.5 text-toast-text shadow-toast"
			>
				<span
					class="check grid size-7 shrink-0 place-items-center rounded-full bg-accent text-on-accent"
					><Check size={16} strokeWidth={3} aria-hidden="true" /></span
				>
				<span class="min-w-0 flex-1">
					<span class="block text-[15px] font-bold">{toast.current.message}</span>
					{#if toast.current.detail}<span class="block truncate text-[13px] opacity-75"
							>{toast.current.detail}</span
						>{/if}
				</span>
				{#if toast.current.undo}
					<button
						type="button"
						onclick={undo}
						class="min-h-11 shrink-0 rounded-small px-3 text-[15px] font-bold underline"
						>{m.toast_undo()}</button
					>
				{/if}
			</div>
		{/key}
	{/if}
</div>

<style>
	.toast {
		animation:
			toast-in 260ms cubic-bezier(0.2, 0.9, 0.3, 1.25),
			fade-in 180ms ease;
	}
	.check {
		animation: pop 260ms cubic-bezier(0.2, 0.9, 0.3, 1.25);
	}
	@keyframes toast-in {
		from {
			transform: translateY(16px);
		}
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes pop {
		from {
			transform: scale(0.4);
		}
	}
</style>
