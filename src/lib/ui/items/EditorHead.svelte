<script lang="ts">
	// The top of the recipe and saved meal editors (docs/ui.md, "Recipes and saved meals"): the way back, the title with
	// a … menu beside it, and the menu's confirmation opening under the title.
	import { m } from '#lib/paraglide/messages.js';
	import ActionMenu from '../ActionMenu.svelte';
	import PageHead from '../PageHead.svelte';
	import Button from '../Button.svelte';

	interface Props {
		backHref: string;
		backLabel: string;
		title: string;
		/** The destructive action behind the … menu, when there's something to act on. */
		remove?: { label: string; confirm: string; yes: string; run: () => void };
		/** Done straight away, without a confirmation (Restore). */
		direct?: { label: string; run: () => void };
		busy: boolean;
	}
	let { backHref, backLabel, title, remove, direct, busy }: Props = $props();
	let confirming = $state(false);
	const items = $derived([
		...(direct ? [{ label: direct.label, action: direct.run }] : []),
		...(remove ? [{ label: remove.label, danger: true, action: () => (confirming = true) }] : [])
	]);
</script>

{#snippet menu()}<ActionMenu label={m.editor_actions()} {items} />{/snippet}
<PageHead href={backHref} label={backLabel} {title} end={items.length > 0 ? menu : undefined} />
{#if remove}
	<!-- Takes no room while closed; the padding gives the card's shadow somewhere to fall. -->
	<div class={['collapse-row -mx-3.5 -mt-3', confirming && 'open']}>
		<div inert={!confirming}>
			<div
				class="mx-3.5 mt-3 mb-2 flex flex-col gap-3 rounded-card bg-surface p-[18px] shadow-card"
			>
				<p class="text-[0.9375rem]">{remove.confirm}</p>
				<div class="grid grid-cols-2 gap-2">
					<Button variant="ghost" onclick={() => (confirming = false)}>{m.editor_keep()}</Button>
					<Button variant="danger" disabled={busy} onclick={remove.run}>{remove.yes}</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
