<script lang="ts">
	// The meal card's … menu (docs/ui.md, "Bulk actions"): select its entries, move, copy or delete the whole meal.
	// It is also the way to do everything a hold or a drag does without either gesture.
	import { m } from '#lib/paraglide/messages.js';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
	import Copy from '@lucide/svelte/icons/copy';
	import SquareCheck from '@lucide/svelte/icons/square-check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
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
		{ label: m.saved_save_as(), ariaLabel: saveLabel, icon: BookmarkPlus, action: onsave },
		{ label: m.meal_menu_select(), icon: SquareCheck, action: onselect },
		{ label: m.meal_menu_move(), icon: ArrowRight, action: onmove },
		{ label: m.meal_menu_copy(), icon: Copy, action: oncopy },
		{ label: m.meal_menu_delete(), icon: Trash2, danger: true, action: ondelete }
	]}
/>
