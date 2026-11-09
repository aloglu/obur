<script lang="ts">
	// Speak or Scan on a server without that add-on, while people may use their own key (docs/ui.md, "Your own AI key
	// for Speak and Scan"): say so, and offer the person's own key or typing instead.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { Feature } from '#lib/shared/remote-models.ts';
	import Button from '../Button.svelte';
	import Sheet from '../Sheet.svelte';

	let { feature, ontype, onclose }: { feature: Feature; ontype: () => void; onclose: () => void } =
		$props();
</script>

<Sheet title={feature === 'speak' ? m.speak_not_set_up() : m.scan_not_set_up()} {onclose}>
	<p class="text-[0.9375rem] leading-snug">
		{feature === 'speak' ? m.speak_not_set_up_line() : m.scan_not_set_up_line()}
	</p>
	<Button wide onclick={() => goto(resolve('/(app)/more/speak-and-scan'))}>{m.use_own_key()}</Button
	>
	<Button wide variant="ghost" onclick={ontype}
		>{feature === 'speak' ? m.speak_type_instead() : m.scan_by_hand()}</Button
	>
</Sheet>
