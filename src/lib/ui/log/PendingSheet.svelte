<script lang="ts">
	// An entry kept on this device (docs/ui.md, "Offline refused entry"). Still waiting: it is only here, and can be
	// discarded. Refused by the server: say why, then keep it as calories only, choose another food, or discard it.
	import { m } from '#lib/paraglide/messages.js';
	import type { QueuedOp } from '#lib/client/offline/store.ts';
	import { kcal } from '#lib/shared/format.ts';
	import { mealName } from '#lib/shared/format.ts';
	import Button from '../Button.svelte';
	import FoodIcon from '../FoodIcon.svelte';
	import Sheet from '../Sheet.svelte';

	interface Props {
		op: QueuedOp;
		ondiscard: () => void;
		/** Refused entries with a known energy: log those calories instead. */
		oncalories?: () => void;
		/** Refused entries: find the food again on Log. */
		onother?: () => void;
		onclose: () => void;
	}
	let { op, ondiscard, oncalories, onother, onclose }: Props = $props();
	const refused = $derived(op.status === 'review');
	const preview = $derived(op.preview.kind === 'diary' ? op.preview : null);
	const reason = $derived(
		op.error === 'not_found'
			? m.offline_refused_gone()
			: op.error === 'conversion_unknown' || op.error?.startsWith('Unknown unit')
				? m.offline_refused_unit()
				: m.offline_review()
	);
</script>

<Sheet title={refused ? m.offline_refused_title() : m.offline_discard_title()} {onclose}>
	{#if preview}
		<div class="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3">
			<FoodIcon name={preview.name} />
			<span class="min-w-0">
				<b class="block text-[15px] font-semibold break-words">{preview.name}</b>
				<small class="block text-[13px] text-muted">
					{[
						preview.quantity,
						preview.kcal === null ? null : `${kcal(preview.kcal)} kcal`,
						mealName(preview.meal)
					]
						.filter(Boolean)
						.join(' · ')}
				</small>
			</span>
		</div>
	{/if}
	<p class="text-[14px] text-muted">{refused ? reason : m.offline_discard_body()}</p>
	{#if refused && preview}
		{#if preview.kcal !== null && oncalories}
			<Button onclick={oncalories}
				>{m.offline_refused_calories({ kcal: kcal(preview.kcal) })}</Button
			>
		{/if}
		{#if onother}<Button variant="ghost" onclick={onother}>{m.offline_refused_other()}</Button>{/if}
		<Button variant="danger" onclick={ondiscard}>{m.offline_refused_discard()}</Button>
	{:else}
		<Button variant="danger" onclick={ondiscard}>{m.offline_discard()}</Button>
	{/if}
</Sheet>
