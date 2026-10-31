<script lang="ts">
	// The bar while entries are selected (docs/ui.md, "Bulk actions"): the count, Cancel, and Move to… / Copy to… /
	// Delete. On a phone it sits over the tab bar; on desktop at the bottom right of the page.
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		count: number;
		busy: boolean;
		oncancel: () => void;
		onmove: () => void;
		oncopy: () => void;
		ondelete: () => void;
	}
	let { count, busy, oncancel, onmove, oncopy, ondelete }: Props = $props();
	const action =
		'min-h-12 rounded-[14px] bg-toast-text/12 text-[14px] font-bold disabled:opacity-40';
</script>

<div
	role="toolbar"
	aria-label={m.select_toolbar()}
	class="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 flex flex-col gap-1.5 rounded-[22px] bg-toast-bg p-2 text-toast-text shadow-toast desk:right-7 desk:left-auto desk:w-[420px]"
>
	<div class="flex items-center justify-between px-2 pt-0.5">
		<span class="text-[14px] font-bold" aria-live="polite"
			>{count === 0
				? m.select_none()
				: count === 1
					? m.select_one()
					: m.select_many({ count: String(count) })}</span
		>
		<button
			type="button"
			onclick={oncancel}
			class="min-h-9 px-1 text-[14px] font-semibold opacity-85">{m.select_cancel()}</button
		>
	</div>
	<div class="grid grid-cols-3 gap-1.5">
		<button type="button" class={action} disabled={!count || busy} onclick={onmove}
			>{m.select_move()}</button
		>
		<button type="button" class={action} disabled={!count || busy} onclick={oncopy}
			>{m.select_copy()}</button
		>
		<button
			type="button"
			class={[action, 'text-[color-mix(in_srgb,var(--bad)_70%,var(--toast-text))]']}
			disabled={!count || busy}
			onclick={ondelete}>{m.select_delete()}</button
		>
	</div>
</div>
