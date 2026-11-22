<script lang="ts">
	// The unit at the end of a field as a button: a tap switches to the other unit (the water card's ml / l, with a
	// small up-down mark so it reads as a control). The unit in the text colour: orange on the field is 4.37:1, under
	// AA for its size; the mark is orange (3:1 is enough for a mark).
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { otherUnit, type UnitChoice } from './unit-choice.ts';

	let { choice, text }: { choice: UnitChoice; text: string } = $props();
	const next = $derived(choice.options.find((o) => o.value === otherUnit(choice))?.label ?? '');
</script>

<button
	type="button"
	onclick={() => choice.onchange(otherUnit(choice))}
	aria-label="{choice.name}: {text}. {next}"
	class="-mr-2 flex h-10 shrink-0 items-center gap-0.5 rounded-small px-2 text-[0.875rem] font-[650] text-text"
	>{text}<ChevronsUpDown size={14} aria-hidden="true" class="text-accent" /></button
>
