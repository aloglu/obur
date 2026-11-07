<script lang="ts">
	// The header of the amount and edit sheets: the food's picture, its name, and a line under it.
	import FoodIcon from '../FoodIcon.svelte';

	interface Props {
		name: string;
		detail: string;
		icon?: string | null;
		iconName?: string;
		brand?: string | null;
	}
	let { name, detail, icon, iconName, brand }: Props = $props();
</script>

<div class="flex min-w-0 items-center gap-3">
	<FoodIcon {icon} name={iconName ?? name} {brand} />
	<div class="min-w-0">
		<h2 class="line-clamp-2 text-[1.1875rem] leading-tight font-[750] break-words">{name}</h2>
		<p class="text-[0.8125rem] text-muted">{detail}</p>
	</div>
</div>
