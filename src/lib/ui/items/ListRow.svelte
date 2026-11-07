<script lang="ts">
	// One row of a list card: the icon, the name, a short detail, and the number at the right. Long names wrap to two lines.
	import FoodIcon from '../FoodIcon.svelte';

	interface Props {
		href: string;
		icon: string | null;
		name: string;
		brand?: string | null;
		detail: string;
		/** Energy as shown, or null when it isn't known. */
		kcal: number | string | null;
		/** The words an icon is suggested from, when they aren't the row's name. */
		iconFrom?: { name: string; brand: string | null };
		faded?: boolean;
	}
	let { href, icon, name, brand = null, detail, kcal, iconFrom, faded = false }: Props = $props();
</script>

<li>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- every caller passes resolve(...) -->
	<a
		{href}
		class={[
			'grid min-h-14 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-input px-2.5 py-1.5 hover:bg-surface2',
			faded && 'opacity-60'
		]}
	>
		<FoodIcon {icon} name={iconFrom?.name ?? name} brand={iconFrom?.brand ?? brand} />
		<span>
			<span class="line-clamp-2 text-[0.9375rem] font-semibold break-words"
				>{brand ? `${brand} ` : ''}{name}</span
			>
			<small class="block text-[0.8125rem] text-muted">{detail}</small>
		</span>
		<span class="text-[0.9375rem] font-semibold tabular-nums">{kcal === null ? '–' : kcal}</span>
	</a>
</li>
