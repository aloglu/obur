<script lang="ts">
	// A local, unsent entry: explain that it is only on this device and offer to discard it.
	import { m } from '#lib/paraglide/messages.js';
	import type { QueuedOp } from '#lib/client/offline/store.ts';
	import Button from '../Button.svelte';
	import Notice from '../Notice.svelte';
	import Sheet from '../Sheet.svelte';

	let { op, ondiscard, onclose }: { op: QueuedOp; ondiscard: () => void; onclose: () => void } =
		$props();
</script>

<Sheet title={m.offline_discard_title()} {onclose}>
	{#if op.preview.kind === 'diary'}<p class="text-[15px] font-semibold break-words">
			{op.preview.name}
		</p>{/if}
	<p class="text-[14px] text-muted">{m.offline_discard_body()}</p>
	{#if op.status === 'review'}<Notice>{m.offline_review()}</Notice>{/if}
	<Button variant="danger" onclick={ondiscard}>{m.offline_discard()}</Button>
</Sheet>
