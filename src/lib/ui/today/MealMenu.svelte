<script lang="ts">
	// The meal card's … menu (docs/ui.md, "Bulk actions"): select its entries, move, copy or delete the whole meal.
	// It is also the way to do everything a hold or a drag does without either gesture.
	import { m } from '#lib/paraglide/messages.js';
	import ActionMenu from '../ActionMenu.svelte';

	interface Props {
		label: string;
		saveLabel: string;
		onsave: () => void;
		onselect: () => void;
		onmove: () => void;
		oncopy: () => void;
		ondelete: () => void;
	}
	let { label, saveLabel, onsave, onselect, onmove, oncopy, ondelete }: Props = $props();
</script>

<ActionMenu
	{label}
	up
	items={[
		{ label: m.saved_save_as(), ariaLabel: saveLabel, action: onsave },
		{ label: m.meal_menu_select(), action: onselect },
		{ label: m.meal_menu_move(), action: onmove },
		{ label: m.meal_menu_copy(), action: oncopy },
		{ label: m.meal_menu_delete(), danger: true, action: ondelete }
	]}
/>
